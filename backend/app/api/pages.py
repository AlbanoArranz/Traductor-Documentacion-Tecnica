"""
API endpoints para páginas de un proyecto.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..config import PROJECTS_DIR, DEFAULT_DPI
from ..db.repository import projects_repo, pages_repo, text_regions_repo, glossary_repo, global_glossary_repo
from ..services import render_service, ocr_service, compose_service, translate_service

router = APIRouter()


class PageResponse(BaseModel):
    page_number: int
    has_original: bool
    has_translated: bool
    text_region_count: int


class TextRegionResponse(BaseModel):
    id: str
    page_number: int
    bbox: List[float]
    bbox_normalized: List[float]
    src_text: str
    tgt_text: Optional[str]
    confidence: float
    locked: bool
    needs_review: bool
    compose_mode: str
    font_size: Optional[int]
    render_order: int


class TextRegionUpdate(BaseModel):
    tgt_text: Optional[str] = None
    locked: Optional[bool] = None
    compose_mode: Optional[str] = None
    font_size: Optional[int] = None
    render_order: Optional[int] = None


@router.get("", response_model=List[PageResponse])
async def list_pages(project_id: str):
    """Lista todas las páginas de un proyecto."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    pages = pages_repo.list_by_project(project_id)
    return [
        PageResponse(
            page_number=p.page_number,
            has_original=p.has_original,
            has_translated=p.has_translated,
            text_region_count=len(text_regions_repo.list_by_page(project_id, p.page_number)),
        )
        for p in pages
    ]


@router.post("/{page_number}/render-original")
async def render_original(
    project_id: str,
    page_number: int,
    dpi: int = Query(default=DEFAULT_DPI),
):
    """Renderiza la página original del PDF a PNG."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if page_number < 0 or page_number >= project.page_count:
        raise HTTPException(status_code=400, detail="Invalid page number")
    
    project_dir = PROJECTS_DIR / project_id
    pdf_path = project_dir / "src.pdf"
    
    output_path = render_service.render_page(pdf_path, page_number, dpi, project_dir)
    
    # Actualizar estado de página
    pages_repo.upsert(project_id, page_number, has_original=True)
    
    return {"status": "ok", "path": str(output_path)}


@router.post("/{page_number}/ocr")
async def run_ocr(
    project_id: str,
    page_number: int,
    dpi: int = Query(default=DEFAULT_DPI),
):
    """Ejecuta OCR en la página y detecta texto chino."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = PROJECTS_DIR / project_id
    image_path = project_dir / "pages" / f"{page_number:03d}_original_{dpi}.png"
    
    if not image_path.exists():
        raise HTTPException(status_code=400, detail="Original image not rendered yet")
    
    # Ejecutar OCR
    try:
        regions = ocr_service.detect_text(image_path, dpi)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # Traducir automáticamente las regiones detectadas
    if regions:
        global_entries = global_glossary_repo.list_all()
        glossary_map = {e.src_term: e.tgt_term for e in global_entries if e.locked}

        local_entries = glossary_repo.list_by_project(project_id)
        for e in local_entries:
            if not e.locked:
                continue
            if e.src_term in glossary_map:
                continue
            glossary_map[e.src_term] = e.tgt_term

        texts_to_translate = []
        translate_indexes = []
        for i, r in enumerate(regions):
            if r.src_text in glossary_map:
                r.tgt_text = glossary_map[r.src_text]
                continue
            texts_to_translate.append(r.src_text)
            translate_indexes.append(i)

        if texts_to_translate:
            translations = translate_service.translate_batch(texts_to_translate)
            for idx, translation in zip(translate_indexes, translations):
                regions[idx].tgt_text = translation
    
    # Guardar regiones con traducciones
    text_regions_repo.replace_for_page(project_id, page_number, regions)
    
    return {"status": "ok", "region_count": len(regions)}


@router.get("/{page_number}/text-regions", response_model=List[TextRegionResponse])
async def get_text_regions(project_id: str, page_number: int):
    """Obtiene las regiones de texto de una página."""
    regions = text_regions_repo.list_by_page(project_id, page_number)
    return [
        TextRegionResponse(
            id=r.id,
            page_number=r.page_number,
            bbox=r.bbox,
            bbox_normalized=r.bbox_normalized,
            src_text=r.src_text,
            tgt_text=r.tgt_text,
            confidence=r.confidence,
            locked=r.locked,
            needs_review=r.needs_review,
            compose_mode=r.compose_mode,
            font_size=r.font_size,
            render_order=getattr(r, 'render_order', 0),
        )
        for r in regions
    ]


@router.delete("/text-regions/{region_id}")
async def delete_text_region(project_id: str, region_id: str):
    """Elimina una región de texto."""
    deleted = text_regions_repo.delete(region_id, project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Text region not found")
    return {"status": "ok"}


@router.patch("/text-regions/{region_id}", response_model=TextRegionResponse)
async def update_text_region(
    project_id: str,
    region_id: str,
    update: TextRegionUpdate,
):
    """Actualiza una región de texto."""
    region = text_regions_repo.get(region_id, project_id)
    if not region:
        raise HTTPException(status_code=404, detail="Text region not found")
    
    updated = text_regions_repo.update(
        region_id,
        tgt_text=update.tgt_text,
        locked=update.locked,
        compose_mode=update.compose_mode,
        font_size=update.font_size,
        render_order=update.render_order,
    )
    
    return TextRegionResponse(
        id=updated.id,
        page_number=updated.page_number,
        bbox=updated.bbox,
        bbox_normalized=updated.bbox_normalized,
        src_text=updated.src_text,
        tgt_text=updated.tgt_text,
        confidence=updated.confidence,
        locked=updated.locked,
        needs_review=updated.needs_review,
        compose_mode=updated.compose_mode,
        font_size=updated.font_size,
        render_order=getattr(updated, 'render_order', 0),
    )


@router.post("/{page_number}/render-translated")
async def render_translated(
    project_id: str,
    page_number: int,
    dpi: int = Query(default=DEFAULT_DPI),
):
    """Renderiza la página traducida (compone texto ES sobre imagen)."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = PROJECTS_DIR / project_id
    original_path = project_dir / "pages" / f"{page_number:03d}_original_{dpi}.png"
    
    if not original_path.exists():
        raise HTTPException(status_code=400, detail="Original image not rendered yet")
    
    regions = text_regions_repo.list_by_page(project_id, page_number)

    global_entries = global_glossary_repo.list_all()
    glossary_map = {e.src_term: e.tgt_term for e in global_entries if e.locked}

    local_entries = glossary_repo.list_by_project(project_id)
    for e in local_entries:
        if not e.locked:
            continue
        if e.src_term in glossary_map:
            continue
        glossary_map[e.src_term] = e.tgt_term

    for r in regions:
        if getattr(r, 'locked', False):
            continue
        if r.src_text in glossary_map:
            r.tgt_text = glossary_map[r.src_text]
    
    output_path = compose_service.compose_page(
        original_path,
        regions,
        project_dir,
        page_number,
        dpi,
    )
    
    # Actualizar estado
    pages_repo.upsert(project_id, page_number, has_translated=True)
    
    return {"status": "ok", "path": str(output_path)}


@router.get("/{page_number}/image")
async def get_page_image(
    project_id: str,
    page_number: int,
    kind: str = Query(default="original"),
    dpi: int = Query(default=DEFAULT_DPI),
):
    """Obtiene la imagen de una página (original o traducida)."""
    project_dir = PROJECTS_DIR / project_id
    
    if kind == "original":
        image_path = project_dir / "pages" / f"{page_number:03d}_original_{dpi}.png"
    elif kind == "translated":
        image_path = project_dir / "pages" / f"{page_number:03d}_translated_{dpi}.png"
    else:
        raise HTTPException(status_code=400, detail="Invalid kind")
    
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(image_path, media_type="image/png")


@router.get("/{page_number}/thumbnail")
async def get_thumbnail(
    project_id: str,
    page_number: int,
    kind: str = Query(default="original"),
):
    """Obtiene el thumbnail de una página."""
    project_dir = PROJECTS_DIR / project_id
    thumb_path = project_dir / "thumbs" / f"{page_number:03d}_{kind}.png"
    
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    return FileResponse(thumb_path, media_type="image/png")
