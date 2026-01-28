---
name: gestionar-repo-git-github
description: Define el flujo para sincronizar cambios entre repositorios Git locales y GitHub, incluyendo validaciones de tamaño, .gitignore y push seguro.
---

 # Gestionar repo Git y GitHub

## Cuándo usar esta skill
- Cuando el usuario pide crear o sincronizar un repositorio GitHub para este proyecto.
- Cuando hay errores de push por archivos grandes (`node_modules`, `.exe`, etc.).
- Cuando se necesita limpiar el historial o ajustar `.gitignore` antes de subir.

## Flujo de trabajo
- [ ] Confirmar alcance del repo (todo el proyecto vs subcarpeta).
- [ ] Verificar `.gitignore` y excluir `node_modules`, `venv`, `__pycache__`, `dist`, `logs`.
- [ ] Detectar archivos grandes y sacarlos del índice.
- [ ] Reescribir el commit inicial si es necesario.
- [ ] Configurar `origin` y hacer push seguro.
- [ ] Verificar en GitHub que el repo refleja el proyecto completo.

## Instrucciones
1. **Diagnosticar**
   - Ejecutar `git status` y `git ls-files | findstr /i node_modules` para validar que no se versiona basura.
   - Si hay errores de tamaño, localizar los archivos (`git ls-files | findstr /i .exe`).
2. **Limpiar el índice**
   - Usar `git rm -r --cached <ruta>` para sacar directorios grandes sin borrarlos del disco.
   - Verificar con `git status`.
3. **Reescribir el commit**
   - Si hay un único commit, usar `git commit --amend --no-edit`.
   - Si hay varios, usar `git rebase -i` (solo con confirmación).
4. **Preparar el remoto**
   - Configurar `origin` con HTTPS o SSH.
   - Renombrar rama principal a `main` si aplica.
5. **Push seguro**
   - `git push -u origin main`.
   - Si se reescribió el commit, usar `--force`.
6. **Verificación**
   - Confirmar en GitHub que no aparecen `node_modules` ni bins grandes.

## Restricciones
- No hardcodear secretos.
- No borrar archivos del sistema (usar `--cached`).
- No instalar Git LFS salvo petición explícita.
- No reescribir historial si ya fue compartido con terceros (pedir confirmación).

## Recursos
- Checklist: `resources/checklist.md`
- Ejemplos: `examples/ejemplo-sincronizar-repo.md`
- Script (opcional): `scripts/scan_large_files.py`
- Test plan: `test_plan.md`
