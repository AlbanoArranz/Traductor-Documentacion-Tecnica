---
trigger: glob
globs: "desktop/**"
description: Reglas para cambios en el desktop (Electron/React) cuando aplique: spawn backend local, rutas de resources y seguridad.
labels: desktop,electron,react,security
author: Cascade
modified: 2026-01-28
---

# Desktop (Electron)

- Si el proyecto incluye Electron: ejecutar el backend local como proceso hijo **o** conectarse a uno ya levantado (elegir uno y evitar duplicidad).
- En producción: localizar recursos con `process.resourcesPath` (no rutas relativas frágiles).
- Backend siempre en `127.0.0.1` y CORS restringido al origen local de la app.
- Rutas Windows: soportar espacios y backslashes; no asumir permisos fuera de `%APPDATA%`.
