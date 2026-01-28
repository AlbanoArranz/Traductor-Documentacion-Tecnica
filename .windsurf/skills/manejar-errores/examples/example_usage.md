# Ejemplo de uso

Usuario: "Al exportar DXF a veces falla con un error raro; quiero que sea más resiliente y que el mensaje sea claro."

Agente (usando manejar-errores):
1. Pide pasos para reproducir y el traceback/log.
2. Clasifica el fallo (recuperable vs irrecuperable).
3. Decide estrategia:
   - Si es IO/archivo: manejar `FileNotFoundError` con mensaje claro y acción.
   - Si es externo: retry con backoff y límite.
4. Añade contexto en el error (code/details) y evita filtrar rutas sensibles.
5. Añade verificación:
   - smoke test manual en `python main.py`.
