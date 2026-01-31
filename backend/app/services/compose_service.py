"""
Servicio de composición: dibuja texto traducido sobre la imagen original.
Modo default: PATCH (rectángulo de color de fondo + texto).
"""

from pathlib import Path
from typing import List

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from ..db.models import TextRegion


def _estimate_background_color(img: Image.Image, bbox: List[float], margin: int = 5) -> tuple:
    """
    Estima el color de fondo alrededor del bbox.
    Para esquemas eléctricos, filtra colores de líneas y usa solo colores claros.
    """
    x1, y1, x2, y2 = [int(v) for v in bbox]
    
    # Expandir bbox para obtener el marco
    x1_outer = max(0, x1 - margin)
    y1_outer = max(0, y1 - margin)
    x2_outer = min(img.width, x2 + margin)
    y2_outer = min(img.height, y2 + margin)
    
    # Obtener píxeles del marco (excluyendo el interior)
    pixels = []
    img_array = np.array(img)
    
    # Top strip
    if y1_outer < y1:
        pixels.extend(img_array[y1_outer:y1, x1_outer:x2_outer].reshape(-1, 3).tolist())
    # Bottom strip
    if y2 < y2_outer:
        pixels.extend(img_array[y2:y2_outer, x1_outer:x2_outer].reshape(-1, 3).tolist())
    # Left strip
    if x1_outer < x1:
        pixels.extend(img_array[y1:y2, x1_outer:x1].reshape(-1, 3).tolist())
    # Right strip
    if x2 < x2_outer:
        pixels.extend(img_array[y1:y2, x2:x2_outer].reshape(-1, 3).tolist())
    
    if not pixels:
        return (255, 255, 255)  # Default: blanco
    
    pixels_array = np.array(pixels)
    
    # Filtrar solo píxeles claros (luminancia > 200) para evitar líneas de colores
    luminance = 0.299 * pixels_array[:, 0] + 0.587 * pixels_array[:, 1] + 0.114 * pixels_array[:, 2]
    light_pixels = pixels_array[luminance > 200]
    
    if len(light_pixels) > 0:
        # Usar mediana de píxeles claros
        median_color = np.median(light_pixels, axis=0).astype(int)
        return tuple(median_color)
    
    # Si no hay píxeles claros, usar blanco por defecto (típico en esquemas)
    return (255, 255, 255)


def _get_text_color(bg_color: tuple) -> tuple:
    """Determina el color del texto basado en el fondo (contraste)."""
    luminance = 0.299 * bg_color[0] + 0.587 * bg_color[1] + 0.114 * bg_color[2]
    return (0, 0, 0) if luminance > 128 else (255, 255, 255)


def _fit_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    bbox_width: int,
    bbox_height: int,
    font_path: str = None,
    min_font_size: int = 8,
    max_font_size: int = 72,
    fixed_font_size: int = None,
    font_family: str = "Arial",
    text_align: str = "center",
) -> tuple:
    """
    Ajusta el texto al bbox, reduciendo tamaño o haciendo wrap si es necesario.
    
    Returns:
        (font, lines, overflow, line_height)
    """
    # Intentar encontrar la fuente solicitada
    font = None
    font_names = [f"{font_family}.ttf", f"{font_family.lower()}.ttf", "arial.ttf", "segoeui.ttf", "tahoma.ttf"]
    
    # Si hay tamaño fijo, usarlo directamente
    if fixed_font_size:
        for font_name in font_names:
            try:
                font = ImageFont.truetype(font_name, fixed_font_size)
                break
            except:
                continue
        if font is None:
            font = ImageFont.load_default()
        return font, [text], False, fixed_font_size
    
    # Auto-ajustar tamaño
    for size in range(max_font_size, min_font_size - 1, -1):
        for font_name in font_names:
            try:
                font = ImageFont.truetype(font_name, size)
                break
            except:
                continue
        if font is None:
            font = ImageFont.load_default()
        
        # Verificar si cabe en una línea
        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        
        if text_width <= bbox_width and text_height <= bbox_height:
            return font, [text], False, size
        
        # Intentar wrap a 2 líneas
        words = text.split()
        if len(words) > 1:
            mid = len(text) // 2
            space_idx = text.find(" ", mid)
            if space_idx == -1:
                space_idx = text.rfind(" ", 0, mid)
            
            if space_idx > 0:
                line1 = text[:space_idx]
                line2 = text[space_idx + 1:]
                
                bbox1 = draw.textbbox((0, 0), line1, font=font)
                bbox2 = draw.textbbox((0, 0), line2, font=font)
                
                max_width = max(bbox1[2] - bbox1[0], bbox2[2] - bbox2[0])
                total_height = (bbox1[3] - bbox1[1]) + (bbox2[3] - bbox2[1])
                
                if max_width <= bbox_width and total_height <= bbox_height:
                    return font, [line1, line2], False, size
    
    # Si nada cabe, usar el tamaño mínimo y marcar overflow
    for font_name in font_names:
        try:
            font = ImageFont.truetype(font_name, min_font_size)
            break
        except:
            continue
    if font is None:
        font = ImageFont.load_default()
    
    return font, [text], True, min_font_size


def compose_page(
    original_path: Path,
    regions: List[TextRegion],
    output_dir: Path,
    page_number: int,
    dpi: int,
) -> Path:
    """
    Compone la página traducida dibujando texto ES sobre las regiones de texto.
    
    Args:
        original_path: Ruta a la imagen original
        regions: Lista de TextRegion con traducciones
        output_dir: Directorio del proyecto
        page_number: Número de página
        dpi: DPI de la imagen
    
    Returns:
        Ruta a la imagen traducida
    """
    # Cargar imagen original
    img = Image.open(original_path).convert("RGB")
    draw = ImageDraw.Draw(img)
    
    # Ordenar regiones por render_order (menor = se dibuja primero/debajo)
    sorted_regions = sorted(regions, key=lambda r: getattr(r, 'render_order', 0))
    
    for region in sorted_regions:
        # Usar texto traducido o original si no hay traducción
        text = region.tgt_text or region.src_text
        if not text:
            continue
        
        x1, y1, x2, y2 = [int(v) for v in region.bbox]
        bbox_width = x2 - x1
        bbox_height = y2 - y1
        
        if region.compose_mode == "patch":
            # Determinar color de fondo
            bg_color = None
            if getattr(region, 'bg_color', None):
                # Convertir hex a RGB
                hex_color = region.bg_color.lstrip('#')
                bg_color = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            else:
                # Estimar color de fondo automáticamente
                bg_color = _estimate_background_color(img, region.bbox)
            
            # Determinar color de texto
            text_color = (0, 0, 0)  # Default negro
            if getattr(region, 'text_color', None):
                hex_color = region.text_color.lstrip('#')
                text_color = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            else:
                text_color = _get_text_color(bg_color)
            
            # Dibujar rectángulo de fondo
            padding = 2
            draw.rectangle(
                [x1 - padding, y1 - padding, x2 + padding, y2 + padding],
                fill=bg_color,
            )
            
            # Ajustar y dibujar texto con propiedades personalizadas
            font, lines, overflow, final_size = _fit_text(
                draw, text, bbox_width, bbox_height,
                fixed_font_size=region.font_size,
                font_family=getattr(region, 'font_family', 'Arial'),
                text_align=getattr(region, 'text_align', 'center'),
            )
            
            # Calcular altura total y posición
            total_height = 0
            line_heights = []
            for line in lines:
                bbox = draw.textbbox((0, 0), line, font=font)
                h = bbox[3] - bbox[1]
                line_heights.append(h)
                total_height += h
            
            y_offset = y1 + (bbox_height - total_height) // 2
            
            # Dibujar cada línea con alineación
            for i, line in enumerate(lines):
                bbox = draw.textbbox((0, 0), line, font=font)
                line_width = bbox[2] - bbox[0]
                
                # Calcular x según alineación
                align = getattr(region, 'text_align', 'center')
                if align == 'left':
                    x_offset = x1 + padding
                elif align == 'right':
                    x_offset = x2 - line_width - padding
                else:  # center
                    x_offset = x1 + (bbox_width - line_width) // 2
                
                draw.text((x_offset, y_offset), line, fill=text_color, font=font)
                y_offset += line_heights[i]
            
            # Marcar si hay overflow
            if overflow:
                region.needs_review = True
        
        # TODO: Implementar modo "inpaint" si se necesita
    
    # Guardar imagen traducida
    pages_dir = output_dir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    output_path = pages_dir / f"{page_number:03d}_translated_{dpi}.png"
    img.save(output_path)
    
    # Thumbnail
    thumbs_dir = output_dir / "thumbs"
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    thumb_path = thumbs_dir / f"{page_number:03d}_translated.png"
    thumb = img.copy()
    thumb.thumbnail((300, 400))
    thumb.save(thumb_path)
    
    return output_path
