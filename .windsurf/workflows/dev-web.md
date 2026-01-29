---
description: Arrancar backend (FastAPI) + frontend web (Vite) en modo dev (Windows).
---

# /dev-web

## Objetivo
Levantar el backend y la UI web en dev de forma reproducible.

## Requisitos previos (solo la primera vez)
1. Backend deps instaladas:
   - En `backend/`: `pip install -r requirements.txt`
2. Frontend deps instaladas:
   - En `desktop/`: `npm install`

## Pasos
1. Arranca el backend (desde la raíz del repo):
   - `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`
   - Verifica health: abre `http://127.0.0.1:8000/health`

   Notas:
   - Si `uvicorn` “no se reconoce”, NO uses `uvicorn ...`. Usa siempre `python -m uvicorn ...`.
   - Si estás usando un venv, ejecuta el comando con ese Python (el del venv).

2. Arranca la UI web (en otra terminal):
   - En `desktop/`: `npm run dev`

3. Abre la UI web:
   - Normalmente: `http://localhost:5173/`

## Parada
- Cierra ambas terminales (Ctrl+C).

## Problemas comunes
- Si `http://127.0.0.1:8000/health` no responde:
  - Asegúrate de que el backend está arrancado y no hay otro proceso ocupando el puerto 8000.
- Si la UI no carga:
  - Asegúrate de haber hecho `npm install` en `desktop/`.
