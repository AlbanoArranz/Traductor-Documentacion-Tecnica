---
trigger: manual
description: Reglas e invariantes de build/release (no romper scripts existentes). Complementa `build-y-release.md`.
labels: build,release,packaging
author: Cascade
modified: 2026-01-28
---

# Build / Release

- Mantener el flujo de build actual salvo petición explícita.
- Si hay backend Python embebido: preferir empaquetado **onefolder** y copia como recurso de la app.
- Si existe workflow, preferirlo antes que comandos ad-hoc.
- Ver también: `.windsurf/rules/build-y-release.md`.
