# Filosofías y categorías de errores

## Filosofías
- **Excepciones:** interrumpen el flujo. Útiles para errores inesperados o condiciones excepcionales.
- **Result types:** éxito/fallo explícito. Útiles para errores esperados (validación, reglas de negocio).
- **Códigos de error:** estilo C, requieren disciplina.
- **Option/Maybe:** valores opcionales sin semántica de error compleja.

## Cuándo usar cada uno
- **Excepciones:** errores inesperados, IO impredecible, invariantes rotas.
- **Result types:** errores esperados y frecuentes que el caller debe manejar.
- **Crash/Panic:** errores irrecuperables y bugs de programación.

## Categorías
### Recuperables
- Timeouts
- Rate limits
- Entrada inválida
- Recursos no críticos faltantes

### Irrecuperables
- Out of memory
- Stack overflow
- Bugs de programación
