# Test plan

- **Caso feliz**:
  - En un repo con `.windsurf/` parcial, el agente:
    - Lista el inventario actual.
    - Propone crear solo lo que falta.
    - Pide confirmación antes de crear/modificar.
    - Termina con un árbol final coherente.

- **Errores**:
  - Si el usuario no sabe comandos del proyecto: el agente debe pedirlos o inferirlos leyendo README (sin inventar).
  - Si un archivo existe y difiere: el agente debe proponer un diff mínimo, no sobrescribir.
  - Si el usuario pide acciones peligrosas (borrar, instalar, tocar `.env`): debe pedir confirmación explícita o rechazar según guardrails.

- **Regresión**:
  - Ejecutar la skill dos veces seguidas y confirmar que:
    - La segunda vez no intenta recrear lo ya creado.
    - No genera duplicidad de rules/workflows.
