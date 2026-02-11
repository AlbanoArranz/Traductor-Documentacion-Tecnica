"""
API endpoints para glosario de un proyecto.
"""

import asyncio
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db.repository import projects_repo, glossary_repo, text_regions_repo, global_glossary_repo

logger = logging.getLogger(__name__)

router = APIRouter()


async def _sync_glossary_async(project_id: str):
    """Sincroniza el glosario de un proyecto con InsForge en background."""
    try:
        from ..services.sync_service import get_sync_service
        from ..db.repository import GlossaryRepository
        sync = get_sync_service()
        glossary_repo = GlossaryRepository()
        entries = glossary_repo.list_by_project(project_id)
        for entry in entries:
            sync.sync_glossary_entry(entry)
        logger.info(f"Glosario sincronizado con InsForge: {project_id}")
    except Exception as e:
        logger.error(f"Error sincronizando glosario {project_id} con InsForge: {e}")


class GlossaryEntry(BaseModel):
    id: Optional[str] = None
    src_term: str
    tgt_term: str
    locked: bool = False


class GlossaryResponse(BaseModel):
    entries: List[GlossaryEntry]


@router.get("", response_model=GlossaryResponse)
async def get_glossary(project_id: str):
    """Obtiene el glosario del proyecto."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    entries = glossary_repo.list_by_project(project_id)
    return GlossaryResponse(
        entries=[
            GlossaryEntry(
                id=e.id,
                src_term=e.src_term,
                tgt_term=e.tgt_term,
                locked=e.locked,
            )
            for e in entries
        ]
    )


@router.put("")
async def update_glossary(project_id: str, glossary: GlossaryResponse):
    """Actualiza el glosario completo del proyecto."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Protección contra borrado accidental: si ya existe glosario con entradas,
    # no permitir sobrescribirlo con una lista vacía sin una acción explícita.
    existing = glossary_repo.list_by_project(project_id)
    if len(glossary.entries) == 0 and len(existing) > 0:
        raise HTTPException(
            status_code=400,
            detail="Refusing to overwrite non-empty glossary with empty entries",
        )

    global_src_terms = {e.src_term for e in global_glossary_repo.list_all()}
    for e in glossary.entries:
        if e.src_term in global_src_terms:
            raise HTTPException(
                status_code=400,
                detail=f"Term already exists in global glossary: {e.src_term}",
            )
    
    glossary_repo.replace_for_project(project_id, glossary.entries)
    
    # Sincronizar con InsForge en background
    asyncio.create_task(_sync_glossary_async(project_id))
    
    return {"status": "ok"}


@router.post("/apply")
async def apply_glossary(project_id: str):
    """
    Aplica el glosario a todas las regiones de texto no bloqueadas.
    Actualiza tgt_text de regiones con src_text que coincida con términos del glosario.
    """
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    global_entries = global_glossary_repo.list_all()
    glossary_map = {e.src_term: e.tgt_term for e in global_entries if e.locked}

    local_entries = glossary_repo.list_by_project(project_id)
    for e in local_entries:
        if not e.locked:
            continue
        if e.src_term in glossary_map:
            continue
        glossary_map[e.src_term] = e.tgt_term
    
    updated_count = 0
    for page_num in range(project.page_count):
        regions = text_regions_repo.list_by_page(project_id, page_num)
        for region in regions:
            if not region.locked and region.src_text in glossary_map:
                text_regions_repo.update(
                    region.id,
                    tgt_text=glossary_map[region.src_text],
                )
                updated_count += 1
    
    return {"status": "ok", "updated_count": updated_count}
