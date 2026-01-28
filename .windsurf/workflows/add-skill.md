---
description: Guía para añadir una nueva Skill usando skill-master.
---

# /add-skill

## Objetivo
Crear una Skill nueva con el generador `skill-master` (sin escribirla a mano).

## Pasos
1. Define:
   - nombre (kebab-case)
   - descripción corta
   - cuándo debe usarse
2. Ejecuta `skill-master` según las convenciones del repo para generar:
   - `.windsurf/skills/<skill-name>/SKILL.md`
   - archivos de soporte dentro de la carpeta
3. Revisa que la skill:
   - no duplica lógica existente
   - tiene pasos verificables
   - no requiere secrets
4. Añade la skill a los flujos que correspondan (workflows o documentación interna) si aplica.

## Resultado esperado
- Skill creada y usable vía `@<skill-name>`.
