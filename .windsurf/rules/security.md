---
trigger: always_on
description: Regla de seguridad (alias) alineada con `AGENTS.md`. Complementa `seguridad-e-higiene.md`.
labels: security,scope
author: Cascade
modified: 2026-01-28
---

# Seguridad

- No leer/sobrescribir `.env` salvo petición explícita.
- No ejecutar comandos destructivos o que muten el entorno sin confirmación.
- Mantener cambios en el alcance solicitado; evitar refactors no pedidos.
- No dejar código sin usar.
- Ver también: `.windsurf/rules/seguridad-e-higiene.md`.
