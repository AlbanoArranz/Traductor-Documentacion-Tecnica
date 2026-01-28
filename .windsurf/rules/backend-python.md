---
trigger: glob
globs: "backend/**/*.py"
description: Reglas para cambios en el backend FastAPI (Python) del traductor (seguridad loopback, rutas Windows y buenas prácticas).
labels: backend,python,fastapi,security
author: Cascade
modified: 2026-01-28
---

# Backend (Python/FastAPI)

- Mantener el backend **solo en loopback**: bind a `127.0.0.1` (nunca `0.0.0.0`).
- Puerto preferido: **dinámico** (recibido por `PORT` desde Electron) salvo en dev.
- Rutas Windows: usar `pathlib.Path`; soportar espacios y backslashes; persistir en `%APPDATA%\\NB7XTranslator\\`.
- No romper el contrato de API descrito en `AGENTS.md` sin migración.
- Evitar duplicidad: extender servicios/routers existentes en `backend/app/services` y `backend/app/api`.
- Manejo de errores: no silenciar; devolver mensajes claros y loguear fallos relevantes.
- Imports siempre al principio del archivo.
