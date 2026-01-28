# Mensajes y logging

## Mensajes útiles
- Qué pasó (síntoma).
- Dónde pasó (contexto mínimo: módulo/operación).
- Por qué pudo pasar (si se conoce).
- Qué hacer ahora (acción recomendada).

## Preservar contexto
- Incluir códigos (`code`) y metadatos (`details`) cuando sea útil.
- En errores inesperados: preservar stack trace.

## Logging sin ruido
- Error esperado (validación/no encontrado): no spamear logs.
- Error inesperado: log con nivel error.
- Evitar doble logging: si ya se loguea en capa inferior, no volver a loguear en cada capa.

## No tragar errores
- Evitar catches vacíos.
- Si se captura:
  - O bien se maneja (fallback/retry) y se devuelve resultado válido.
  - O bien se relanza.
