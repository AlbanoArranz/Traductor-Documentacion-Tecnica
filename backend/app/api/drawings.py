"""
API endpoints para elementos de dibujo sobre esquemas.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db.repository import drawings_repo, projects_repo


router = APIRouter()


class DrawingElementCreate(BaseModel):
    element_type: str  # 'line', 'rect', 'text', 'image'
    points: List[float]
    stroke_color: Optional[str] = "#000000"
    stroke_width: Optional[int] = 2
    fill_color: Optional[str] = None
    text: Optional[str] = None
    font_size: Optional[int] = 14
    font_family: Optional[str] = "Arial"
    text_color: Optional[str] = "#000000"
    image_data: Optional[str] = None


class DrawingElementUpdate(BaseModel):
    points: Optional[List[float]] = None
    stroke_color: Optional[str] = None
    stroke_width: Optional[int] = None
    fill_color: Optional[str] = None
    text: Optional[str] = None
    font_size: Optional[int] = None
    font_family: Optional[str] = None
    text_color: Optional[str] = None
    image_data: Optional[str] = None


class DrawingElementResponse(BaseModel):
    id: str
    project_id: str
    page_number: int
    element_type: str
    points: List[float]
    stroke_color: str
    stroke_width: int
    fill_color: Optional[str]
    text: Optional[str]
    font_size: int
    font_family: str
    text_color: str
    image_data: Optional[str]
    created_at: str


@router.get("/{page_number}/drawings", response_model=List[DrawingElementResponse])
async def list_drawings(project_id: str, page_number: int):
    """Lista todos los elementos de dibujo de una página."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    drawings = drawings_repo.list_by_page(project_id, page_number)
    return [
        DrawingElementResponse(
            id=d.id,
            project_id=d.project_id,
            page_number=d.page_number,
            element_type=d.element_type,
            points=d.points,
            stroke_color=d.stroke_color,
            stroke_width=d.stroke_width,
            fill_color=d.fill_color,
            text=d.text,
            font_size=d.font_size,
            font_family=d.font_family,
            text_color=d.text_color,
            image_data=d.image_data,
            created_at=d.created_at.isoformat(),
        )
        for d in drawings
    ]


@router.post("/{page_number}/drawings", response_model=DrawingElementResponse)
async def create_drawing(project_id: str, page_number: int, data: DrawingElementCreate):
    """Crea un nuevo elemento de dibujo."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if data.element_type not in ('line', 'rect', 'text', 'image'):
        raise HTTPException(status_code=400, detail="Invalid element_type")
    
    drawing = drawings_repo.create(
        project_id=project_id,
        page_number=page_number,
        element_type=data.element_type,
        points=data.points,
        stroke_color=data.stroke_color,
        stroke_width=data.stroke_width,
        fill_color=data.fill_color,
        text=data.text,
        font_size=data.font_size,
        font_family=data.font_family,
        text_color=data.text_color,
        image_data=data.image_data,
    )
    
    return DrawingElementResponse(
        id=drawing.id,
        project_id=drawing.project_id,
        page_number=drawing.page_number,
        element_type=drawing.element_type,
        points=drawing.points,
        stroke_color=drawing.stroke_color,
        stroke_width=drawing.stroke_width,
        fill_color=drawing.fill_color,
        text=drawing.text,
        font_size=drawing.font_size,
        font_family=drawing.font_family,
        text_color=drawing.text_color,
        image_data=drawing.image_data,
        created_at=drawing.created_at.isoformat(),
    )


@router.patch("/drawings/{drawing_id}", response_model=DrawingElementResponse)
async def update_drawing(project_id: str, drawing_id: str, data: DrawingElementUpdate):
    """Actualiza un elemento de dibujo."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    updates = data.model_dump(exclude_unset=True)
    drawing = drawings_repo.update(drawing_id, project_id, **updates)
    
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")
    
    return DrawingElementResponse(
        id=drawing.id,
        project_id=drawing.project_id,
        page_number=drawing.page_number,
        element_type=drawing.element_type,
        points=drawing.points,
        stroke_color=drawing.stroke_color,
        stroke_width=drawing.stroke_width,
        fill_color=drawing.fill_color,
        text=drawing.text,
        font_size=drawing.font_size,
        font_family=drawing.font_family,
        text_color=drawing.text_color,
        image_data=drawing.image_data,
        created_at=drawing.created_at.isoformat(),
    )


@router.delete("/drawings/{drawing_id}")
async def delete_drawing(project_id: str, drawing_id: str):
    """Elimina un elemento de dibujo."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    deleted = drawings_repo.delete(drawing_id, project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Drawing not found")
    
    return {"status": "deleted"}
