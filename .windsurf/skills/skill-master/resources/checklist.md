# Checklist de calidad para Skills

## Metadatos (frontmatter)
- `name`:
  - `kebab-case` (minúsculas, números y guiones)
  - <= 64 caracteres
  - Evitar palabras reservadas (p.ej. no usar "anthropic" o "claude" en el nombre)
- `description`:
  - Explica qué hace la Skill y cuándo debe usarse
  - Evitar descripciones vagas ("herramientas" / "utilidades")
  - Mencionar señales de activación (palabras clave y contexto)

## Contenido (SKILL.md)
- Objetivo claro
- Pasos numerados y accionables
- Ejemplos few-shot (entrada → salida)
- Restricciones explícitas (qué NO hacer)

## Progressive disclosure
- Si el `SKILL.md` crece o mezcla casos raros:
  - Mover detalles a `resources/*.md`
  - Referenciar desde `SKILL.md`

## Scripts (si aplica)
- No sobrescribir archivos existentes
- Preferir operaciones deterministas
- Evitar red por defecto
- No hardcodear secretos

## Prueba
- Smoke test mínimo documentado (cómo comprobar que funciona)
- Iterar: si el agente se equivoca, capturar el aprendizaje en el `SKILL.md` o recursos
