---
name: build-exe-pyinstaller
description: Construye un ejecutable Windows (.exe) con PyInstaller. Úsese cuando el usuario mencione compilar, build, PyInstaller o exe.
---

# Build EXE (PyInstaller)

## Cuándo usar esta skill
- El usuario pida "recompilar" el backend o "crear instalador" para Windows.
- Hay que ejecutar `npm run build:backend` y/o `npm run build:win`.
- Se necesita regenerar el backend empaquetado (PyInstaller) porque falta una dependencia.

## Flujo de trabajo (NB7X Translator)
- [ ] Pre-flight: backend venv listo (`backend/venv` con dependencias).
- [ ] (Opcional) Limpiar artefactos previos (`dist-electron/`).
- [ ] Construir backend (`npm run build:backend`).
- [ ] Verificar `_internal/` contiene `rapidocr_onnxruntime`, `onnxruntime`, `app/defaults`.
- [ ] Construir instalador (`npm run build:win`).
- [ ] Verificar `dist-electron/win-unpacked/resources/backend/main/_internal/` y el `.exe` generado.
- [ ] Instalar y hacer smoke test (RapidOCR + DeepL).

## Instrucciones detalladas
1. **Precondiciones**
   - Activar el venv del repo (`.venv`) y asegurarse de que `backend/venv` tiene las dependencias (`pip install -r backend/requirements.txt`).
   - Confirmar que `desktop/scripts/build-backend.cjs` apunta a `backend/venv`.
2. **(Opcional) Limpiar artefactos previos**
   ```powershell
   Remove-Item -Recurse -Force .\dist-electron
   ```
3. **Empaquetar backend**
   ```powershell
   cd desktop
   npm run build:backend
   ```
   - Verificar que el script elimina `backend/main.spec`, ejecuta PyInstaller y muestra `Post-build check: all critical packages present.`
   - Comprobar manualmente:
     ```powershell
     Get-ChildItem .\resources\backend\main\_internal | Select-Object Name
     ```
     Deben existir `rapidocr_onnxruntime/`, `onnxruntime/` y `app/defaults/`.
4. **Construir instalador Windows**
   ```powershell
   npm run build:win
   ```
   - Resultado esperado: `dist-electron/win-unpacked/resources/backend/main/_internal/` contiene las mismas carpetas anteriores y se genera `dist-electron/NB7X Translator Setup <versión>.exe`.
5. **Smoke test obligatorio**
   - Instalar el `.exe` recién generado.
   - Abrir la app instalada, cargar un proyecto y ejecutar:
     - OCR con RapidOCR (verifica que no aparezca "Missing dependency: rapidocr-onnxruntime").
     - Traducción (DeepL) para asegurar que `deepl` está incluido.
     - Opcional: exportar PDF para confirmar todo el pipeline.

## Ejemplos
- Petición: "Necesito recrear el instalador con el backend actualizado"
- Resultado esperado:
  - `desktop/resources/backend/main/_internal` y `dist-electron/win-unpacked/.../_internal` contienen rapidocr + onnxruntime + defaults.
  - El instalador `NB7X Translator Setup*.exe` tiene marca temporal actual.
  - La app instalada ejecuta OCR/DeepL sin errores.

## Restricciones
- No instalar dependencias ni cambiar el entorno sin confirmación explícita.
- No sobrescribir archivos sensibles (p.ej. `.env`) salvo petición explícita.

## Recursos
- Script PyInstaller: `desktop/scripts/build-backend.cjs`
- Configuración electron-builder: `desktop/package.json` (`build`)
- Test plan rápido: ejecutar OCR + traducción + export desde el instalador
- Si Windows bloquea el `.exe`, aplica la skill `antivirus-false-positive-mitigation`.
