---
name: planificar-implementacion
description: Escribe un plan de implementación detallado antes de tocar código. Úsese cuando haya un diseño/especificación y el trabajo requiera varios pasos.
---

# Planificar implementación

## Overview
Convertir un diseño aprobado en un plan ejecutable por tareas pequeñas, con rutas exactas, pasos concretos y verificación explícita.

## Cuándo usar esta skill
- Cuando exista un diseño aprobado y haya que implementar en varios pasos.
- Cuando el usuario pida "plan", "pasos", "tareas" o "roadmap".

## Flujo de trabajo
- [ ] Confirmar que el diseño está aprobado.
- [ ] Identificar archivos exactos a crear/modificar.
- [ ] Dividir en tareas pequeñas (2-5 min cada una).
- [ ] Para cada tarea: verificación concreta.
- [ ] Guardar el plan en `docs/plans/YYYY-MM-DD-<feature-name>.md`.
- [ ] Proponer orden de ejecución y checkpoints.

## Instrucciones
### Planificar
- Anunciar: "Estoy usando la skill planificar-implementacion para crear el plan".
- Si no hay diseño, pedir primero usar `@skills:idear-diseno`.

### Formato del documento (obligatorio)
El plan debe empezar con este header:

```markdown
# [Feature Name] - Plan de implementación

**Goal:** [1 frase]

**Architecture:** [2-3 frases sobre el enfoque]

**Tech Stack:** [librerías/tecnologías]

---
```

### Validar
- Asegurar que cada tarea tiene:
  - Archivos exactos (paths)
  - Qué se cambia
  - Cómo verificar (comando o checklist)
- Mantener DRY/YAGNI.

### Ejecutar
- Entregar el plan en formato de lista de tareas.
- Cada tarea debe ser una acción (2-5 min) y debe incluir:
  - **Files**: Create/Modify (con rutas exactas)
  - **Steps**: 1..N (pasos concretos)
  - **Verify**: cómo comprobar (comando/expected o checklist)
- Si hay tests en el repo, preferir TDD por tareas:
  - escribir test que falla → correr para ver FAIL → implementar mínimo → correr para ver PASS

### Después del plan
- Escribir el plan final en `docs/plans/YYYY-MM-DD-<feature-name>.md`.
- Si el nombre `<feature-name>` no está claro, pedirlo explícitamente al usuario.

### Handoff de ejecución
Tras guardar el plan, ofrecer cómo ejecutarlo:
- Opción 1: ejecutar tarea por tarea con checkpoints.
- Opción 2: ejecutar por lotes pequeños (con checkpoint entre lotes).

## Restricciones
- No ejecutar comandos destructivos ni instalar dependencias sin confirmación.
- No inventar rutas: si no se conocen, pedir abrir/leer archivos primero.

## Recursos
- Plantilla de plan: `resources/plan_template.md`
- Checklist: `resources/checklist.md`
- Test plan: `test_plan.md`

## Ejemplos
- Ver `examples/example_plan.md`
