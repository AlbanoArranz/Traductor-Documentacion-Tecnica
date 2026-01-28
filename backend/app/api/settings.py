"""
API endpoints para configuración.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.config import get_config, save_config, DEFAULT_MIN_HAN_RATIO

router = APIRouter()


class SettingsResponse(BaseModel):
    deepl_api_key: Optional[str] = None
    default_dpi: int = 450
    min_han_ratio: float = DEFAULT_MIN_HAN_RATIO


class SettingsUpdate(BaseModel):
    deepl_api_key: Optional[str] = None
    default_dpi: Optional[int] = None
    min_han_ratio: Optional[float] = None


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
    save_config(config)
    return {"status": "ok"}
