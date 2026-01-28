---
name: dxf-export-validator
description: DEPRECATED: Skill heredada de un proyecto anterior. No usar en este proyecto.
---

# Validar export DXF

 DEPRECATED: Skill heredada de un proyecto anterior. No usar en este proyecto.

## Cuándo usar esta skill
- No usar.

## Flujo de trabajo
- [ ] Conseguir el DXF exportado (o pasos para reproducirlo).
- [ ] Listar capas encontradas y comprobar que siguen la convención.
- [ ] Revisar conteos para detectar duplicados evidentes.
- [ ] Redactar un resumen de evidencia (capas + conteos + notas).

## Instrucciones
1. Genera un DXF exportado desde la UI.
2. Comprueba que existen capas esperadas (ejemplos):
   - `VBoreZ<depth>`
   - `BorderZP<thickness>`
   - `RouterT<tool>Z<depth>`
3. Comprueba que los conteos son razonables:
   - No hay duplicados por parseo de bloques.
4. Registra evidencia:
   - Un resumen corto con nombres de capa y conteos.

## Ejemplos
- Ejemplo (petición): "Valida el último DXF exportado"
- Resultado esperado:
  - Lista de capas encontradas
  - Conteos por capa (o resumen si es grande)
  - Nota explícita si se detectan duplicados

## Restricciones
- No cambiar las convenciones de nombre de capa salvo petición explícita.
- No inventar resultados: si no hay DXF exportado disponible, pedir el archivo o los pasos para reproducir.

## Recursos
- Checklist detallada: `checklist.md`
- Test plan: `test_plan.md`
