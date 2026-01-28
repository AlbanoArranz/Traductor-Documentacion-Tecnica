# Checklist - Gestionar repo Git y GitHub

- [ ] Confirmar si el repo es de todo el proyecto o solo subcarpeta.
- [ ] Verificar `.gitignore` (node_modules, venv, builds, logs, .env).
- [ ] Revisar archivos grandes (`git ls-files | findstr /i node_modules` o `git ls-files | findstr /i .exe`).
- [ ] Revisar estado (`git status`) y limpiar caches (`git rm -r --cached ...`).
- [ ] Confirmar rama principal (`main` o `master`) y remotes.
- [ ] Push seguro (sin LFS salvo petición explícita).
- [ ] Verificar en GitHub que el repo refleja el proyecto completo.
