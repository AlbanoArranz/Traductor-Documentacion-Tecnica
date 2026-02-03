"""
API endpoints para páginas de un proyecto.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..config import PROJECTS_DIR, DEFAULT_DPI, get_ocr_mode
from ..db.repository import projects_repo, pages_repo, text_regions_repo, glossary_repo, global_glossary_repo, drawings_repo
from ..services import render_service, ocr_provider, compose_service, translate_service

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
    # Nuevos campos para editor visual
    font_family: str = "Arial"
    text_color: str = "#000000"
    bg_color: Optional[str] = None
    text_align: str = "center"
    rotation: float = 0.0
    is_manual: bool = False
    line_height: float = 1.0


class TextRegionUpdate(BaseModel):
    tgt_text: Optional[str] = None
    locked: Optional[bool] = None
    compose_mode: Optional[str] = None
    font_size: Optional[int] = None
    render_order: Optional[int] = None
    # Nuevos campos para editor visual
    font_family: Optional[str] = None
    text_color: Optional[str] = None
    bg_color: Optional[str] = None
    text_align: Optional[str] = None
    rotation: Optional[float] = None
    bbox: Optional[List[float]] = None  # [x1, y1, x2, y2] para mover/resize
    line_height: Optional[float] = None


class TextRegionCreate(BaseModel):
    bbox: List[float]
    src_text: str = ""
    tgt_text: str = ""


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
    use_global_filters: bool = Query(default=True, description="Merge project filters with global filters"),
):
    """Ejecuta OCR en la página y detecta texto chino."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = PROJECTS_DIR / project_id
    image_path = project_dir / "pages" / f"{page_number:03d}_original_{dpi}.png"
    
    if not image_path.exists():
        raise HTTPException(status_code=400, detail="Original image not rendered yet")
    
    # Preparar filtros: proyecto + opcionalmente globales
    from ..config import get_ocr_region_filters
    custom_filters = list(project.ocr_region_filters or [])
    if use_global_filters:
        global_filters = get_ocr_region_filters()
        # Merge: filtros globales primero, luego del proyecto (proyecto tiene prioridad si hay duplicados)
        seen_patterns = {(f.get("mode"), f.get("pattern"), f.get("case_sensitive")) for f in custom_filters}
        for f in global_filters:
            key = (f.get("mode"), f.get("pattern"), f.get("case_sensitive"))
            if key not in seen_patterns:
                custom_filters.append(f)
    
    # Ejecutar OCR con filtros personalizados y tipo de documento
    try:
        regions = ocr_provider.detect_text(
            image_path, 
            dpi, 
            custom_filters=custom_filters if custom_filters else None,
            document_type=project.document_type.value
        )
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
            if get_ocr_mode() == "advanced":
                from ..services import translate_mixed_service

                translations = translate_mixed_service.translate_batch_preserving_non_han(
                    texts_to_translate,
                    glossary_map,
                )
            else:
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
            font_family=getattr(r, 'font_family', 'Arial'),
            text_color=getattr(r, 'text_color', '#000000'),
            bg_color=getattr(r, 'bg_color', None),
            text_align=getattr(r, 'text_align', 'center'),
            rotation=getattr(r, 'rotation', 0.0),
            is_manual=getattr(r, 'is_manual', False),
            line_height=getattr(r, 'line_height', 1.0),
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

    update_fields = {
        "tgt_text": update.tgt_text,
        "locked": update.locked,
        "compose_mode": update.compose_mode,
        "font_size": update.font_size,
        "render_order": update.render_order,
        "font_family": update.font_family,
        "text_color": update.text_color,
        "bg_color": update.bg_color,
        "text_align": update.text_align,
        "rotation": update.rotation,
        "bbox": update.bbox,
        "line_height": update.line_height,
    }
    # Filtrar campos None
    update_fields = {k: v for k, v in update_fields.items() if v is not None}

    updated = text_regions_repo.update(region_id, **update_fields)

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
        font_family=getattr(updated, 'font_family', 'Arial'),
        text_color=getattr(updated, 'text_color', '#000000'),
        bg_color=getattr(updated, 'bg_color', None),
        text_align=getattr(updated, 'text_align', 'center'),
        rotation=getattr(updated, 'rotation', 0.0),
        is_manual=getattr(updated, 'is_manual', False),
        line_height=getattr(updated, 'line_height', 1.0),
    )


@router.post("/{page_number}/text-regions", response_model=TextRegionResponse)
async def create_text_region(
    project_id: str,
    page_number: int,
    data: TextRegionCreate,
):
    """Crea una nueva región de texto manual."""
    import uuid
    from ..db.models import TextRegion
    
    region = TextRegion(
        id=str(uuid.uuid4()),
        project_id=project_id,
        page_number=page_number,
        bbox=data.bbox,
        bbox_normalized=[0, 0, 0, 0],  # Se calculará si es necesario
        src_text=data.src_text,
        tgt_text=data.tgt_text or data.src_text,
        confidence=1.0,
        locked=False,
        needs_review=False,
        compose_mode="patch",
        is_manual=True,
    )
    
    # Guardar en repositorio
    text_regions_repo._get_project_regions(project_id)[region.id] = region
    text_regions_repo._save(project_id)
    
    return TextRegionResponse(
        id=region.id,
        page_number=region.page_number,
        bbox=region.bbox,
        bbox_normalized=region.bbox_normalized,
        src_text=region.src_text,
        tgt_text=region.tgt_text,
        confidence=region.confidence,
        locked=region.locked,
        needs_review=region.needs_review,
        compose_mode=region.compose_mode,
        font_size=region.font_size,
        render_order=region.render_order,
        font_family=region.font_family,
        text_color=region.text_color,
        bg_color=region.bg_color,
        text_align=region.text_align,
        rotation=region.rotation,
        is_manual=region.is_manual,
        line_height=getattr(region, 'line_height', 1.0),
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
    
    # Obtener elementos de dibujo de esta página
    drawings = drawings_repo.list_by_page(project_id, page_number)
    
    # Usar compose_page_with_drawings si hay dibujos, sino compose_page normal
    if drawings:
        output_path = compose_service.compose_page_with_drawings(
            original_path,
            regions,
            drawings,
            project_dir,
            page_number,
            dpi,
        )
    else:
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
