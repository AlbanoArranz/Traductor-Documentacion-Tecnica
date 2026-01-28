"""
Servicio de exportación: genera PDF final desde imágenes traducidas.
"""

from pathlib import Path

from PIL import Image


def export_pdf(project_dir: Path, page_count: int, dpi: int) -> Path:
    """
    Genera un PDF final a partir de las imágenes traducidas.
    
    Args:
        project_dir: Directorio del proyecto
        page_count: Número de páginas
        dpi: DPI de las imágenes
    
    Returns:
        Ruta al PDF exportado
    """
    export_dir = project_dir / "export"
    export_dir.mkdir(parents=True, exist_ok=True)
    output_path = export_dir / f"export_{dpi}.pdf"
    
    images = []
    pages_dir = project_dir / "pages"
    
    for page_num in range(page_count):
        # Preferir imagen traducida, fallback a original
        translated_path = pages_dir / f"{page_num:03d}_translated_{dpi}.png"
        original_path = pages_dir / f"{page_num:03d}_original_{dpi}.png"
        
        if translated_path.exists():
            img_path = translated_path
        elif original_path.exists():
            img_path = original_path
        else:
            continue
        
        img = Image.open(img_path).convert("RGB")
        images.append(img)
    
    if not images:
        raise ValueError("No images found to export")
    
    # Guardar como PDF
    # Calcular tamaño físico basado en DPI
    first_img = images[0]
    
    images[0].save(
        output_path,
        "PDF",
        resolution=dpi,
        save_all=True,
        append_images=images[1:] if len(images) > 1 else [],
    )
    
    # Cerrar imágenes
    for img in images:
        img.close()
    
    return output_path
