"""
API endpoints para proyectos.
"""

import uuid
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from pydantic import BaseModel

import fitz  # PyMuPDF

from ..config import PROJECTS_DIR
from ..db.models import Project, ProjectStatus, DocumentType
from ..db.repository import projects_repo

router = APIRouter()


def _normalize_rotation(rotation: int) -> int:
    if rotation % 90 != 0:
        raise HTTPException(status_code=400, detail="rotation must be multiple of 90")
    rotation = rotation % 360
    if rotation not in (0, 90, 180, 270):
        raise HTTPException(status_code=400, detail="rotation must be one of 0,90,180,270")
    return rotation


def _rotate_pdf_inplace(pdf_path: Path, rotation: int) -> None:
    rotation = _normalize_rotation(rotation)
    if rotation == 0:
        return

    tmp_path = pdf_path.with_suffix(".rotating.pdf")
    doc = fitz.open(str(pdf_path))
    try:
        for page in doc:
            page.set_rotation(rotation)
        doc.save(str(tmp_path), garbage=4, deflate=True)
    finally:
        doc.close()

    tmp_path.replace(pdf_path)


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
    rotation: int = Query(default=0),
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

    # Rotar PDF si aplica (persistente: el PDF rotado es el que se usará en el proyecto)
    try:
        _rotate_pdf_inplace(pdf_path, rotation)
    except HTTPException:
        # Re-raise para devolver 400
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not rotate PDF: {e}")
    
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


@router.post("/preview")
async def preview_pdf(
    file: UploadFile = File(...),
    rotation: int = Query(default=0),
    dpi: int = Query(default=150),
):
    """Genera una previsualización PNG de la primera página aplicando rotación."""
    rotation = _normalize_rotation(rotation)
    if dpi <= 0 or dpi > 600:
        raise HTTPException(status_code=400, detail="dpi must be between 1 and 600")

    content = await file.read()
    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF: {e}")

    try:
        if len(doc) == 0:
            raise HTTPException(status_code=400, detail="PDF has no pages")
        page = doc[0]
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        if rotation:
            # Compatibilidad PyMuPDF: prerotate() (nuevo) / preRotate() (antiguo)
            if hasattr(mat, "prerotate"):
                mat = mat.prerotate(rotation)
            else:
                mat = mat.preRotate(rotation)
        pix = page.get_pixmap(matrix=mat)
        png_bytes = pix.tobytes("png")
    finally:
        doc.close()

    return Response(content=png_bytes, media_type="image/png")


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
