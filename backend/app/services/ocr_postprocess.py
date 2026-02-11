import logging
from pathlib import Path
from typing import List, Optional

import numpy as np
from PIL import Image

from ..db.models import TextRegion
from .text_script_utils import has_han, is_pure_label_like, normalize_ocr_text

logger = logging.getLogger(__name__)

_en_reader = None


def _get_easyocr_en_reader():
    global _en_reader
    if _en_reader is None:
        try:
            import easyocr
        except ModuleNotFoundError as e:
            raise RuntimeError(
                "Missing dependency: easyocr. Install backend requirements in your venv (pip install -r backend/requirements.txt)."
            ) from e
        _en_reader = easyocr.Reader(["en"], gpu=False)
    return _en_reader


def _crop_np(image_path: Path, bbox: List[float]) -> np.ndarray:
    x1, y1, x2, y2 = bbox
    with Image.open(image_path) as img:
        w, h = img.size
        pad = max(1, int(min(w, h) * 0.002))
        left = max(0, int(x1) - pad)
        top = max(0, int(y1) - pad)
        right = min(w, int(x2) + pad)
        bottom = min(h, int(y2) + pad)
        crop = img.crop((left, top, right, bottom)).convert("RGB")
        return np.array(crop)


def _crop_np_scaled(image_path: Path, bbox: List[float], scale: float) -> np.ndarray:
    if scale is None or float(scale) >= 0.999:
        return _crop_np(image_path, bbox)
    x1, y1, x2, y2 = bbox
    with Image.open(image_path) as img:
        w, h = img.size
        pad = max(1, int(min(w, h) * 0.002))
        left = max(0, int(x1) - pad)
        top = max(0, int(y1) - pad)
        right = min(w, int(x2) + pad)
        bottom = min(h, int(y2) + pad)
        crop = img.crop((left, top, right, bottom)).convert("RGB")
        new_w = max(1, int(crop.size[0] * float(scale)))
        new_h = max(1, int(crop.size[1] * float(scale)))
        crop = crop.resize((new_w, new_h), Image.BILINEAR)
        return np.array(crop)


def _looks_like_label_en(text: str) -> bool:
    return is_pure_label_like(text)


def recheck_suspicious_regions(
    image_path: Path,
    regions: List[TextRegion],
    recheck_max_regions_per_page: int,
    source_dpi: Optional[int] = None,
    target_dpi: int = 150,
) -> List[TextRegion]:
    """
    Aplica recheck OCR EN en regiones sospechosas (cajas pequeñas con texto corto).
    Filtra regiones que el OCR EN identifica como etiquetas alfanuméricas.
    """
    out: List[TextRegion] = []
    suspicious: List[TextRegion] = []

    for r in regions:
        # Gate sospechoso: texto corto (<=4 chars) sin importar tamaño de caja
        is_short = len((r.src_text or "").strip()) <= 4

        if is_short:
            suspicious.append(r)
        else:
            out.append(r)

    if not suspicious:
        return out

    max_to_check = int(recheck_max_regions_per_page)
    to_check = suspicious[:max_to_check]
    passthrough = suspicious[max_to_check:]

    scale = 1.0
    if source_dpi and int(source_dpi) > 0:
        scale = min(1.0, float(target_dpi) / float(source_dpi))

    reader = _get_easyocr_en_reader()
    crops: List[np.ndarray] = []
    for r in to_check:
        try:
            crops.append(_crop_np_scaled(image_path, r.bbox, scale))
        except Exception:
            crops.append(_crop_np(image_path, r.bbox))

    results: List[list] = []
    try:
        # EasyOCR soporta batch en algunas versiones
        readtext_batched = getattr(reader, "readtext_batched", None)
        if callable(readtext_batched):
            results = readtext_batched(crops)
        else:
            results = [reader.readtext(c) for c in crops]
    except Exception as e:
        logger.debug("OCR recheck batch failed: %s", e)
        results = [reader.readtext(c) for c in crops]

    for r, res in zip(to_check, results):
        try:
            if res:
                best = max(res, key=lambda it: float(it[2] if len(it) > 2 else 0.0))
                en_text = normalize_ocr_text(best[1])
                en_conf = float(best[2] if len(best) > 2 else 0.0)
                if en_conf >= 0.6 and _looks_like_label_en(en_text) and not has_han(en_text):
                    continue
        except Exception as e:
            logger.debug("OCR recheck parse failed: %s", e)

        out.append(r)

    out.extend(passthrough)

    return out


def filter_regions_advanced(
    image_path: Path,
    regions: List[TextRegion],
    min_ocr_confidence: float,
    enable_label_recheck: bool,
    recheck_max_regions_per_page: int,
    source_dpi: Optional[int] = None,
    target_dpi: int = 150,
) -> List[TextRegion]:
    out: List[TextRegion] = []

    suspicious: List[TextRegion] = []

    for r in regions:
        r.src_text = normalize_ocr_text(r.src_text)

        if r.confidence is not None and float(r.confidence) < float(min_ocr_confidence):
            continue

        if is_pure_label_like(r.src_text):
            continue

        # Gate sospechoso: texto corto (<=4 chars) sin importar tamaño de caja
        is_short = len((r.src_text or "").strip()) <= 4

        if enable_label_recheck and is_short:
            suspicious.append(r)
        else:
            out.append(r)

    if not enable_label_recheck or not suspicious:
        return out + suspicious

    max_to_check = int(recheck_max_regions_per_page)
    to_check = suspicious[:max_to_check]
    passthrough = suspicious[max_to_check:]

    scale = 1.0
    if source_dpi and int(source_dpi) > 0:
        scale = min(1.0, float(target_dpi) / float(source_dpi))

    reader = _get_easyocr_en_reader()
    crops: List[np.ndarray] = []
    for r in to_check:
        try:
            crops.append(_crop_np_scaled(image_path, r.bbox, scale))
        except Exception:
            crops.append(_crop_np(image_path, r.bbox))

    results: List[list] = []
    try:
        readtext_batched = getattr(reader, "readtext_batched", None)
        if callable(readtext_batched):
            results = readtext_batched(crops)
        else:
            results = [reader.readtext(c) for c in crops]
    except Exception as e:
        logger.debug("OCR recheck batch failed: %s", e)
        results = [reader.readtext(c) for c in crops]

    for r, res in zip(to_check, results):
        try:
            if res:
                best = max(res, key=lambda it: float(it[2] if len(it) > 2 else 0.0))
                en_text = normalize_ocr_text(best[1])
                en_conf = float(best[2] if len(best) > 2 else 0.0)
                if en_conf >= 0.6 and _looks_like_label_en(en_text) and not has_han(en_text):
                    continue
        except Exception as e:
            logger.debug("OCR recheck parse failed: %s", e)

        out.append(r)

    out.extend(passthrough)

    return out
