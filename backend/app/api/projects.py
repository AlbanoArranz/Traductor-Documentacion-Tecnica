"""
API endpoints para proyectos.
"""

import uuid
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel

from ..config import PROJECTS_DIR
from ..db.models import Project, ProjectStatus, DocumentType
from ..db.repository import projects_repo

router = APIRouter()


class ProjectCreate(BaseModel):
    name: str


class ProjectResponse(BaseModel):
    id: str
    name: str
    status: str
    page_count: int
    created_at: str
    document_type: str = "schematic"

    class Config:
        from_attributes = True


@router.post("", response_model=ProjectResponse)
async def create_project(
    name: str,
    file: UploadFile = File(...),
    document_type: str = Query(default="schematic"),
):
    """Crea un nuevo proyecto subiendo un PDF."""
    project_id = str(uuid.uuid4())
    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # Guardar PDF
    pdf_path = project_dir / "src.pdf"
    with open(pdf_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Contar páginas
    from ..services.render_service import count_pages
    page_count = count_pages(pdf_path)
    
    # Validar y convertir document_type
    doc_type = DocumentType.SCHEMATIC
    if document_type == "manual":
        doc_type = DocumentType.MANUAL
    
    # Crear proyecto en DB
    project = projects_repo.create(
        id=project_id,
        name=name,
        page_count=page_count,
        document_type=doc_type,
    )
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        status=project.status.value,
        page_count=project.page_count,
        created_at=project.created_at.isoformat(),
        document_type=project.document_type.value,
    )


@router.get("", response_model=List[ProjectResponse])
async def list_projects():
    """Lista todos los proyectos."""
    projects = projects_repo.list_all()
    return [
        ProjectResponse(
            id=p.id,
            name=p.name,
            status=p.status.value,
            page_count=p.page_count,
            created_at=p.created_at.isoformat(),
        )
        for p in projects
    ]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """Obtiene un proyecto por ID."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(
        id=project.id,
        name=project.name,
        status=project.status.value,
        page_count=project.page_count,
        created_at=project.created_at.isoformat(),
        document_type=project.document_type.value,
    )


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Elimina un proyecto."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Eliminar directorio
    project_dir = PROJECTS_DIR / project_id
    if project_dir.exists():
        shutil.rmtree(project_dir)
    
    # Eliminar de DB
    projects_repo.delete(project_id)
    
    return {"status": "deleted"}


@router.get("/{project_id}/ocr-filters")
async def get_project_ocr_filters(project_id: str):
    """Obtiene los filtros OCR del proyecto."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ocr_region_filters": project.ocr_region_filters or []}


@router.put("/{project_id}/ocr-filters")
async def update_project_ocr_filters(project_id: str, filters: dict):
    """Actualiza los filtros OCR del proyecto."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    ocr_filters = filters.get("ocr_region_filters", [])
    if not isinstance(ocr_filters, list):
        raise HTTPException(status_code=400, detail="ocr_region_filters must be a list")
    
    # Validar cada filtro
    for f in ocr_filters:
        if not isinstance(f, dict):
            raise HTTPException(status_code=400, detail="Each filter must be an object")
        if "mode" not in f or "pattern" not in f:
            raise HTTPException(status_code=400, detail="Each filter must have 'mode' and 'pattern'")
    
    projects_repo.update(project_id, ocr_region_filters=ocr_filters)
    return {"status": "ok", "ocr_region_filters": ocr_filters}
