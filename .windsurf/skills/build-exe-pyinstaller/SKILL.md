---
name: build-exe-pyinstaller
description: Construye un ejecutable Windows (.exe) con PyInstaller. Úsese cuando el usuario mencione compilar, build, PyInstaller o exe.
---

# Build EXE (PyInstaller)

## Cuándo usar esta skill
- Cuando el usuario pida "recompilar" o "generar" el ejecutable.
- Cuando el usuario mencione PyInstaller o el ejecutable generado en `dist/`.

## Flujo de trabajo
- [ ] Confirmar que `main.py` es el entrypoint.
- [ ] Ejecutar el comando de build.
- [ ] Verificar que existe el `.exe` en `dist/`.
- [ ] Hacer smoke test: abrir el `.exe` y comprobar que la app arranca.

## Instrucciones
1. Verifica precondiciones:
   - Dependencias instaladas.
   - `main.py` es el entrypoint.
2. Ejecuta el build onefile:

```bash
pyinstaller --onefile --noconsole --name AppName main.py
```

3. Verifica el artefacto:
   - `dist/AppName.exe`
4. Smoke test:
   - Ejecuta el `.exe` generado y confirma que arranca.

## Ejemplos
- Ejemplo (petición): "Recompila el ejecutable para Windows"
- Resultado esperado:
  - Existe el `.exe` en `dist/`
  - Al abrirlo, la app arranca

## Restricciones
- No instalar dependencias ni cambiar el entorno sin confirmación explícita.
- No sobrescribir archivos sensibles (p.ej. `.env`) salvo petición explícita.

## Recursos
- Comando de build: `commands.md`
- Test plan: `test_plan.md`
- Si el antivirus marca el exe, considerar firmar el binario o agregar una exclusión para testing.
