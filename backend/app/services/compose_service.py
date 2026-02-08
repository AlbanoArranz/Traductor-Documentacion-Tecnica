"""
Servicio de composición: dibuja texto traducido sobre la imagen original.
Modo default: PATCH (rectángulo de color de fondo + texto).
"""

from pathlib import Path
from typing import List
import base64
import io

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from ..db.models import TextRegion, DrawingElement


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


def _draw_drawing_elements(img: Image.Image, draw: ImageDraw.ImageDraw, drawings: List[DrawingElement], dpi: int = 450):
    """Dibuja los elementos de dibujo (líneas, rectángulos, texto, imágenes) sobre la imagen.
    
    El grosor de línea se escala proporcionalmente al DPI para que coincida con la visualización
    a zoom 100% en pantalla (96 DPI estándar).
    """
    # Factor de escala: DPI_render / DPI_pantalla_estándar
    scale_factor = dpi / 96.0
    
    for elem in drawings:
        # Calcular grosor escalado
        scaled_width = max(1, int(elem.stroke_width * scale_factor))
        
        if elem.element_type == 'line':
            if len(elem.points) >= 4:
                x1, y1, x2, y2 = elem.points[:4]
                draw.line(
                    [(x1, y1), (x2, y2)],
                    fill=elem.stroke_color,
                    width=scaled_width,
                )
        
        elif elem.element_type == 'polyline':
            # Polilínea: array de puntos [x1,y1,x2,y2,x3,y3,...]
            if len(elem.points) >= 4 and len(elem.points) % 2 == 0:
                points = [(elem.points[i], elem.points[i+1]) for i in range(0, len(elem.points), 2)]
                draw.line(points, fill=elem.stroke_color, width=scaled_width)
        
        elif elem.element_type == 'rect':
            if len(elem.points) >= 4:
                x1, y1, x2, y2 = elem.points[:4]
                if elem.fill_color:
                    draw.rectangle([(x1, y1), (x2, y2)], fill=elem.fill_color, outline=elem.stroke_color, width=scaled_width)
                else:
                    draw.rectangle([(x1, y1), (x2, y2)], outline=elem.stroke_color, width=scaled_width)
        
        elif elem.element_type == 'circle':
            if len(elem.points) >= 4:
                x1, y1, x2, y2 = elem.points[:4]
                cx = (x1 + x2) / 2
                cy = (y1 + y2) / 2
                rx = abs(x2 - x1) / 2
                ry = abs(y2 - y1) / 2
                bbox = [cx - rx, cy - ry, cx + rx, cy + ry]
                if elem.fill_color:
                    draw.ellipse(bbox, fill=elem.fill_color, outline=elem.stroke_color, width=scaled_width)
                else:
                    draw.ellipse(bbox, outline=elem.stroke_color, width=scaled_width)
        
        elif elem.element_type == 'text':
            if len(elem.points) >= 2 and elem.text:
                x, y = elem.points[:2]
                font = None
                font_names = [f"{elem.font_family}.ttf", f"{elem.font_family.lower()}.ttf", "arial.ttf", "segoeui.ttf"]
                for font_name in font_names:
                    try:
                        font = ImageFont.truetype(font_name, elem.font_size)
                        break
                    except:
                        continue
                if font is None:
                    font = ImageFont.load_default()
                draw.text((x, y), elem.text, fill=elem.text_color, font=font)
        
        elif elem.element_type == 'image':
            if len(elem.points) >= 4 and elem.image_data:
                x1, y1, x2, y2 = [int(v) for v in elem.points[:4]]
                try:
                    image_bytes = base64.b64decode(elem.image_data)
                    stamp_img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
                    target_width = x2 - x1
                    target_height = y2 - y1
                    if target_width > 0 and target_height > 0:
                        stamp_img = stamp_img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                        img.paste(stamp_img, (x1, y1), stamp_img)
                except Exception as e:
                    pass  # Ignorar errores de imagen


def compose_page_with_drawings(
    original_path: Path,
    regions: List[TextRegion],
    drawings: List[DrawingElement],
    output_dir: Path,
    page_number: int,
    dpi: int,
) -> Path:
    """
    Compone la página traducida dibujando texto ES y elementos de dibujo.
    
    Args:
        original_path: Ruta a la imagen original
        regions: Lista de TextRegion con traducciones
        drawings: Lista de DrawingElement (líneas, rectángulos, texto, imágenes)
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
                hex_color = region.bg_color.lstrip('#')
                bg_color = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            else:
                bg_color = _estimate_background_color(img, region.bbox)
            
            # Determinar color de texto
            text_color = (0, 0, 0)
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
            
            # Ajustar y dibujar texto
            font, lines, overflow, final_size = _fit_text(
                draw, text, bbox_width, bbox_height,
                fixed_font_size=region.font_size,
                font_family=getattr(region, 'font_family', 'Arial'),
                text_align=getattr(region, 'text_align', 'center'),
            )
            
            total_height = 0
            line_heights = []
            for line in lines:
                bbox = draw.textbbox((0, 0), line, font=font)
                h = bbox[3] - bbox[1]
                line_heights.append(h)
                total_height += h
            
            y_offset = y1 + (bbox_height - total_height) // 2
            
            for i, line in enumerate(lines):
                bbox = draw.textbbox((0, 0), line, font=font)
                line_width = bbox[2] - bbox[0]
                
                align = getattr(region, 'text_align', 'center')
                if align == 'left':
                    x_offset = x1 + padding
                elif align == 'right':
                    x_offset = x2 - line_width - padding
                else:
                    x_offset = x1 + (bbox_width - line_width) // 2
                
                draw.text((x_offset, y_offset), line, fill=text_color, font=font)
                y_offset += line_heights[i]
            
            if overflow:
                region.needs_review = True
    
    # Dibujar elementos de dibujo encima de las regiones de texto
    _draw_drawing_elements(img, draw, drawings, dpi)
    
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
