---
description: Smoke test manual end-to-end (crear proyecto, render, OCR, componer, exportar).
---

# /smoke-test

## Objetivo
Validar rápidamente que el flujo principal funciona después de cambios.

## Pasos
1. Inicia backend (dev): `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`.
2. Inicia desktop (dev): `npm run dev` (en `desktop/`).
3. Crea un proyecto y abre un PDF de prueba.
4. Renderiza página 0 en `450` DPI.
5. Ejecuta OCR de página 0 y confirma que aparecen cajas de texto (solo CJK).
6. Traduce y renderiza la página traducida (modo default **PATCH**).
7. Edita 1 región (`tgt_text`), márcala `locked=true`, y vuelve a renderizar para confirmar persistencia.
8. Exporta el PDF final y ábrelo para validar:
   - solo cambió texto chino
   - el resto del esquema se preserva
9. (Opcional) Ejecuta “Procesar todo” (job async) y verifica progreso + finalización.

## Resultado esperado
- UI operativa.
- Backend responde a `/health`.
- Render/OCR/compose/export completan sin errores.
