"""
API endpoints para jobs asíncronos.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

from ..db.repository import projects_repo
from ..services import job_service

router = APIRouter()


class JobResponse(BaseModel):
    id: str
    status: str
    progress: float
    current_step: Optional[str]
    error: Optional[str]


@router.post("/render-all/async", response_model=JobResponse)
async def start_render_all(
    project_id: str,
    background_tasks: BackgroundTasks,
):
    """Inicia un job para renderizar todas las páginas (original + OCR + traducción)."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    job = job_service.create_job(project_id, "render_all")
    background_tasks.add_task(job_service.run_render_all, job.id, project_id)
    
    return JobResponse(
        id=job.id,
        status=job.status,
        progress=job.progress,
        current_step=job.current_step,
        error=job.error,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job_status(project_id: str, job_id: str):
    """Obtiene el estado de un job."""
    job = job_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobResponse(
        id=job.id,
        status=job.status,
        progress=job.progress,
        current_step=job.current_step,
        error=job.error,
    )
