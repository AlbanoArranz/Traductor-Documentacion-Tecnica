# Patrones universales

## Circuit breaker (conceptual)
- Mantener estado: `CLOSED`, `OPEN`, `HALF_OPEN`.
- Contar fallos consecutivos.
- Si supera umbral: pasar a `OPEN` y rechazar llamadas durante un tiempo.
- Tras el timeout: pasar a `HALF_OPEN` y probar una llamada.
- Si funciona: volver a `CLOSED`. Si falla: volver a `OPEN`.

## Error aggregation
- Acumular errores y reportarlos juntos (formularios, validaciones masivas).

## Graceful degradation
- Fallback por prioridad (caché → DB; remoto → local; premium → básico).

## Fail fast
- Validar entrada al inicio.
- Cortar temprano con mensaje claro.
