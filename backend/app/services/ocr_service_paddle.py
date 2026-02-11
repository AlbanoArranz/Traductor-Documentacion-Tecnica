import re
import uuid
from pathlib import Path
from typing import List, Optional

from PIL import Image

from ..config import (
    CJK_RATIO_THRESHOLD,
    get_min_han_ratio,
    get_ocr_region_filters,
    get_min_ocr_confidence,
    get_ocr_enable_label_recheck,
    get_ocr_recheck_max_regions_per_page,
    get_ocr_mode,
)
from ..db.models import TextRegion

_ocr_reader = None


def _get_ocr():
    global _ocr_reader
    if _ocr_reader is None:
        try:
            from paddleocr import PaddleOCR
        except ModuleNotFoundError as e:
            raise RuntimeError(
                "Missing dependency: paddleocr. Install backend requirements in your venv (pip install -r backend/requirements.txt)."
            ) from e
        _ocr_reader = PaddleOCR(
            lang="ch",
            use_angle_cls=True,
        )
    return _ocr_reader


def _is_han_char(char: str) -> bool:
    code = ord(char)
    return (
        0x4E00 <= code <= 0x9FFF
        or 0x3400 <= code <= 0x4DBF
        or 0x20000 <= code <= 0x2A6DF
        or 0x2A700 <= code <= 0x2B73F
        or 0x2B740 <= code <= 0x2B81F
        or 0x2B820 <= code <= 0x2CEAF
        or 0xF900 <= code <= 0xFAFF
        or 0x2F800 <= code <= 0x2FA1F
    )


def _han_ratio(text: str) -> float:
    if not text:
        return 0.0
    han_count = sum(1 for c in text if _is_han_char(c))
    return han_count / len(text)


def _apply_filters(text: str, ocr_filters: list) -> bool:
    for f in ocr_filters:
        mode = f.get("mode")
        pattern = f.get("pattern")
        if not mode or not pattern:
            continue
        case_sensitive = bool(f.get("case_sensitive", False))
        raw_value = text or ""
        value = raw_value if case_sensitive else raw_value.lower()
        target = pattern if case_sensitive else str(pattern).lower()
        try:
            if mode == "contains" and target in value:
                return True
            if mode == "starts" and value.startswith(target):
                return True
            if mode == "ends" and value.endswith(target):
                return True
            if mode == "regex":
                flags = 0 if case_sensitive else re.IGNORECASE
                if re.search(str(pattern), raw_value, flags=flags):
                    return True
        except Exception:
            continue
    return False


def _parse_paddle_result(result) -> list:
    """Parse PaddleOCR 2.x result format to list of [bbox, (text, confidence)]."""
    if not result:
        return []

    if isinstance(result, list) and len(result) == 1 and isinstance(result[0], list):
        return result[0]
    if isinstance(result, list):
        return result
    return []


def detect_text(
    image_path: Path,
    dpi: int,
    custom_filters: Optional[list] = None,
    document_type: str = "schematic",
) -> List[TextRegion]:
    reader = _get_ocr()

    with Image.open(image_path) as img:
        img_width, img_height = img.size

    ocr_filters = custom_filters if custom_filters is not None else get_ocr_region_filters()
    min_han_ratio = get_min_han_ratio()

    raw = reader.ocr(str(image_path), cls=True)
    items = _parse_paddle_result(raw)

    regions: List[TextRegion] = []

    for item in items:
        try:
            bbox_points = item[0]
            text = item[1][0]
            confidence = float(item[1][1])
        except Exception:
            continue

        if not text:
            continue

        if _apply_filters(text, ocr_filters):
            continue

        if _han_ratio(text) < CJK_RATIO_THRESHOLD:
            continue

        if _han_ratio(text) < min_han_ratio:
            continue

        try:
            x_coords = [float(p[0]) for p in bbox_points]
            y_coords = [float(p[1]) for p in bbox_points]
        except Exception:
            continue

        x1, y1 = min(x_coords), min(y_coords)
        x2, y2 = max(x_coords), max(y_coords)

        bbox_normalized = [
            x1 / img_width,
            y1 / img_height,
            x2 / img_width,
            y2 / img_height,
        ]

        project_id = image_path.parent.parent.name
        page_number = int(image_path.stem.split("_")[0])

        region = TextRegion(
            id=str(uuid.uuid4()),
            project_id=project_id,
            page_number=page_number,
            bbox=[x1, y1, x2, y2],
            bbox_normalized=bbox_normalized,
            src_text=text,
            confidence=confidence,
        )
        regions.append(region)

    enable_label_recheck = bool(get_ocr_enable_label_recheck()) or (document_type == "manual")

    if get_ocr_mode() == "advanced" and regions:
        from .ocr_postprocess import filter_regions_advanced

        regions = filter_regions_advanced(
            image_path=image_path,
            regions=regions,
            min_ocr_confidence=get_min_ocr_confidence(),
            enable_label_recheck=enable_label_recheck,
            recheck_max_regions_per_page=get_ocr_recheck_max_regions_per_page(),
            source_dpi=dpi,
        )
    elif enable_label_recheck and regions:
        # Modo básico con recheck activado
        from .ocr_postprocess import recheck_suspicious_regions

        regions = recheck_suspicious_regions(
            image_path=image_path,
            regions=regions,
            recheck_max_regions_per_page=get_ocr_recheck_max_regions_per_page(),
            source_dpi=dpi,
        )

    if document_type == "manual" and len(regions) > 1:
        from .ocr_service import _group_lines_into_paragraphs

        regions = _group_lines_into_paragraphs(regions)

    return regions
