# Test plan

- **Caso feliz**:
  - Confirmar que existe el ejecutable en `dist/`.
  - Ejecutar el empaquetado y comprobar que existe `release/`.
  - Verificar que `release/` contiene:
    - el ejecutable
    - `requirements.txt`

- **Errores**:
  - Si falta el ejecutable en `dist/`: debe pedir ejecutar primero el build.
  - Si falta `requirements.txt`: debe pedir confirmación/pasos para generarlo.
  - Si `release/` ya existe: debe pedir confirmación antes de sobrescribir/borrar.

- **Regresión**:
  - Repetir el empaquetado tras un rebuild y confirmar que el ejecutable en `release/` es el nuevo binario.
