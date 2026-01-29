"""
NB7X Translator - Backend FastAPI
Traduce PDFs de imagen (esquemas eléctricos) de chino (ZH) a español (ES).
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import projects, pages, glossary, export, jobs, settings, global_glossary

app = FastAPI(
    title="NB7X Translator API",
    description="API para traducir PDFs de imagen de chino a español",
    version="0.1.0",
)

# CORS: permitir cualquier localhost (seguridad loopback)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
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


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "nb7x-translator"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="127.0.0.1", port=port)
