# Test plan

- **Caso feliz**:
  - Ejecutar el build y comprobar que se genera el `.exe` en `dist/`.
  - Abrir el `.exe` generado.
  - Confirmar que la app arranca.

- **Errores**:
  - Si falta `main.py`/entrypoint incorrecto: el plan debe pedir confirmar el entrypoint.
  - Si PyInstaller no está instalado: debe pedir confirmación antes de instalar dependencias.
  - Si el antivirus bloquea el `.exe`: el plan debe proponer mitigaciones sin “inventar” resultados.

- **Regresión**:
  - Repetir el build tras un cambio pequeño y confirmar que el `.exe` sigue arrancando.
