---
name: ui-label-tweaks
description: Ajusta etiquetas y pequeños detalles de layout en la UI del visualizador DXF con cambios mínimos y verificación manual. Úsese cuando el usuario mencione etiquetas, textos, botones, espaciado o nombres como TALADROS/PIEZA/FRESADO LINEAL.
---

# Ajustes de etiquetas UI

## Cuándo usar esta skill
- Cuando el usuario pida cambiar textos de la UI (labels/botones).
- Cuando el usuario pida pequeños ajustes de espaciado/layout.

## Flujo de trabajo
- [ ] Confirmar qué textos cambian y el resultado esperado.
- [ ] Localizar las etiquetas en el archivo autoritativo de UI.
- [ ] Aplicar cambios mínimos (sin refactors).
- [ ] Ejecutar la app y validar visualmente.

## Instrucciones
1. Pide inputs:
   - Texto actual y texto deseado.
   - Si hay restricciones (p.ej. mantener mayúsculas, español, etc.).
2. Implementa cambios:
   - Buscar dónde se renderiza el texto en la UI.
   - Cambiar solo lo necesario.
3. Verifica:
   - Ejecutar `python main.py`.
   - Abrir un DXF y confirmar que el texto/espaciado aparece como se pidió.

## Restricciones
- Cambios mínimos: no reorganizar la UI salvo petición explícita.
- No cambiar convenciones de UI del proyecto salvo petición explícita.

## Recursos
- Checklist: `resources/checklist.md`
- Test plan: `test_plan.md`
