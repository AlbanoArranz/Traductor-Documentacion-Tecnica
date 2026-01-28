# Test plan

- **Caso feliz**:
  - Exportar un DXF desde la UI.
  - Ejecutar la validación y obtener:
    - Lista de capas encontradas.
    - Confirmación de que siguen las convenciones (`VBoreZ`, `BorderZP`, `RouterT`).
    - Señalización explícita si hay duplicados aparentes.

- **Errores**:
  - Si no hay DXF exportado disponible: debe pedir el archivo o pasos para reproducir.
  - Si las capas no siguen convención: debe reportar evidencia (nombres exactos) sin “corregir” automáticamente.

- **Regresión**:
  - Repetir la validación con 2 exports distintos y confirmar consistencia en el reporte.
