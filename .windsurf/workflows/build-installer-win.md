---
description: Build completo Windows (UI + backend) y generación de instalador NSIS.
---

# /build-installer-win

## Objetivo
Generar el instalador `.exe` (NSIS) para Windows con backend embebido.

## Pasos
1. Ejecuta `/build-backend`.
2. Ejecuta el comando esperado del repo:
   - `npm run build:win`
3. Verifica que el instalador se generó (ruta según electron-builder).
4. Instala en una máquina limpia o perfil nuevo y valida:
   - la app abre
   - el backend se lanza desde `process.resourcesPath`
   - el backend solo bindea `127.0.0.1`
   - funciona el flujo `/smoke-test` (al menos render + OCR + export)

## Resultado esperado
- Instalador NSIS `.exe` funcional.
