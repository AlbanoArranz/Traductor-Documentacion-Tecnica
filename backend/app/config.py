"""
Configuración del backend.
"""

import os
import json
import shutil
import contextvars
import contextlib
from pathlib import Path

from typing import Any, Dict, List

# Ruta base para datos del usuario: %APPDATA%\NB7XTranslator
if os.name == "nt":
    APP_DATA_DIR = Path(os.environ.get("APPDATA", "")) / "NB7XTranslator"
else:
    APP_DATA_DIR = Path.home() / ".nb7x-translator"

# Subdirectorios
PROJECTS_DIR = APP_DATA_DIR / "projects"
JOBS_DIR = APP_DATA_DIR / "jobs"
LOGS_DIR = APP_DATA_DIR / "logs"
SNIPPETS_DIR = APP_DATA_DIR / "snippets"

# Crear directorios si no existen
for d in [PROJECTS_DIR, JOBS_DIR, LOGS_DIR, SNIPPETS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Archivo de configuración persistente
CONFIG_FILE = APP_DATA_DIR / "config.json"

# Glosario global (para todos los proyectos)
GLOSSARY_GLOBAL_FILE = APP_DATA_DIR / "glossary_global.json"

# --- Seed: copiar defaults en primera ejecución ---
import sys as _sys
_DEFAULTS_DIR = Path(getattr(_sys, "_MEIPASS", Path(__file__).parent)) / "defaults"

def _seed_defaults():
    """Copia archivos seed a %APPDATA% solo si no existen."""
    if not _DEFAULTS_DIR.exists():
        return
    # config.json con filtros OCR
    if not CONFIG_FILE.exists():
        seed_filters = _DEFAULTS_DIR / "ocr_filters_seed.json"
        if seed_filters.exists():
            try:
                with open(seed_filters, "r", encoding="utf-8") as f:
                    filters = json.load(f)
                initial_config = {
                    "default_dpi": 450,
                    "min_han_ratio": 0.0,
                    "ocr_engine": "rapidocr",
                    "ocr_mode": "advanced",
                    "min_ocr_confidence": 0.55,
                    "ocr_enable_label_recheck": True,
                    "ocr_recheck_max_regions_per_page": 200,
                    "ocr_region_filters": filters,
                    "sync_enabled": True,
                }
                with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                    json.dump(initial_config, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
    # glossary_global.json
    if not GLOSSARY_GLOBAL_FILE.exists():
        seed_glossary = _DEFAULTS_DIR / "glossary_global_seed.json"
        if seed_glossary.exists():
            try:
                shutil.copy2(seed_glossary, GLOSSARY_GLOBAL_FILE)
            except Exception:
                pass

_seed_defaults()

# DPI por defecto
DEFAULT_DPI = 450
HIGH_DPI = 600

# OCR
CJK_RATIO_THRESHOLD = 0.2
DEFAULT_MIN_HAN_RATIO = 0.0
DEFAULT_OCR_ENGINE = "rapidocr"
DEFAULT_OCR_MODE = "advanced"
DEFAULT_MIN_OCR_CONFIDENCE = 0.55
# Recheck (EasyOCR EN) puede ayudar a reducir falsos positivos.
DEFAULT_OCR_ENABLE_LABEL_RECHECK = True
DEFAULT_OCR_RECHECK_MAX_REGIONS_PER_PAGE = 200

# InsForge
DEFAULT_SYNC_ENABLED = True


_CONFIG_OVERRIDE: contextvars.ContextVar[Dict[str, Any] | None] = contextvars.ContextVar(
    "NB7X_CONFIG_OVERRIDE",
    default=None,
)


def get_config() -> dict:
    """Lee la configuración persistente."""
    import json
    override = _CONFIG_OVERRIDE.get()
    if override is not None:
        return dict(override)
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return {}
    return {}


@contextlib.contextmanager
def use_config_snapshot(snapshot: Dict[str, Any]):
    token = _CONFIG_OVERRIDE.set(dict(snapshot or {}))
    try:
        yield
    finally:
        _CONFIG_OVERRIDE.reset(token)


def get_ocr_region_filters() -> List[Dict[str, Any]]:
    config = get_config()
    value = config.get("ocr_region_filters", [])
    if not isinstance(value, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        mode = str(item.get("mode", "contains"))
        if mode not in {"contains", "starts", "ends", "regex"}:
            continue
        pattern = str(item.get("pattern", ""))
        if not pattern:
            continue
        out.append(
            {
                "mode": mode,
                "pattern": pattern,
                "case_sensitive": bool(item.get("case_sensitive", False)),
            }
        )
    return out


def get_min_han_ratio() -> float:
    """Obtiene el ratio mínimo de caracteres Han para aceptar una región OCR."""
    config = get_config()
    try:
        value = float(config.get("min_han_ratio", DEFAULT_MIN_HAN_RATIO))
    except Exception:
        value = DEFAULT_MIN_HAN_RATIO
    if value < 0.0:
        return 0.0
    if value > 1.0:
        return 1.0
    return value


def get_ocr_engine() -> str:
    """Obtiene el motor OCR a usar (easyocr, paddleocr o rapidocr)."""
    config = get_config()
    value = str(config.get("ocr_engine", DEFAULT_OCR_ENGINE) or DEFAULT_OCR_ENGINE).lower()
    if value not in {"easyocr", "paddleocr", "rapidocr"}:
        return DEFAULT_OCR_ENGINE
    return value


def get_ocr_mode() -> str:
    """Obtiene el modo OCR (basic o advanced)."""
    config = get_config()
    value = str(config.get("ocr_mode", DEFAULT_OCR_MODE) or DEFAULT_OCR_MODE).lower()
    if value not in {"basic", "advanced"}:
        return DEFAULT_OCR_MODE
    return value


def get_min_ocr_confidence() -> float:
    config = get_config()
    try:
        value = float(config.get("min_ocr_confidence", DEFAULT_MIN_OCR_CONFIDENCE))
    except Exception:
        value = DEFAULT_MIN_OCR_CONFIDENCE
    if value < 0.0:
        return 0.0
    if value > 1.0:
        return 1.0
    return value


def get_ocr_enable_label_recheck() -> bool:
    config = get_config()
    return bool(config.get("ocr_enable_label_recheck", DEFAULT_OCR_ENABLE_LABEL_RECHECK))


def get_ocr_recheck_max_regions_per_page() -> int:
    config = get_config()
    try:
        value = int(config.get("ocr_recheck_max_regions_per_page", DEFAULT_OCR_RECHECK_MAX_REGIONS_PER_PAGE))
    except Exception:
        value = DEFAULT_OCR_RECHECK_MAX_REGIONS_PER_PAGE
    if value < 0:
        return 0
    return value


def get_sync_enabled() -> bool:
    """Obtiene si la sincronización con InsForge está habilitada."""
    config = get_config()
    return bool(config.get("sync_enabled", DEFAULT_SYNC_ENABLED))


def save_config(config: dict):
    """Guarda la configuración persistente."""
    import json
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
