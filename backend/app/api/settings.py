"""
API endpoints para configuración.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

from ..config import (
    get_config,
    save_config,
    DEFAULT_MIN_HAN_RATIO,
    get_ocr_region_filters,
    get_ocr_engine,
    get_ocr_mode,
    get_min_ocr_confidence,
    get_ocr_enable_label_recheck,
    get_ocr_recheck_max_regions_per_page,
)

router = APIRouter()


class SettingsResponse(BaseModel):
    deepl_api_key: Optional[str] = None
    default_dpi: int = 450
    min_han_ratio: float = DEFAULT_MIN_HAN_RATIO
    ocr_engine: str = "easyocr"
    ocr_mode: str = "basic"
    min_ocr_confidence: float = 0.55
    ocr_enable_label_recheck: bool = True
    ocr_recheck_max_regions_per_page: int = 200
    ocr_region_filters: List[dict] = []


class SettingsUpdate(BaseModel):
    deepl_api_key: Optional[str] = None
    default_dpi: Optional[int] = None
    min_han_ratio: Optional[float] = None
    ocr_engine: Optional[str] = None
    ocr_mode: Optional[str] = None
    min_ocr_confidence: Optional[float] = None
    ocr_enable_label_recheck: Optional[bool] = None
    ocr_recheck_max_regions_per_page: Optional[int] = None
    ocr_region_filters: Optional[List[dict]] = None


@router.get("", response_model=SettingsResponse)
async def get_settings():
    """Obtiene la configuración actual."""
    config = get_config()
    # Ocultar parte de la API key por seguridad
    api_key = config.get("deepl_api_key", "")
    masked_key = f"{api_key[:8]}...{api_key[-4:]}" if len(api_key) > 12 else ""
    return SettingsResponse(
        deepl_api_key=masked_key,
        default_dpi=config.get("default_dpi", 450),
        min_han_ratio=float(config.get("min_han_ratio", DEFAULT_MIN_HAN_RATIO)),
        ocr_engine=get_ocr_engine(),
        ocr_mode=get_ocr_mode(),
        min_ocr_confidence=get_min_ocr_confidence(),
        ocr_enable_label_recheck=get_ocr_enable_label_recheck(),
        ocr_recheck_max_regions_per_page=get_ocr_recheck_max_regions_per_page(),
        ocr_region_filters=get_ocr_region_filters(),
    )


@router.put("")
async def update_settings(settings: SettingsUpdate):
    """Actualiza la configuración."""
    config = get_config()
    
    if settings.deepl_api_key is not None:
        config["deepl_api_key"] = settings.deepl_api_key
    if settings.default_dpi is not None:
        config["default_dpi"] = settings.default_dpi
    if settings.min_han_ratio is not None:
        value = float(settings.min_han_ratio)
        if value < 0.0:
            value = 0.0
        if value > 1.0:
            value = 1.0
        config["min_han_ratio"] = value
    if settings.ocr_engine is not None:
        value = str(settings.ocr_engine).lower().strip()
        if value not in {"easyocr", "paddleocr"}:
            value = "easyocr"
        config["ocr_engine"] = value
    if settings.ocr_mode is not None:
        value = str(settings.ocr_mode).lower().strip()
        if value not in {"basic", "advanced"}:
            value = "basic"
        config["ocr_mode"] = value
    if settings.min_ocr_confidence is not None:
        try:
            value = float(settings.min_ocr_confidence)
        except Exception:
            value = 0.55
        if value < 0.0:
            value = 0.0
        if value > 1.0:
            value = 1.0
        config["min_ocr_confidence"] = value
    if settings.ocr_enable_label_recheck is not None:
        config["ocr_enable_label_recheck"] = bool(settings.ocr_enable_label_recheck)
    if settings.ocr_recheck_max_regions_per_page is not None:
        try:
            value = int(settings.ocr_recheck_max_regions_per_page)
        except Exception:
            value = 200
        if value < 0:
            value = 0
        config["ocr_recheck_max_regions_per_page"] = value
    if settings.ocr_region_filters is not None:
        if isinstance(settings.ocr_region_filters, list):
            config["ocr_region_filters"] = settings.ocr_region_filters
    save_config(config)
    return {"status": "ok"}
