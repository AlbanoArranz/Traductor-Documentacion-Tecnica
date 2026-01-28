---
trigger: glob
globs: "backend/**/*.py"
description: Guía breve para cambios en código Python del proyecto (consistencia y cambios mínimos).
labels: python,style,consistency
author: Cascade
modified: 2026-01-26
---

# Guía Python (proyecto)

- Reutilizar patrones existentes antes de introducir nuevas estructuras.
- Mantener los archivos por debajo de ~300 líneas; si crece, refactorizar (sin crear duplicidad).
- Imports siempre al principio del archivo.
- No agregar ni eliminar comentarios/documentación salvo petición explícita.
- Evitar código muerto: no dejar variables/funciones sin usar.
- Si se cambia lógica central (selección/asignación/exportación), revisar puntos de llamada afectados.
