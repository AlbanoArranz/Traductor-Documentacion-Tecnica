"""
Servicio de jobs asíncronos.
"""

import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import Optional

from ..config import PROJECTS_DIR, JOBS_DIR, DEFAULT_DPI, get_config
from ..db.models import Job
from ..db.repository import projects_repo, pages_repo, text_regions_repo, glossary_repo, global_glossary_repo
from ..services import render_service, ocr_service, translate_service, compose_service


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


def run_render_all(job_id: str, project_id: str, dpi: int = None):
    """
    Ejecuta el job de procesar todas las páginas.
    Versión simplificada que funciona exactamente como el flujo manual.
    """
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
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
        
        # DPI: si viene del endpoint, usarlo. Si no, fallback a config.
        if dpi is None:
            config = get_config()
            try:
                dpi = int(config.get("default_dpi", DEFAULT_DPI))
            except Exception:
                dpi = DEFAULT_DPI

        logger.info(f"[JOB] Iniciando con DPI={dpi}, páginas={project.page_count}")
        
        project_dir = PROJECTS_DIR / project_id
        pdf_path = project_dir / "src.pdf"
        total_pages = project.page_count
        
        # Preparar glosario (igual que el flujo manual)
        global_entries = global_glossary_repo.list_all()
        glossary_map = {e.src_term: e.tgt_term for e in global_entries if e.locked}
        local_entries = glossary_repo.list_by_project(project_id)
        for e in local_entries:
            if e.locked and e.src_term not in glossary_map:
                glossary_map[e.src_term] = e.tgt_term
        
        logger.info(f"[JOB] Glosario: {len(glossary_map)} términos")
        
        # Preparar filtros OCR (igual que el flujo manual)
        from ..config import get_ocr_region_filters
        custom_filters = list(project.ocr_region_filters or [])
        global_filters = get_ocr_region_filters()
        seen_patterns = {(f.get("mode"), f.get("pattern"), f.get("case_sensitive")) for f in custom_filters}
        for f in global_filters:
            key = (f.get("mode"), f.get("pattern"), f.get("case_sensitive"))
            if key not in seen_patterns:
                custom_filters.append(f)
        
        logger.info(f"[JOB] Filtros OCR: {len(custom_filters)}")
        
        # Procesar cada página como en el flujo manual
        for page_num in range(total_pages):
            logger.info(f"[JOB] === Página {page_num + 1}/{total_pages} ===")
            
            # FASE 1: Renderizar página (igual que endpoint render_original)
            job.current_step = f"Renderizando página {page_num + 1}/{total_pages}..."
            job.progress = (page_num / total_pages) * 0.2
            _save_job(job)
            
            image_path = project_dir / "pages" / f"{page_num:03d}_original_{dpi}.png"
            if image_path.exists():
                logger.info(f"[JOB] Render skip (ya existe): {image_path}")
            else:
                image_path = render_service.render_page(pdf_path, page_num, dpi, project_dir)
            pages_repo.upsert(project_id, page_num, has_original=True)
            logger.info(f"[JOB] Renderizado: {image_path}")
            
            # FASE 2: OCR (igual que endpoint run_ocr)
            job.current_step = f"OCR página {page_num + 1}/{total_pages}..."
            job.progress = 0.2 + (page_num / total_pages) * 0.3
            _save_job(job)
            
            if custom_filters:
                regions = ocr_service.detect_text(image_path, dpi, custom_filters=custom_filters)
            else:
                regions = ocr_service.detect_text(image_path, dpi)
            
            logger.info(f"[JOB] OCR detectó {len(regions)} regiones")
            
            # Traducir regiones detectadas (igual que endpoint run_ocr)
            if regions:
                texts_to_translate = []
                translate_indexes = []
                for i, r in enumerate(regions):
                    if r.src_text in glossary_map:
                        r.tgt_text = glossary_map[r.src_text]
                    else:
                        texts_to_translate.append(r.src_text)
                        translate_indexes.append(i)
                
                logger.info(f"[JOB] Traduciendo {len(texts_to_translate)} textos (glosario aplicó a {len(regions) - len(texts_to_translate)})")
                
                if texts_to_translate:
                    translations = translate_service.translate_batch(texts_to_translate)
                    for idx, translation in zip(translate_indexes, translations):
                        regions[idx].tgt_text = translation
                
                # Guardar regiones con traducciones
                text_regions_repo.replace_for_page(project_id, page_num, regions)
                logger.info(f"[JOB] Guardadas {len(regions)} regiones")
            
            # FASE 3: Componer (igual que endpoint render_translated)
            job.current_step = f"Componiendo página {page_num + 1}/{total_pages}..."
            job.progress = 0.5 + (page_num / total_pages) * 0.5
            _save_job(job)
            
            # Recargar regiones desde repo (como hace el endpoint)
            regions_loaded = text_regions_repo.list_by_page(project_id, page_num)
            logger.info(f"[JOB] Recargadas {len(regions_loaded)} regiones para composición")
            
            # Verificar que tienen tgt_text
            for r in regions_loaded[:3]:  # Solo primeras 3 para no saturar log
                logger.info(f"[JOB]   - bbox={r.bbox[:2]}, src='{r.src_text[:20]}...', tgt='{(r.tgt_text or '')[:20]}...'")
            
            # Aplicar glosario a regiones no bloqueadas
            for r in regions_loaded:
                if not getattr(r, 'locked', False) and r.src_text in glossary_map:
                    r.tgt_text = glossary_map[r.src_text]
            
            # Componer página
            compose_service.compose_page(image_path, regions_loaded, project_dir, page_num, dpi)
            pages_repo.upsert(project_id, page_num, has_translated=True)
            logger.info(f"[JOB] Composición completada")
        
        job.status = "completed"
        job.progress = 1.0
        job.current_step = "Completado"
        _save_job(job)
        logger.info(f"[JOB] === JOB COMPLETADO ===")
    
    except Exception as e:
        import traceback
        logger.error(f"[JOB] ERROR: {e}")
        logger.error(traceback.format_exc())
        job.status = "error"
        job.error = str(e)
        _save_job(job)
