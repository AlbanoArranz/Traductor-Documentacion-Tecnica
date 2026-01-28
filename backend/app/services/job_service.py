"""
Servicio de jobs asíncronos.
"""

import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import Optional

from app.config import PROJECTS_DIR, JOBS_DIR, DEFAULT_DPI
from app.db.models import Job
from app.db.repository import projects_repo, pages_repo, text_regions_repo
from app.services import render_service, ocr_service, translate_service, compose_service


def _save_job(job: Job):
    """Guarda el estado del job a disco."""
    job_path = JOBS_DIR / f"{job.id}.json"
    with open(job_path, "w", encoding="utf-8") as f:
        json.dump({
            "id": job.id,
            "project_id": job.project_id,
            "job_type": job.job_type,
            "status": job.status,
            "progress": job.progress,
            "current_step": job.current_step,
            "error": job.error,
            "created_at": job.created_at.isoformat(),
        }, f, ensure_ascii=False, indent=2)


def _load_job(job_id: str) -> Optional[Job]:
    """Carga un job desde disco."""
    job_path = JOBS_DIR / f"{job_id}.json"
    if not job_path.exists():
        return None
    with open(job_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        return Job(
            id=data["id"],
            project_id=data["project_id"],
            job_type=data["job_type"],
            status=data["status"],
            progress=data["progress"],
            current_step=data.get("current_step"),
            error=data.get("error"),
            created_at=datetime.fromisoformat(data["created_at"]),
        )


def create_job(project_id: str, job_type: str) -> Job:
    """Crea un nuevo job."""
    job = Job(
        id=str(uuid.uuid4()),
        project_id=project_id,
        job_type=job_type,
    )
    _save_job(job)
    return job


def get_job(job_id: str) -> Optional[Job]:
    """Obtiene un job por ID."""
    return _load_job(job_id)


def run_render_all(job_id: str, project_id: str):
    """
    Ejecuta el job de renderizar todas las páginas.
    Pasos: render original → OCR → traducir → compose
    """
    job = _load_job(job_id)
    if not job:
        return
    
    project = projects_repo.get(project_id)
    if not project:
        job.status = "error"
        job.error = "Project not found"
        _save_job(job)
        return
    
    try:
        job.status = "running"
        _save_job(job)
        
        project_dir = PROJECTS_DIR / project_id
        pdf_path = project_dir / "src.pdf"
        total_pages = project.page_count
        dpi = DEFAULT_DPI
        
        for page_num in range(total_pages):
            # Progreso: cada página tiene 4 pasos
            base_progress = page_num / total_pages
            
            # 1. Render original
            job.current_step = f"Renderizando página {page_num + 1}/{total_pages}"
            job.progress = base_progress + 0.25 / total_pages
            _save_job(job)
            
            render_service.render_page(pdf_path, page_num, dpi, project_dir)
            pages_repo.upsert(project_id, page_num, has_original=True)
            
            # 2. OCR
            job.current_step = f"OCR página {page_num + 1}/{total_pages}"
            job.progress = base_progress + 0.5 / total_pages
            _save_job(job)
            
            image_path = project_dir / "pages" / f"{page_num:03d}_original_{dpi}.png"
            regions = ocr_service.detect_text(image_path, dpi)
            
            # 3. Traducir
            job.current_step = f"Traduciendo página {page_num + 1}/{total_pages}"
            job.progress = base_progress + 0.75 / total_pages
            _save_job(job)
            
            if regions:
                texts = [r.src_text for r in regions]
                translations = translate_service.translate_batch(texts)
                for region, translation in zip(regions, translations):
                    region.tgt_text = translation
            
            text_regions_repo.replace_for_page(project_id, page_num, regions)
            
            # 4. Compose
            job.current_step = f"Componiendo página {page_num + 1}/{total_pages}"
            job.progress = base_progress + 1.0 / total_pages
            _save_job(job)
            
            compose_service.compose_page(
                image_path,
                regions,
                project_dir,
                page_num,
                dpi,
            )
            pages_repo.upsert(project_id, page_num, has_translated=True)
        
        job.status = "completed"
        job.progress = 1.0
        job.current_step = "Completado"
        _save_job(job)
    
    except Exception as e:
        job.status = "error"
        job.error = str(e)
        _save_job(job)
