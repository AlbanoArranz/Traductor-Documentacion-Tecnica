---
name: configurar-windsurf-proyecto
description: Inicializa y mantiene la configuración de Windsurf (`.windsurf/`) para un proyecto sin sobrescribir lo existente, creando rules, workflows, hooks y skills faltantes con confirmación explícita.
---

# Configurar Windsurf (proyecto)

## Cuándo usar esta skill
- Cuando el usuario pida “configurar Windsurf”, “bootstrap”, “inicializar `.windsurf`”, “crear rules/workflows/hooks”.
- Cuando entres a un repo nuevo y falten guardrails, reglas o workflows.
- Cuando haya `.windsurf/` parcial y el usuario quiera completarla **sin perder lo que ya existe**.

## Flujo de trabajo
- [ ] Inventariar el estado actual de `.windsurf/` (rules, workflows, hooks, skills).
- [ ] Entender stack y necesidades del proyecto (lenguaje(s), build/test/release, riesgos).
- [ ] Proponer un plan de “deltas”:
  - Create: archivos/carpetas que faltan.
  - Modify: cambios mínimos a existentes (solo si aportan valor).
- [ ] Pedir confirmación para cada bloque (Create/Modify).
- [ ] Aplicar cambios con mínimo impacto (sin refactors ni reestructuras innecesarias).
- [ ] Verificar que no se rompieron hooks/workflows y que el árbol final es coherente.

## Instrucciones

### Inputs (preguntas mínimas)
1. ¿Qué tipo de proyecto es? (Python/Node/Java/Go/etc.)
2. ¿Qué comandos usan para:
   - dev/run
   - tests
   - build
   - release/deploy
3. ¿Quieres reglas “Always On” de seguridad/higiene? (recomendado)
4. ¿Quieres hooks de guardrails para bloquear `.env` y comandos destructivos? (recomendado)

### Planificar (no tocar archivos todavía)
1. Leer `.windsurf/` si existe y listar:
   - `.windsurf/rules/*.md`
   - `.windsurf/workflows/*.md`
   - `.windsurf/hooks.json` y `.windsurf/hooks/*`
   - `.windsurf/skills/*`
2. Detectar huecos típicos:
   - Falta regla de seguridad.
   - Falta guía del lenguaje dominante.
   - Falta workflows comunes.
   - Falta hooks/guardrails.
3. Preparar propuesta de cambios como “deltas” (Create/Modify) con motivo.

### Validar (confirmación explícita)
- Nunca sobrescribir archivos existentes sin confirmación.
- Si un archivo “parecido” existe:
  - Proponer editarlo de forma mínima, o
  - Crear uno nuevo con nombre distinto (sin duplicar lógica).
- Antes de ejecutar cualquier comando (tests/build): pedir confirmación.

### Ejecutar (aplicar cambios)
Aplicar en este orden (con confirmación por bloque):
1. **Rules** (guardrails/alcance/stack).
2. **Hooks** (solo si el usuario quiere enforcement automático).
3. **Workflows** (slash commands para tareas repetibles).
4. **Skills** (solo si faltan habilidades operativas del repo).

### Plantillas / defaults (no inventar)
- Usar las plantillas en `resources/` como base.
- Ajustar nombres, globs y comandos según el repo real.

## Restricciones
- No sobrescribir ni leer archivos `.env` (o variantes) salvo petición explícita.
- No ejecutar comandos destructivos ni instalar dependencias sin confirmación.
- No crear ramas ni reestructurar el repo.
- Mantener cambios estrictamente en el alcance solicitado.

## Recursos
- Test plan: `test_plan.md`
- Intake (preguntas): `resources/intake.md`
- Plantillas rules/workflows/hooks: `resources/templates.md`

## Ejemplos
- Ver `examples/example_usage.md`
