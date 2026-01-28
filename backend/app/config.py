"""
Configuración del backend.
"""

import os
from pathlib import Path

# Ruta base para datos del usuario: %APPDATA%\NB7XTranslator
if os.name == "nt":
    APP_DATA_DIR = Path(os.environ.get("APPDATA", "")) / "NB7XTranslator"
else:
    APP_DATA_DIR = Path.home() / ".nb7x-translator"

# Subdirectorios
PROJECTS_DIR = APP_DATA_DIR / "projects"
JOBS_DIR = APP_DATA_DIR / "jobs"
LOGS_DIR = APP_DATA_DIR / "logs"

# Crear directorios si no existen
for d in [PROJECTS_DIR, JOBS_DIR, LOGS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Archivo de configuración persistente
CONFIG_FILE = APP_DATA_DIR / "config.json"

# DPI por defecto
DEFAULT_DPI = 450
HIGH_DPI = 600

# OCR
CJK_RATIO_THRESHOLD = 0.2
DEFAULT_MIN_HAN_RATIO = 1.0


def get_config() -> dict:
    """Lee la configuración persistente."""
    import json
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return {}
    return {}


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


def save_config(config: dict):
    """Guarda la configuración persistente."""
    import json
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
