---
trigger: always_on
description: Reglas de seguridad y alcance para evitar cambios peligrosos o fuera de contexto en este proyecto.
labels: security,scope,repo-hygiene
author: Cascade
modified: 2026-01-26
---

# Seguridad y alcance

- No sobrescribir ni leer archivos `.env` (o variantes) salvo petición explícita.
- No ejecutar comandos destructivos (borrados masivos, formateos, etc.). Si hay duda, pedir confirmación.
- No instalar dependencias ni ejecutar acciones que muten el entorno sin confirmación.
- No crear ramas, carpetas o pantallas nuevas salvo petición explícita.
- Mantener los cambios estrictamente en el alcance solicitado; evitar refactors o cambios de estilo no pedidos.
- No dejar funciones, componentes o variables sin usar.
- No introducir datos falsos o mocks en dev/prod (solo en tests).
