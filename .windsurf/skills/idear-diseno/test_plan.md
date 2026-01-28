# Test plan

- **Caso feliz**:
  - El agente hace preguntas de clarificación (**1 por mensaje**).
  - El agente propone 2-3 alternativas con trade-offs.
  - El diseño se redacta en secciones (200-300 palabras) y se valida cada sección.
  - Se guarda el documento en `docs/plans/YYYY-MM-DD-<topic>-design.md`.

- **Errores**:
  - Si falta el `<topic>`: debe pedirlo explícitamente.
  - Si el usuario intenta “ir a código” antes de validar diseño: debe frenar y volver a validación.
  - Si faltan requisitos: debe preguntar, no inventar.

- **Regresión**:
  - Repetir con otra feature y confirmar que mantiene el patrón de 1 pregunta por mensaje.
