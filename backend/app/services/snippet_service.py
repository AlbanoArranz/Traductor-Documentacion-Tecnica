from __future__ import annotations

import logging
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from ..config import SNIPPETS_DIR, get_ocr_engine
from ..db.repository import snippets_repo

logger = logging.getLogger("uvicorn.error")


def get_render_path(snippet_id: str, version: Optional[int] = None, transparent: bool = False) -> Path:
    snippet = snippets_repo.get(snippet_id)
    current_version = version or (getattr(snippet, "current_version", 1) if snippet else 1)
    suffix = "_nobg" if transparent and getattr(snippet, "has_transparent", False) else ""
    if current_version > 1:
        candidate = SNIPPETS_DIR / f"{snippet_id}_v{current_version}{suffix}.png"
        if candidate.exists():
            return candidate
    return SNIPPETS_DIR / f"{snippet_id}{suffix}.png"


def _save_render_from_image(snippet_id: str, version: int, image: Image.Image, transparent: bool = False) -> Path:
    suffix = "_nobg" if transparent else ""
    render_path = SNIPPETS_DIR / f"{snippet_id}_v{version}{suffix}.png"
    render_path.parent.mkdir(parents=True, exist_ok=True)
    image.copy().save(render_path, "PNG")
    return render_path


def _copy_render_from_path(snippet_id: str, version: int, source_path: Path) -> Path:
    if not source_path.exists():
        logger.warning("[SNIPPET] source render not found for %s", snippet_id)
        return source_path
    with Image.open(source_path) as img:
        return _save_render_from_image(snippet_id, version, img)


def remove_white_background(img: Image.Image, threshold: int = 240) -> Image.Image:
    img = img.convert("RGBA")
    arr = np.array(img)
    luminance = arr[:, :, :3].mean(axis=2)
    arr[:, :, 3] = np.where(luminance > threshold, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def run_ocr_on_image(img: Image.Image) -> List[dict]:
    detections: List[dict] = []
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".png")
    os.close(tmp_fd)
    try:
        orig_w, orig_h = img.size
        scale = 2
        upscaled = img.resize((orig_w * scale, orig_h * scale), Image.LANCZOS)
        upscaled.save(tmp_path, "PNG")

        engine_name = get_ocr_engine()
        raw_items: list = []

        if engine_name == "rapidocr":
            from ..services.ocr_service_rapid import _get_ocr

            ocr = _get_ocr()
            result, _ = ocr(
                tmp_path,
                det_db_thresh=0.2,
                det_db_box_thresh=0.3,
                det_db_unclip_ratio=1.3,
            )
            if result:
                for item in result:
                    try:
                        raw_items.append((item[0], str(item[1]), float(item[2])))
                    except Exception:
                        continue
        elif engine_name == "paddleocr":
            from ..services.ocr_service_paddle import _get_ocr, _parse_paddle_result

            reader = _get_ocr()
            raw = reader.ocr(tmp_path, cls=True)
            for item in _parse_paddle_result(raw):
                try:
                    raw_items.append((item[0], item[1][0], float(item[1][1])))
                except Exception:
                    continue
        else:
            from ..services.ocr_service import _get_ocr

            reader = _get_ocr()
            for item in reader.readtext(tmp_path, text_threshold=0.3, low_text=0.3):
                try:
                    raw_items.append((item[0], item[1], float(item[2])))
                except Exception:
                    continue

        for bbox_pts, text, conf in raw_items:
            if not text or not text.strip():
                continue
            try:
                xs = [float(p[0]) / scale for p in bbox_pts]
                ys = [float(p[1]) / scale for p in bbox_pts]
                detections.append({
                    "bbox": [min(xs), min(ys), max(xs), max(ys)],
                    "text": text.strip(),
                    "confidence": conf,
                })
            except Exception:
                continue
    except Exception as exc:
        logger.warning("[SNIPPET] OCR on image failed: %s", exc)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
    return detections


def erase_text_regions(img: Image.Image, detections: List[dict], shrink_px: int = 2) -> Image.Image:
    if not detections:
        return img
    working = img.convert("RGBA")
    draw = ImageDraw.Draw(working)
    w, h = working.size
    for det in detections:
        bbox = det.get("bbox")
        if not bbox or len(bbox) != 4:
            continue
        x1 = max(0, min(int(bbox[0]) + shrink_px, w))
        y1 = max(0, min(int(bbox[1]) + shrink_px, h))
        x2 = max(0, min(int(bbox[2]) - shrink_px, w))
        y2 = max(0, min(int(bbox[3]) - shrink_px, h))
        if x2 <= x1 or y2 <= y1:
            continue
        draw.rectangle([x1, y1, x2, y2], fill="white")
    return working


def replace_ocr_text_regions(img: Image.Image, detections: List[dict], shrink_px: int = 2) -> Image.Image:
    if not detections:
        return img
    working = erase_text_regions(img, detections, shrink_px=shrink_px)
    draw = ImageDraw.Draw(working)
    default_font = ImageFont.load_default()

    for det in detections:
        bbox = det.get("bbox") or []
        text = (det.get("text") or "").strip()
        if len(bbox) != 4 or not text:
            continue
        x1, y1, x2, y2 = [float(v) for v in bbox]
        if x2 <= x1 or y2 <= y1:
            continue

        font_size = max(10, int((y2 - y1) * 0.7))
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except Exception:
            font = default_font

        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_w = max(1, text_bbox[2] - text_bbox[0])
        text_h = max(1, text_bbox[3] - text_bbox[1])
        tx = x1 + ((x2 - x1) - text_w) / 2
        ty = y1 + ((y2 - y1) - text_h) / 2
        draw.text((tx, ty), text, fill="black", font=font)

    return working


def draw_overlay_elements(img: Image.Image, elements: List[dict]) -> Image.Image:
    if not elements:
        return img
    working = img.convert("RGBA")
    draw = ImageDraw.Draw(working)
    default_font = ImageFont.load_default()

    for el in elements:
        el_type = el.get("element_type")
        points = el.get("points") or []
        stroke_color = el.get("stroke_color") or "#000000"
        stroke_width = int(el.get("stroke_width") or 2)
        fill_color = el.get("fill_color")

        try:
            if el_type == "line" and len(points) >= 4:
                draw.line(points[:4], fill=stroke_color, width=stroke_width)
            elif el_type == "rect" and len(points) >= 4:
                x1, y1, x2, y2 = points[:4]
                draw.rectangle([x1, y1, x2, y2], outline=stroke_color, width=stroke_width, fill=fill_color)
            elif el_type == "circle" and len(points) >= 4:
                x1, y1, x2, y2 = points[:4]
                draw.ellipse([x1, y1, x2, y2], outline=stroke_color, width=stroke_width, fill=fill_color)
            elif el_type == "polyline" and len(points) >= 4 and len(points) % 2 == 0:
                poly_pts = [(points[i], points[i + 1]) for i in range(0, len(points), 2)]
                draw.line(poly_pts, fill=stroke_color, width=stroke_width)
            elif el_type == "text" and len(points) >= 2:
                text = (el.get("text") or "").strip()
                if text:
                    font_size = int(el.get("font_size") or 14)
                    text_color = el.get("text_color") or stroke_color
                    try:
                        font = ImageFont.truetype("arial.ttf", max(10, font_size))
                    except Exception:
                        font = default_font
                    draw.text((points[0], points[1]), text, fill=text_color, font=font)
        except Exception as exc:
            logger.warning("[SNIPPET] draw_overlay element skipped: %s", exc)

    return working


def render_from_ops(snippet_id: str, ops: Optional[List[Dict[str, Any]]]) -> Image.Image:
    base_path = get_render_path(snippet_id)
    with Image.open(base_path) as img:
        current = img.convert("RGBA")

    for op in ops or []:
        op_type = op.get("type")
        payload = op.get("payload", {}) or {}
        if op_type == "remove_bg":
            current = remove_white_background(current)
        elif op_type == "ocr_remove_text":
            regions = payload.get("regions")
            detections = regions or run_ocr_on_image(current)
            current = erase_text_regions(current, detections, shrink_px=payload.get("shrink_px", 2))
        elif op_type == "ocr_replace_text":
            regions = payload.get("regions")
            detections = regions or run_ocr_on_image(current)
            current = replace_ocr_text_regions(current, detections, shrink_px=payload.get("shrink_px", 2))
        elif op_type == "draw_overlay":
            elements = payload.get("elements") or []
            current = draw_overlay_elements(current, elements)
        else:
            logger.warning("[SNIPPET] Unsupported op '%s'", op_type)

    return current


def create_version(
    snippet_id: str,
    *,
    name: Optional[str] = None,
    ops: Optional[List[Dict[str, Any]]] = None,
    comment: str = "",
    rendered_image: Optional[Image.Image] = None,
) -> Any:
    snippet = snippets_repo.get(snippet_id)
    if not snippet:
        raise ValueError("Snippet not found")

    if name:
        snippet.name = name

    current_version = getattr(snippet, "current_version", 1)
    next_version = current_version + 1
    snippet.current_version = next_version

    meta = snippets_repo.load_snippet_meta(snippet_id)
    normalized_ops = ops or []
    for op in normalized_ops:
        op_type = op.get("type")
        payload = op.get("payload", {}) or {}
        if op_type == "ocr_replace_text":
            regions = payload.get("regions") or []
            snippet.ocr_detections = regions
            snippet.text_erased = True
            meta["ocr_detections"] = regions
        elif op_type == "ocr_remove_text":
            regions = payload.get("regions") or []
            if regions:
                snippet.ocr_detections = regions
                meta["ocr_detections"] = regions
            snippet.text_erased = True

    snippets_repo.persist()

    meta["ops"] = normalized_ops
    meta.setdefault("versions", []).append(
        {
            "version": next_version,
            "created_at": datetime.utcnow().isoformat(),
            "comment": comment or "",
            "checksum": "",
            "ops_snapshot": normalized_ops,
        }
    )
    snippets_repo.save_snippet_meta(snippet_id, meta)

    if rendered_image is None:
        rendered_image = render_from_ops(snippet_id, normalized_ops) if normalized_ops else None

    if rendered_image is not None:
        _save_render_from_image(snippet_id, next_version, rendered_image)
    else:
        previous_path = get_render_path(snippet_id, version=current_version)
        _copy_render_from_path(snippet_id, next_version, previous_path)

    return snippet


def restore_version(snippet_id: str, target_version: int, comment: str = "") -> Any:
    snippet = snippets_repo.get(snippet_id)
    if not snippet:
        raise ValueError("Snippet not found")

    meta = snippets_repo.load_snippet_meta(snippet_id)
    versions = meta.get("versions", [])
    target = next((v for v in versions if v.get("version") == target_version), None)
    if not target:
        raise ValueError("Version not found")

    source_path = get_render_path(snippet_id, version=target_version)
    with Image.open(source_path) as img:
        rendered = img.copy()
    ops_snapshot = target.get("ops_snapshot", [])
    return create_version(
        snippet_id,
        name=None,
        ops=ops_snapshot,
        comment=comment or f"Restore v{target_version}",
        rendered_image=rendered,
    )


def qa_validate(snippet_id: str) -> Dict[str, Any]:
    path = get_render_path(snippet_id)
    exists = path.exists()
    size_ok = False
    dims = (0, 0)
    if exists:
        try:
            with Image.open(path) as img:
                dims = img.size
                width, height = dims
                size_ok = width > 0 and height > 0
        except Exception as exc:
            logger.warning("[SNIPPET] QA validation failed: %s", exc)
            size_ok = False
    return {
        "passed": exists and size_ok,
        "checks": {
            "exists": exists,
            "size_ok": size_ok,
            "dimensions": dims,
        },
        "path": str(path),
    }
