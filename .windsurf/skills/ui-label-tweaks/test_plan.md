# Test plan

- **Caso feliz**:
  - Cambiar una etiqueta concreta.
  - Ejecutar `python main.py`.
  - Cargar un DXF y confirmar visualmente el texto nuevo.

- **Errores**:
  - Si el texto no aparece: revisar que el cambio fue en el componente correcto.
  - Si la UI rompe layout: revertir/ajustar mínimo y volver a validar.

- **Regresión**:
  - Confirmar que el cambio no altera otras secciones o labels no relacionadas.
