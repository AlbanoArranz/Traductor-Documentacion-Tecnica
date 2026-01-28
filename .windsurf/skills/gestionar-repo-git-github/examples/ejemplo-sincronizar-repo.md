# Ejemplo: sincronizar repo local con GitHub

## Entrada
- "Necesito subir todo el proyecto a GitHub y me da error por archivos grandes"

## Salida esperada
- Detectar archivos grandes (`node_modules`, `.exe`).
- Sacarlos del índice con `git rm -r --cached`.
- Reescribir el commit inicial (`git commit --amend --no-edit`).
- Configurar `origin` y hacer `git push -u origin main --force`.
- Verificar que el repo en GitHub no contiene dependencias ni binarios.
