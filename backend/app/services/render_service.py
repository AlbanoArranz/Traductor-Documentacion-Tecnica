"""
Servicio de renderizado PDF→PNG usando PyMuPDF.
"""

from pathlib import Path
import fitz  # PyMuPDF


def count_pages(pdf_path: Path) -> int:
    """Cuenta el número de páginas de un PDF."""
    doc = fitz.open(str(pdf_path))
    count = len(doc)
    doc.close()
    return count


def render_page(pdf_path: Path, page_number: int, dpi: int, output_dir: Path) -> Path:
    """
    Renderiza una página del PDF a PNG.
    
    Args:
        pdf_path: Ruta al PDF
        page_number: Número de página (0-indexed)
        dpi: Resolución en DPI
        output_dir: Directorio del proyecto
    
    Returns:
        Ruta a la imagen generada
    """
    pages_dir = output_dir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    
    thumbs_dir = output_dir / "thumbs"
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = pages_dir / f"{page_number:03d}_original_{dpi}.png"
    thumb_path = thumbs_dir / f"{page_number:03d}_original.png"
    
    doc = fitz.open(str(pdf_path))
    page = doc[page_number]
    
    # Renderizar a alta resolución
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    pix.save(str(output_path))
    
    # Thumbnail (150 DPI)
    thumb_zoom = 150 / 72.0
    thumb_mat = fitz.Matrix(thumb_zoom, thumb_zoom)
    thumb_pix = page.get_pixmap(matrix=thumb_mat)
    thumb_pix.save(str(thumb_path))
    
    doc.close()
    
    return output_path
