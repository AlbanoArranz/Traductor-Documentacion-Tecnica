"""
API endpoints para exportar PDF final.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.config import PROJECTS_DIR, DEFAULT_DPI
from app.db.repository import projects_repo
from app.services import export_service

router = APIRouter()


@router.post("/pdf")
async def export_pdf(
    project_id: str,
    dpi: int = Query(default=DEFAULT_DPI),
):
    """Genera el PDF final con las páginas traducidas."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = PROJECTS_DIR / project_id
    
    output_path = export_service.export_pdf(
        project_dir,
        project.page_count,
        dpi,
    )
    
    return {"status": "ok", "path": str(output_path)}


@router.get("/pdf/file")
async def download_pdf(project_id: str, dpi: int = Query(default=DEFAULT_DPI)):
    """Descarga el PDF exportado."""
    project = projects_repo.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = PROJECTS_DIR / project_id
    pdf_path = project_dir / "export" / f"export_{dpi}.pdf"
    
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Exported PDF not found")
    
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{project.name}_translated.pdf",
    )
