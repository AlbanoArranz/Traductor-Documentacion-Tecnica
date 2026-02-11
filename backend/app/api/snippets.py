"""
API endpoints para la librería de snippets de imagen.
"""

import io
import base64
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image
import numpy as np

from ..config import PROJECTS_DIR, SNIPPETS_DIR, DEFAULT_DPI
from ..db.repository import snippets_repo, projects_repo


router = APIRouter()


class SnippetResponse(BaseModel):
    id: str
    name: str
    width: int
    height: int
    has_transparent: bool
    created_at: str


class CaptureRequest(BaseModel):
    project_id: str
    page_number: int
    bbox: List[float]  # [x1, y1, x2, y2] en píxeles de la imagen original
    name: str
    remove_bg: bool = False


def _remove_white_background(img: Image.Image, threshold: int = 240) -> Image.Image:
    """Convierte píxeles blancos/casi-blancos a transparentes."""
    img = img.convert("RGBA")
    arr = np.array(img)
    # Luminancia de cada píxel (promedio RGB)
    luminance = arr[:, :, :3].mean(axis=2)
    # Píxeles con luminancia > threshold → alpha = 0
    arr[:, :, 3] = np.where(luminance > threshold, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def _find_original_image(project_id: str, page_number: int) -> Optional[str]:
    """Busca la imagen original renderizada de una página."""
    pages_dir = PROJECTS_DIR / project_id / "pages"
    if not pages_dir.exists():
        return None
    # Buscar con cualquier DPI
    for f in pages_dir.iterdir():
        if f.name.startswith(f"{page_number:03d}_original_") and f.suffix == ".png":
            return str(f)
    return None


@router.post("/capture", response_model=SnippetResponse)
async def capture_snippet(data: CaptureRequest):
    """Captura una zona de la página y la guarda como snippet."""
    project = projects_repo.get(data.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    img_path = _find_original_image(data.project_id, data.page_number)
    if not img_path:
        raise HTTPException(status_code=404, detail="Original image not found for this page")
    
    img = Image.open(img_path)
    
    x1, y1, x2, y2 = [int(v) for v in data.bbox]
    x1 = max(0, min(x1, img.width))
    y1 = max(0, min(y1, img.height))
    x2 = max(0, min(x2, img.width))
    y2 = max(0, min(y2, img.height))
    
    if x2 <= x1 or y2 <= y1:
        raise HTTPException(status_code=400, detail="Invalid bounding box")
    
    cropped = img.crop((x1, y1, x2, y2))
    
    snippet = snippets_repo.create(
        name=data.name,
        width=cropped.width,
        height=cropped.height,
        has_transparent=data.remove_bg,
    )
    
    # Guardar imagen original del snippet
    cropped.save(str(SNIPPETS_DIR / f"{snippet.id}.png"), "PNG")
    
    # Guardar versión sin fondo si se solicita
    if data.remove_bg:
        nobg = _remove_white_background(cropped)
        nobg.save(str(SNIPPETS_DIR / f"{snippet.id}_nobg.png"), "PNG")
    
    return SnippetResponse(
        id=snippet.id,
        name=snippet.name,
        width=snippet.width,
        height=snippet.height,
        has_transparent=snippet.has_transparent,
        created_at=snippet.created_at.isoformat(),
    )


@router.post("/upload", response_model=SnippetResponse)
async def upload_snippet(
    file: UploadFile = File(...),
    name: str = Form(...),
    remove_bg: bool = Form(False),
):
    """Sube una imagen externa como snippet."""
    contents = await file.read()
    try:
        img = Image.open(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")
    
    # Convertir a RGB/RGBA
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if remove_bg else "RGB")
    
    snippet = snippets_repo.create(
        name=name,
        width=img.width,
        height=img.height,
        has_transparent=remove_bg,
    )
    
    # Guardar como PNG
    img.save(str(SNIPPETS_DIR / f"{snippet.id}.png"), "PNG")
    
    if remove_bg:
        nobg = _remove_white_background(img)
        nobg.save(str(SNIPPETS_DIR / f"{snippet.id}_nobg.png"), "PNG")
    
    return SnippetResponse(
        id=snippet.id,
        name=snippet.name,
        width=snippet.width,
        height=snippet.height,
        has_transparent=snippet.has_transparent,
        created_at=snippet.created_at.isoformat(),
    )


@router.get("", response_model=List[SnippetResponse])
async def list_snippets():
    """Lista todos los snippets de la librería."""
    snippets = snippets_repo.list_all()
    return [
        SnippetResponse(
            id=s.id,
            name=s.name,
            width=s.width,
            height=s.height,
            has_transparent=s.has_transparent,
            created_at=s.created_at.isoformat(),
        )
        for s in snippets
    ]


@router.get("/{snippet_id}/image")
async def get_snippet_image(snippet_id: str, transparent: bool = False):
    """Sirve la imagen PNG de un snippet."""
    snippet = snippets_repo.get(snippet_id)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    
    if transparent and snippet.has_transparent:
        img_path = SNIPPETS_DIR / f"{snippet_id}_nobg.png"
    else:
        img_path = SNIPPETS_DIR / f"{snippet_id}.png"
    
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Snippet image not found")
    
    return FileResponse(str(img_path), media_type="image/png")


@router.get("/{snippet_id}/base64")
async def get_snippet_base64(snippet_id: str, transparent: bool = False):
    """Devuelve la imagen del snippet como base64 (para insertar como DrawingElement)."""
    snippet = snippets_repo.get(snippet_id)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    
    if transparent and snippet.has_transparent:
        img_path = SNIPPETS_DIR / f"{snippet_id}_nobg.png"
    else:
        img_path = SNIPPETS_DIR / f"{snippet_id}.png"
    
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Snippet image not found")
    
    with open(img_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("ascii")
    
    return {"base64": data, "width": snippet.width, "height": snippet.height}


@router.delete("/{snippet_id}")
async def delete_snippet(snippet_id: str):
    """Elimina un snippet de la librería."""
    deleted = snippets_repo.delete(snippet_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return {"status": "deleted"}
