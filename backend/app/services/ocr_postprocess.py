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


def _looks_like_label_en(text: str) -> bool:
    return is_pure_label_like(text)


def recheck_suspicious_regions(
    image_path: Path,
    regions: List[TextRegion],
    recheck_max_regions_per_page: int,
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

    reader = _get_easyocr_en_reader()
    checked = 0

    for r in suspicious:
        if checked >= int(recheck_max_regions_per_page):
            out.append(r)
            continue

        try:
            crop_np = _crop_np(image_path, r.bbox)
            res = reader.readtext(crop_np)
            if res:
                # res: [(bbox, text, conf), ...]
                best = max(res, key=lambda it: float(it[2] if len(it) > 2 else 0.0))
                en_text = normalize_ocr_text(best[1])
                en_conf = float(best[2] if len(best) > 2 else 0.0)

                # Si EN ve claramente una etiqueta alfanumérica, descartamos esta región.
                if en_conf >= 0.6 and _looks_like_label_en(en_text) and not has_han(en_text):
                    checked += 1
                    continue
        except Exception as e:
            logger.debug("OCR recheck failed: %s", e)

        checked += 1
        out.append(r)

    return out


def filter_regions_advanced(
    image_path: Path,
    regions: List[TextRegion],
    min_ocr_confidence: float,
    enable_label_recheck: bool,
    recheck_max_regions_per_page: int,
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

    reader = _get_easyocr_en_reader()
    checked = 0

    for r in suspicious:
        if checked >= int(recheck_max_regions_per_page):
            out.append(r)
            continue

        try:
            crop_np = _crop_np(image_path, r.bbox)
            res = reader.readtext(crop_np)
            if res:
                # res: [(bbox, text, conf), ...]
                best = max(res, key=lambda it: float(it[2] if len(it) > 2 else 0.0))
                en_text = normalize_ocr_text(best[1])
                en_conf = float(best[2] if len(best) > 2 else 0.0)

                # Si EN ve claramente una etiqueta alfanumérica, descartamos esta región.
                if en_conf >= 0.6 and _looks_like_label_en(en_text) and not has_han(en_text):
                    checked += 1
                    continue
        except Exception as e:
            logger.debug("OCR recheck failed: %s", e)

        checked += 1
        out.append(r)

    return out
