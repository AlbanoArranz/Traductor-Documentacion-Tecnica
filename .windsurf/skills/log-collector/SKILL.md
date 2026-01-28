---
name: log-collector
description: Recopila evidencia (logs, pasos de repro, versiones) para diagnosticar un fallo sin inventar causas. Úsese cuando el usuario mencione error, traceback, crash, logs, no funciona, o fallos en build/export.
---

# Recopilar logs y evidencia

## Cuándo usar esta skill
- Cuando haya un fallo difícil de reproducir.
- Cuando el usuario comparta un error/traceback o un comportamiento extraño.

## Flujo de trabajo
- [ ] Pedir pasos para reproducir (mínimos).
- [ ] Pedir el error exacto (traceback/logs).
- [ ] Capturar contexto: OS, versión Python, modo de ejecución (dev/exe).
- [ ] Redactar un reporte corto con evidencia y próximas hipótesis.

## Instrucciones
1. Pide inputs (sin mezclar):
   - Pasos para reproducir.
   - Error/traceback completo.
   - Qué comando se ejecutó.
2. Normaliza el reporte:
   - **Repro**: pasos enumerados.
   - **Observed**: qué pasa.
   - **Expected**: qué debería pasar.
   - **Logs**: error exacto.
   - **Environment**: OS/Python.
3. Si hace falta ejecutar comandos para recoger info, pedir confirmación explícita.

## Restricciones
- No inventar causas.
- No pedir datos sensibles.
- No ejecutar comandos sin confirmación.

## Recursos
- Checklist: `resources/checklist.md`
- Test plan: `test_plan.md`
