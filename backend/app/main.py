"""
NB7X Translator - Backend FastAPI
Traduce PDFs de imagen (esquemas eléctricos) de chino (ZH) a español (ES).
"""

import sys
import io

if sys.stdout is not None and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr is not None and hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import projects, pages, glossary, export, jobs, settings, global_glossary, drawings, snippets

# Configuración CORS desde variables de entorno (para Docker/VPS)
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "")
if ALLOWED_ORIGINS:
    # Modo VPS/Docker: usar orígenes específicos
    cors_origins = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]
    cors_regex = None
else:
    # Modo Desktop: permitir localhost loopback (seguro por defecto)
    cors_origins = ["null"]
    cors_regex = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

app = FastAPI(
    title="NB7X Translator API",
    description="API para traducir PDFs de imagen de chino a español",
    version="0.1.0",
)

# CORS middleware configurado según el entorno
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(pages.router, prefix="/projects/{project_id}/pages", tags=["pages"])
app.include_router(glossary.router, prefix="/projects/{project_id}/glossary", tags=["glossary"])
app.include_router(global_glossary.router, prefix="/glossary/global", tags=["glossary-global"])
app.include_router(export.router, prefix="/projects/{project_id}/export", tags=["export"])
app.include_router(jobs.router, prefix="/projects/{project_id}/jobs", tags=["jobs"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(drawings.router, prefix="/projects/{project_id}/pages", tags=["drawings"])
app.include_router(snippets.router, prefix="/snippets", tags=["snippets"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "nb7x-translator"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port)
