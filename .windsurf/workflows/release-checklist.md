---
description: Checklist de release (artefactos, verificación, rutas y seguridad).
---

# /release-checklist

## Objetivo
Checklist para preparar una release reproducible.

## Pasos
1. Ejecuta `/smoke-test` en dev.
2. Ejecuta `/build-installer-win`.
3. Verifica invariantes:
   - backend en loopback (`127.0.0.1`)
   - no se rompe el contrato de API
   - datos en `%APPDATA%\\NB7XTranslator\\`
4. Verifica que no se incluyeron secretos:
   - no commitear `.env`
   - no hardcodear API keys
5. Verifica artefactos:
   - instalador NSIS `.exe`
   - versión correcta (según el versionado del repo)

## Resultado esperado
- Release lista para distribuir.
