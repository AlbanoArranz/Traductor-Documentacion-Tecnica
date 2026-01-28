# Checklist (manejar-errores)

- [ ] El error está clasificado (esperado/inesperado, recuperable/irrecuperable).
- [ ] La estrategia elegida es consistente (excepción vs Result vs otros).
- [ ] Los mensajes incluyen contexto útil sin secretos.
- [ ] No hay `catch` vacío ni `except Exception` que oculte bugs.
- [ ] Si hay retry/backoff, está limitado y es seguro (idempotencia).
- [ ] No hay logging duplicado (log + relanzar sin criterio).
- [ ] Hay verificación (test o smoke test) que cubre el caso.
