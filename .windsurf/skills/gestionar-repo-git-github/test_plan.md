# Test plan

- **Caso feliz**: repo limpio, `.gitignore` correcto, `git push -u origin main` exitoso.
- **Errores**: push falla por archivo grande → limpiar índice y `--amend` → push con `--force`.
- **Regresión**: verificar que `node_modules`, `venv`, `__pycache__` no aparecen en GitHub tras el push.
