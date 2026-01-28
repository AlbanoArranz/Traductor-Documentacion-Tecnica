---
name: idear-diseno
description: Refina ideas en un diseño validado antes de tocar código. Úsese cuando el usuario pida crear features, modificar comportamiento, diseñar una solución o explorar alternativas.
---

# Idear y diseñar

## Overview
Convertir una idea en un diseño y especificación validados a través de diálogo colaborativo.

## Cuándo usar esta skill
- Cuando el usuario diga "vamos a construir" o pida una feature nueva.
- Cuando el usuario pida cambiar comportamiento o arquitectura.
- Cuando falten requisitos o haya ambigüedad.

## Flujo de trabajo
- [ ] Revisar contexto del proyecto (archivos clave, convenciones, invariantes).
- [ ] Entender la idea con preguntas: 1 por mensaje.
- [ ] Proponer 2-3 enfoques con trade-offs.
- [ ] Presentar el diseño en secciones cortas y validar cada sección.
- [ ] Guardar el diseño validado en `docs/plans/YYYY-MM-DD-<topic>-design.md`.
- [ ] Cerrar con decisiones + riesgos + próximos pasos.

## Instrucciones
### Planificar
- Antes de preguntar, obtener contexto mínimo del proyecto:
  - Revisar `AGENTS.md` si existe.
  - Identificar entrypoints y archivos autoritativos.
  - Revisar el estado actual (archivos relevantes y, si aplica, commits recientes).

### Validar
- Hacer preguntas **una por una** (máximo 1 por mensaje).
- Preferir preguntas de opción múltiple cuando sea posible.
- Si un tema necesita más detalle, dividirlo en varias preguntas (una por mensaje).
- Confirmar propósito, restricciones y criterio de éxito.

### Ejecutar
- Explorar 2-3 alternativas con trade-offs:
  - Recomendación primero.
  - Trade-offs claros.
- Presentar el diseño en secciones de 200-300 palabras.
  - Tras cada sección: preguntar "¿esto va bien hasta aquí?".
- Cobertura mínima del diseño:
  - Arquitectura
  - Componentes
  - Flujo de datos
  - Manejo de errores
  - Testing/validación

### Después del diseño
- Escribir el diseño validado en `docs/plans/YYYY-MM-DD-<topic>-design.md`.
- Si el nombre `<topic>` no está claro, pedirlo explícitamente al usuario.
- (Opcional) Si el repo usa git y el usuario lo desea, hacer commit del documento de diseño.

## Principios
- **Una pregunta por mensaje**.
- **Múltiple choice** cuando sea posible.
- **YAGNI**: eliminar funcionalidades innecesarias del diseño.
- **Validación incremental**: no avanzar sin validar cada sección.
- **Flexibilidad**: si algo no cuadra, volver atrás y aclarar.

## Restricciones
- No tocar código hasta que el diseño esté validado explícitamente.
- No inventar requisitos: si falta información, preguntar.
- Mantener el diseño YAGNI (mínimo viable).

## Recursos
- Plantilla de diseño: `resources/design_template.md`
- Checklist: `resources/checklist.md`
- Test plan: `test_plan.md`

## Ejemplos
- Ver `examples/example_conversation.md`
