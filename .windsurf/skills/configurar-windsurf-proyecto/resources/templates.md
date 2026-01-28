# Plantillas (rules / workflows / hooks)

Estas plantillas son puntos de partida. Ajustar nombres/globs/comandos al repo real.

## 1) Rule: seguridad e higiene (Always On)
```markdown
---
trigger: always_on
description: Reglas de seguridad y alcance para evitar cambios peligrosos o fuera de contexto en este proyecto.
labels: security,scope,repo-hygiene
author: Cascade
modified: YYYY-MM-DD
---

# Seguridad y alcance

- No sobrescribir ni leer archivos `.env` (o variantes) salvo petición explícita.
- No ejecutar comandos destructivos (borrados masivos, formateos, etc.). Si hay duda, pedir confirmación.
- No instalar dependencias ni ejecutar acciones que muten el entorno sin confirmación.
- No crear ramas ni carpetas nuevas salvo petición explícita.
- Mantener los cambios estrictamente en el alcance solicitado.
```

## 2) Rule: guía del lenguaje (Glob)
```markdown
---
trigger: glob
globs: "*.py"
description: Guía breve para cambios en código del proyecto.
labels: language,style,consistency
author: Cascade
modified: YYYY-MM-DD
---

# Guía de código (proyecto)

- Reutilizar patrones existentes antes de introducir nuevas estructuras.
- Mantener cambios mínimos; evitar refactors no pedidos.
- Imports siempre al principio del archivo.
- No dejar código muerto.
```

## 3) Hooks (guardrails)
`hooks.json` mínimo (ejemplo):
```json
{
  "hooks": {
    "pre_read_code": [{"command": "python .windsurf/hooks/guardrails.py", "show_output": true}],
    "pre_write_code": [{"command": "python .windsurf/hooks/guardrails.py", "show_output": true}],
    "pre_run_command": [{"command": "python .windsurf/hooks/guardrails.py", "show_output": true}]
  }
}
```

## 4) Workflow template
```markdown
---
description: [título corto]
---

1. Describe el objetivo.
2. Lista pasos.
// turbo
3. (Opcional) paso seguro auto-ejecutable.
```
