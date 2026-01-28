# Test plan

- **Caso feliz**:
  - Se identifica y clasifica el error (esperado/inesperado, recuperable/irrecuperable).
  - Se propone una estrategia coherente (retry/backoff, fallback, fail fast, etc.).
  - Se añaden verificaciones (tests o checklist reproducible) sin ocultar excepciones.

- **Errores**:
  - Si no hay pasos/logs: debe pedir evidencia y no inventar la causa.
  - Evitar `except Exception:` para ocultar bugs (debe señalarlo como antipatrón).

- **Regresión**:
  - Aplicar el patrón a 2 fallos distintos y confirmar que mantiene consistencia de mensajes/logging.
