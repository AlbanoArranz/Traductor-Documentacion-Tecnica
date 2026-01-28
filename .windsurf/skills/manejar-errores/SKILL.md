---
name: manejar-errores
description: Implementa patrones robustos de manejo de errores para aplicaciones resilientes. Úsese cuando el usuario pida mejorar fiabilidad, depurar fallos, diseñar mensajes de error, reintentos (retry), circuit breaker o degradación elegante.
---

# Manejar errores

## Cuándo usar esta skill
- Cuando el usuario pida manejo de errores para una feature nueva.
- Cuando el usuario pida depurar un fallo o mejorar la fiabilidad.
- Cuando el usuario mencione retry/backoff, circuit breaker, timeouts, fallos de red.
- Cuando el usuario pida mejores mensajes de error para usuario/desarrollador.

## Flujo de trabajo
- [ ] Identificar el tipo de error: esperado vs inesperado.
- [ ] Clasificar: recuperable vs irrecuperable.
- [ ] Elegir estrategia: excepciones, Result types, códigos, Option/Maybe.
- [ ] Definir contrato de errores (jerarquía/códigos/contexto) y puntos de captura.
- [ ] Añadir contexto y mensajes útiles (sin filtrar secretos).
- [ ] Añadir validación y/o tests que cubran el fallo.
- [ ] Revisar logs para evitar ruido (no log duplicado).

## Instrucciones
### Planificar
- Mapear el flujo donde ocurre el fallo (entrada → validación → lógica → IO → salida).
- Definir qué es "error esperado" (validación, no encontrado, timeout) vs "bug".

### Validar
- Si el error es recuperable:
  - Preferir estrategias con retry/backoff, fallback, degradación elegante.
- Si el error es irrecuperable:
  - Fail fast con mensaje claro.
- No inventar el origen del fallo: si no está claro, pedir logs/pasos.

### Ejecutar
- Implementar un enfoque consistente por módulo:
  - Excepciones personalizadas (Python/TS) para errores esperados.
  - Propagar errores inesperados (no tragarlos).
- Añadir restricciones explícitas:
  - Nunca usar `except Exception:` para ocultar bugs.
  - Nunca usar catches vacíos.
- Para reintentos:
  - Usar backoff exponencial.
  - Limitar intentos.
  - Evitar retry en errores no idempotentes sin confirmación.

## Restricciones
- No ocultar errores: si no se pueden manejar con seguridad, relanzar.
- No incluir secretos en mensajes/logs.
- No añadir dependencias nuevas sin confirmación.
- No hacer llamadas de red desde scripts/ sin confirmación.

## Recursos
- Filosofías y clasificación: `resources/filosofias-y-categorias.md`
- Python: `resources/python.md`
- TypeScript/JavaScript: `resources/typescript.md`
- Patrones universales (retry, circuit breaker, degradación): `resources/patrones-universales.md`
- Mensajes y logging: `resources/mensajes-y-logging.md`
- Checklist: `resources/checklist.md`
- Test plan: `test_plan.md`

## Ejemplos
- Ver `examples/example_usage.md`
