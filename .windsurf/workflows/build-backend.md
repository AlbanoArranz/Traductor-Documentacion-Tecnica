---
description: Empaquetar backend Python con PyInstaller (onefolder) y copiarlo a resources del desktop.
---

# /build-backend

## Objetivo
Generar un backend distribuible embebible en la app de escritorio.

## Pasos
1. Verifica que el backend está en `backend/` y que existe un entrypoint de build (script npm o spec de PyInstaller).
2. Ejecuta el comando esperado del repo:
   - `npm run build:backend`
3. Verifica que el backend empaquetado quedó copiado a la ruta de resources del desktop (según scripts del repo), por ejemplo:
   - `desktop/resources/backend/`
4. Valida que el binario/entrypoint del backend arranca en loopback y responde a `GET /health`.

## Resultado esperado
- Carpeta de backend empaquetado lista para ser incluida como `extraResources`.
