# Test plan

- **Caso feliz**:
  - Con confirmación del usuario, ejecutar el freeze y generar `requirements.txt`.
  - Verificar que el archivo existe y tiene contenido.

- **Errores**:
  - Si `pip freeze` falla: capturar output y pedir contexto del entorno.
  - Si se ejecuta en el entorno equivocado: detectar y corregir antes de reintentar.

- **Regresión**:
  - Repetir tras instalar/actualizar dependencias (con confirmación) y verificar que el archivo cambia coherentemente.
