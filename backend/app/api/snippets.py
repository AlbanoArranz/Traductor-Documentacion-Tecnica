"""
API endpoints para la librería de snippets de imagen.
"""

import io
import os
import base64
import tempfile
import logging
from pathlib import Path
from typing import List, Optional, Literal
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image, ImageDraw
import numpy as np

from ..config import PROJECTS_DIR, SNIPPETS_DIR, DEFAULT_DPI, get_ocr_engine
from ..db.repository import snippets_repo, projects_repo
from ..services import snippet_service

logger = logging.getLogger("uvicorn.error")


router = APIRouter()


class OcrDetection(BaseModel):
    bbox: List[float]  # [x1, y1, x2, y2] relativas al recorte
    text: str
    confidence: float


class SnippetVersionMeta(BaseModel):
    version: int
    created_at: str
    comment: Optional[str] = ""
    checksum: Optional[str] = ""
    ops_snapshot: Optional[List[dict]] = None


class SnippetResponse(BaseModel):
    id: str
    name: str
    width: int
    height: int
    has_transparent: bool
    text_erased: bool = False
    created_at: str
    ocr_detections: List[OcrDetection] = []
    current_version: int = 1


class SnippetMetaResponse(BaseModel):
    ops: List[dict]
    versions: List[SnippetVersionMeta]
    ocr_detections: List[OcrDetection]


class CaptureRequest(BaseModel):
    project_id: str
    page_number: int
    bbox: List[float]  # [x1, y1, x2, y2] en píxeles de la imagen original
    name: str
    remove_bg: bool = False
    run_ocr: bool = False
    erase_ocr_text: bool = False


def _snippet_to_response(s) -> dict:
    """Convierte un Snippet del repo a SnippetResponse dict."""
    return SnippetResponse(
        id=s.id,
        name=s.name,
        width=s.width,
        height=s.height,
        has_transparent=s.has_transparent,
        text_erased=s.text_erased,
        created_at=s.created_at.isoformat(),
        current_version=getattr(s, "current_version", 1),
        ocr_detections=[
            OcrDetection(**d) for d in (s.ocr_detections or [])
        ],
    )


def _remove_white_background(img: Image.Image, threshold: int = 240) -> Image.Image:
    """Convierte píxeles blancos/casi-blancos a transparentes."""
    img = img.convert("RGBA")
    arr = np.array(img)
    # Luminancia de cada píxel (promedio RGB)
    luminance = arr[:, :, :3].mean(axis=2)
    # Píxeles con luminancia > threshold → alpha = 0
    arr[:, :, 3] = np.where(luminance > threshold, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def _run_ocr_on_crop(cropped_img: Image.Image) -> List[dict]:
    """Ejecuta OCR sobre la imagen recortada y devuelve detecciones con coords relativas al recorte.
    Escala 2x para mejorar la detección de texto pequeño y usa umbrales bajos."""
    detections: List[dict] = []
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".png")
    os.close(tmp_fd)
    try:
        orig_w, orig_h = cropped_img.size
        scale = 2
        upscaled = cropped_img.resize((orig_w * scale, orig_h * scale), Image.LANCZOS)
        upscaled.save(tmp_path, "PNG")

        engine_name = get_ocr_engine()
        raw_items: list = []  # [(bbox_points, text, confidence)]

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
        else:  # easyocr
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
    except Exception as e:
        logger.warning(f"[SNIPPET] OCR on crop failed: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
    return detections


def _erase_text_regions(img: Image.Image, detections: List[dict], shrink_px: int = 2) -> Image.Image:
    """Pinta de blanco las zonas detectadas por OCR, encogiendo cada bbox
    para no borrar contenido adyacente (líneas, símbolos, etc.)."""
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


def _find_original_image(project_id: str, page_number: int) -> Optional[str]:
    """Busca la imagen original renderizada de una página (prefiere el DPI más alto)."""
    pages_dir = PROJECTS_DIR / project_id / "pages"
    if not pages_dir.exists():
        return None
    prefix = f"{page_number:03d}_original_"
    candidates = [
        f for f in pages_dir.iterdir()
        if f.name.startswith(prefix) and f.suffix == ".png"
    ]
    if not candidates:
        return None
    # Extraer DPI del nombre (e.g. 000_original_450.png -> 450) y elegir el mayor
    def _dpi(f):
        try:
            return int(f.stem.split("_")[-1])
        except (ValueError, IndexError):
            return 0
    candidates.sort(key=_dpi, reverse=True)
    return str(candidates[0])


@router.post("/capture", response_model=SnippetResponse)
async def capture_snippet(data: CaptureRequest):
    """Captura una zona de la página y la guarda como snippet. Opcionalmente ejecuta OCR."""
    logger.info(f"[SNIPPET] capture request: project={data.project_id} page={data.page_number} bbox={data.bbox} name={data.name} remove_bg={data.remove_bg} run_ocr={data.run_ocr}")

    project = projects_repo.get(data.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    img_path = _find_original_image(data.project_id, data.page_number)
    logger.info(f"[SNIPPET] found image: {img_path}")
    if not img_path:
        raise HTTPException(status_code=404, detail="Original image not found for this page")
    
    try:
        img = Image.open(img_path)
        logger.info(f"[SNIPPET] image size: {img.size}")
        
        x1, y1, x2, y2 = [int(v) for v in data.bbox]
        x1 = max(0, min(x1, img.width))
        y1 = max(0, min(y1, img.height))
        x2 = max(0, min(x2, img.width))
        y2 = max(0, min(y2, img.height))
        
        logger.info(f"[SNIPPET] clamped bbox: [{x1}, {y1}, {x2}, {y2}]")
        
        if x2 <= x1 or y2 <= y1:
            raise HTTPException(status_code=400, detail=f"Invalid bounding box after clamping: [{x1},{y1},{x2},{y2}]")
        
        cropped = img.crop((x1, y1, x2, y2))

        ocr_dets_raw: list = []
        if data.run_ocr:
            logger.info("[SNIPPET] running OCR on cropped area...")
            ocr_dets_raw = _run_ocr_on_crop(cropped)
            logger.info(f"[SNIPPET] OCR found {len(ocr_dets_raw)} detections")
        elif data.erase_ocr_text:
            logger.info("[SNIPPET] erase_ocr_text solicitado pero OCR desactivado; se ignora")

        if data.run_ocr and data.erase_ocr_text and ocr_dets_raw:
            logger.info("[SNIPPET] borrando texto detectado en el recorte")
            cropped = _erase_text_regions(cropped, ocr_dets_raw)
        
        did_erase = data.run_ocr and data.erase_ocr_text and len(ocr_dets_raw) > 0
        snippet = snippets_repo.create(
            name=data.name,
            width=cropped.width,
            height=cropped.height,
            has_transparent=data.remove_bg,
            ocr_detections=ocr_dets_raw,
            text_erased=did_erase,
        )
        
        cropped.save(str(SNIPPETS_DIR / f"{snippet.id}.png"), "PNG")
        
        if data.remove_bg:
            nobg = _remove_white_background(cropped)
            nobg.save(str(SNIPPETS_DIR / f"{snippet.id}_nobg.png"), "PNG")
        
        logger.info(f"[SNIPPET] saved snippet {snippet.id} ({cropped.width}x{cropped.height})")

        return _snippet_to_response(snippet)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[SNIPPET] capture error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Capture failed: {str(e)}")


@router.post("/upload", response_model=SnippetResponse)
async def upload_snippet(
    file: UploadFile = File(...),
    name: str = Form(...),
    remove_bg: bool = Form(False),
):
    """Sube una imagen externa como snippet."""
    contents = await file.read()
    try:
        img = Image.open(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")
    
    # Convertir a RGB/RGBA
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if remove_bg else "RGB")
    
    snippet = snippets_repo.create(
        name=name,
        width=img.width,
        height=img.height,
        has_transparent=remove_bg,
    )
    
    # Guardar como PNG
    img.save(str(SNIPPETS_DIR / f"{snippet.id}.png"), "PNG")
    
    if remove_bg:
        nobg = _remove_white_background(img)
        nobg.save(str(SNIPPETS_DIR / f"{snippet.id}_nobg.png"), "PNG")
    
    return _snippet_to_response(snippet)


@router.get("", response_model=List[SnippetResponse])
async def list_snippets():
    """Lista todos los snippets de la librería."""
    snippets = snippets_repo.list_all()
    return [_snippet_to_response(s) for s in snippets]


@router.get("/{snippet_id}/image")
async def get_snippet_image(snippet_id: str, transparent: bool = False):
    """Sirve la imagen PNG de un snippet."""
    snippet = snippets_repo.get(snippet_id)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    img_path = snippet_service.get_render_path(snippet_id, transparent=transparent)
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Snippet image not found")
    return FileResponse(str(img_path), media_type="image/png")


@router.get("/{snippet_id}/base64")
async def get_snippet_base64(snippet_id: str, transparent: bool = False):
    """Devuelve la imagen del snippet como base64 (para insertar como DrawingElement)."""
    snippet = snippets_repo.get(snippet_id)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")

    img_path = snippet_service.get_render_path(snippet_id, transparent=transparent)
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Snippet image not found")
    with open(img_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("ascii")
    return {"base64": data, "width": snippet.width, "height": snippet.height}


@router.get("/{snippet_id}/meta", response_model=SnippetMetaResponse)
async def get_snippet_meta(snippet_id: str):
    snippet = snippets_repo.get(snippet_id)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    meta = snippets_repo.load_snippet_meta(snippet_id)
    versions = [
        SnippetVersionMeta(
            version=entry.get("version", 1),
            created_at=entry.get("created_at", ""),
            comment=entry.get("comment"),
            checksum=entry.get("checksum"),
            ops_snapshot=entry.get("ops_snapshot"),
        )
        for entry in meta.get("versions", [])
    ]
    return SnippetMetaResponse(
        ops=meta.get("ops", []),
        versions=versions,
        ocr_detections=[OcrDetection(**d) for d in meta.get("ocr_detections", [])],
    )


class UpdateOcrDetectionsRequest(BaseModel):
    ocr_detections: List[OcrDetection]


@router.patch("/{snippet_id}/ocr-detections", response_model=SnippetResponse)
async def update_ocr_detections(snippet_id: str, data: UpdateOcrDetectionsRequest):
    """Actualiza los textos OCR de un snippet."""
    snippet = snippets_repo.update_ocr_detections(
        snippet_id,
        [d.dict() for d in data.ocr_detections],
    )
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return _snippet_to_response(snippet)


class SnippetUpdateOp(BaseModel):
    type: Literal[
        "remove_bg",
        "ocr_remove_text",
    ]
    payload: Optional[dict] = None


class SnippetUpdateRequest(BaseModel):
    name: Optional[str] = None
    ops: Optional[List[SnippetUpdateOp]] = None
    comment: Optional[str] = None
    propagate: Optional[dict] = None


@router.patch("/{snippet_id}", response_model=SnippetResponse)
async def update_snippet(snippet_id: str, data: SnippetUpdateRequest):
    snippet = snippets_repo.get(snippet_id)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")

    try:
        snippet = snippet_service.create_version(
            snippet_id,
            name=data.name,
            ops=[op.dict() for op in (data.ops or [])],
            comment=data.comment or "",
        )
        return _snippet_to_response(snippet)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("[SNIPPET] update failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Update failed")


class RestoreVersionRequest(BaseModel):
    target_version: int
    comment: Optional[str] = None


@router.post("/{snippet_id}/restore-version", response_model=SnippetResponse)
async def restore_snippet_version(snippet_id: str, data: RestoreVersionRequest):
    try:
        snippet = snippet_service.restore_version(
            snippet_id,
            target_version=data.target_version,
            comment=data.comment or "",
        )
        return _snippet_to_response(snippet)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("[SNIPPET] restore failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Restore failed")


class OcrDetectResponse(BaseModel):
    detections: List[OcrDetection]


@router.post("/{snippet_id}/ocr/detect", response_model=OcrDetectResponse)
async def detect_snippet_ocr(snippet_id: str):
    snippet = snippets_repo.get(snippet_id)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    path = snippet_service.get_render_path(snippet_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Snippet image not found")
    with Image.open(path) as img:
        detections = snippet_service.run_ocr_on_image(img)
    return OcrDetectResponse(detections=[OcrDetection(**d) for d in detections])


class OcrRemoveTextRequest(BaseModel):
    regions: Optional[List[OcrDetection]] = None
    shrink_px: int = 2


@router.post("/{snippet_id}/ocr/remove-text", response_model=SnippetResponse)
async def remove_snippet_text(snippet_id: str, data: OcrRemoveTextRequest):
    regions = [d.dict() for d in (data.regions or [])]
    ops = [
        {
            "type": "ocr_remove_text",
            "payload": {"regions": regions, "shrink_px": data.shrink_px},
        }
    ]
    snippet = snippet_service.create_version(snippet_id, ops=ops, comment="OCR remove text")
    return _snippet_to_response(snippet)


@router.post("/{snippet_id}/qa-validate")
async def qa_validate_snippet(snippet_id: str):
    snippet = snippets_repo.get(snippet_id)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return snippet_service.qa_validate(snippet_id)


@router.delete("/{snippet_id}")
async def delete_snippet(snippet_id: str):
    """Elimina un snippet de la librería."""
    deleted = snippets_repo.delete(snippet_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return {"status": "deleted"}
