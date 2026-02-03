# Ejemplo de uso de git-update

## Escenario típico

Usuario tiene:
- 8 archivos `__pycache__/*.pyc` modificados (que no deberían estar en git)
- 12 archivos de código nuevos/modificados para subir
- Quiere hacer commit y push en un solo paso

## Comando generado

```bash
cd "c:\Users\Lenovo\OneDrive\surface\Programas Pendientes Python\Traducir PDF CHN-ESP" && git rm --cached backend/app/__pycache__/config.cpython-313.pyc backend/app/__pycache__/main.cpython-313.pyc backend/app/api/__pycache__/pages.cpython-313.pyc backend/app/db/__pycache__/models.cpython-313.pyc backend/app/db/__pycache__/repository.cpython-313.pyc backend/app/services/__pycache__/__init__.cpython-313.pyc backend/app/services/__pycache__/compose_service.cpython-313.pyc backend/app/services/__pycache__/ocr_service.cpython-313.pyc && git add backend/app/api/drawings.py backend/app/db/models.py backend/app/db/repository.py backend/app/main.py backend/app/api/pages.py backend/app/services/compose_service.py backend/app/services/ocr_service_paddle.py desktop/src/components/DrawingCanvas.tsx desktop/src/components/DrawingToolbar.tsx desktop/src/components/EditableTextBox.tsx desktop/src/components/Layout.tsx desktop/src/lib/api.ts desktop/src/pages/ProjectPage.tsx docker/ smoke_test_dibujo.py .windsurf/plans/ && git commit -m "feat: Implementar herramientas de dibujo + soporte Docker para VPS" && git push origin main
```

## Output esperado

```
rm 'backend/app/__pycache__/config.cpython-313.pyc'
rm 'backend/app/__pycache__/main.cpython-313.pyc'
...
[main a65474e] feat: Implementar herramientas de dibujo + soporte Docker para VPS
 41 files changed, 1680 insertions(+), 42 deletions(-)
To https://github.com/AlbanoArranz/Traductor-Documentacion-Tecnica.git
   980035f..a65474e  main -> main
```

## Variantes de mensaje de commit

| Tipo de cambio | Mensaje sugerido |
|----------------|------------------|
| Feature nueva | `feat: Añadir sistema de autenticación JWT` |
| Bugfix | `fix: Corregir error en cálculo de bbox` |
| Refactor | `refactor: Simplificar lógica de OCR provider` |
| Docs | `docs: Actualizar README con instrucciones de deploy` |
| Tests | `test: Añadir tests unitarios para compose_service` |
