# Test plan

- **Caso feliz**:
  - Dado un reporte de bloqueo/cuarentena, producir un plan de mitigación seguro y escalonado.

- **Errores**:
  - Si faltan datos (antivirus/mensaje): pedirlos.
  - Si el usuario pide desactivar antivirus globalmente: rechazar y proponer alternativas seguras.

- **Regresión**:
  - Aplicar la guía a 2 antivirus/situaciones distintas y confirmar consistencia de recomendaciones.
