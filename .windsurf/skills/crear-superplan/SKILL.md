---
name: crear-superplan
description: Genera un superplan inspirado en el plan "snippet editor v2" cuando se solicitan cambios grandes o multifase en la app, guiando fases, verificaciones y entregables.
---

# Crear Superplan

## Cuándo usar esta skill
- El usuario pide “super plan”, “plan maestro” o “plan por fases” para cambios amplios.
- Se menciona el plan `snippet-editor-v2-15a5e6` o necesidad de versionado/propagación de snippets.
- Cambios impactan múltiples capas (backend, frontend, OCR, snippets) y requieren QA por fase.

## Flujo de trabajo
1. Confirmar que la solicitud es de tipo proyecto grande (no bug aislado).
2. Recoger alcance: módulos afectados, expectativas de versión, deadlines.
3. Abrir `resources/snippet-editor-reference.md` y extraer fases relevantes.
4. Adaptar/crear fases para el nuevo alcance (objetivo, cambios, verificación).
5. Añadir sección de principios/reglas y checklist QA general.
6. Presentar el superplan en Markdown con secciones claras y checklists.
7. Validar con el usuario antes de pasar a ejecución.

## Instrucciones
- Mantén cada fase autocontenida: **Objetivo**, **Cambios**, **Verificación**.
- Cita explícitamente cuando una fase proviene del plan de referencia.
- Integra pasos de QA (pytest, npm run build, pruebas manuales) en cada fase.
- Si el alcance incluye nuevas áreas, añade fases adicionales siguiendo el mismo patrón incremental.
- Usa tablas para riesgos/mitigaciones cuando existan.
- Limita el superplan a ≤ 500 líneas; si excede, crear anexos referenciados.

## Restricciones
- No modificar ni simplificar el CaptureDialog en los planes (regla base del plan de referencia).
- No introducir nuevas tecnologías/patrones sin confirmación del usuario.
- No ejecutar código ni comandos: esta skill solo produce planes.
- No sobrescribir archivos fuera de `.windsurf/skills/crear-superplan/`.

## Recursos
- Plan completo de referencia: `resources/snippet-editor-reference.md`
