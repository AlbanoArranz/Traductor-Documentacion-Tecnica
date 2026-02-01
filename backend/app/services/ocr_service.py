"""
Servicio de OCR usando EasyOCR.
"""

import uuid
import re
from pathlib import Path
from typing import List

from PIL import Image

from ..config import CJK_RATIO_THRESHOLD, get_min_han_ratio, get_ocr_region_filters
from ..db.models import TextRegion


# Lazy load de EasyOCR para evitar importación lenta al inicio
_ocr_reader = None


def _get_ocr():
    """Obtiene la instancia de EasyOCR Reader (lazy load)."""
    global _ocr_reader
    if _ocr_reader is None:
        try:
            import easyocr
        except ModuleNotFoundError as e:
            raise RuntimeError(
                "Missing dependency: easyocr. Install backend requirements in your venv (pip install -r backend/requirements.txt)."
            ) from e
        _ocr_reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)
    return _ocr_reader


def _is_han_char(char: str) -> bool:
    """Verifica si un carácter es Han (ideogramas chinos)."""
    code = ord(char)
    return (
        0x4E00 <= code <= 0x9FFF or  # CJK Unified Ideographs
        0x3400 <= code <= 0x4DBF or  # CJK Extension A
        0x20000 <= code <= 0x2A6DF or  # CJK Extension B
        0x2A700 <= code <= 0x2B73F or  # CJK Extension C
        0x2B740 <= code <= 0x2B81F or  # CJK Extension D
        0x2B820 <= code <= 0x2CEAF or  # CJK Extension E
        0xF900 <= code <= 0xFAFF or  # CJK Compatibility Ideographs
        0x2F800 <= code <= 0x2FA1F  # CJK Compatibility Supplement
    )


def _han_ratio(text: str) -> float:
    """Calcula el ratio de caracteres Han (ideogramas chinos) en un texto."""
    if not text:
        return 0.0
    han_count = sum(1 for c in text if _is_han_char(c))
    return han_count / len(text)


def detect_text(image_path: Path, dpi: int, custom_filters: list = None, document_type: str = "schematic") -> List[TextRegion]:
    """
    Detecta texto chino en una imagen usando EasyOCR.
    
    Args:
        image_path: Ruta a la imagen
        dpi: DPI de la imagen (para calcular tamaños)
        custom_filters: Lista de filtros OCR personalizados (si None, usa filtros globales)
        document_type: Tipo de documento ('schematic' o 'manual')
    
    Returns:
        Lista de TextRegion con texto chino detectado
    """
    reader = _get_ocr()
    
    # Obtener dimensiones de la imagen
    with Image.open(image_path) as img:
        img_width, img_height = img.size
    
    # Ejecutar OCR - EasyOCR devuelve lista de (bbox, text, confidence)
    result = reader.readtext(str(image_path))
    
    regions = []
    min_han_ratio = get_min_han_ratio()
    ocr_filters = custom_filters if custom_filters is not None else get_ocr_region_filters()
    
    for item in result:
        bbox_points = item[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
        text = item[1]
        confidence = item[2]

        filtered_out = False
        for f in ocr_filters:
            mode = f.get("mode")
            pattern = f.get("pattern")
            if not mode or not pattern:
                continue
            case_sensitive = bool(f.get("case_sensitive", False))
            raw_value = text or ""
            value = raw_value if case_sensitive else raw_value.lower()
            target = pattern if case_sensitive else str(pattern).lower()
            try:
                if mode == "contains" and target in value:
                    filtered_out = True
                    break
                if mode == "starts" and value.startswith(target):
                    filtered_out = True
                    break
                if mode == "ends" and value.endswith(target):
                    filtered_out = True
                    break
                if mode == "regex":
                    flags = 0 if case_sensitive else re.IGNORECASE
                    if re.search(str(pattern), raw_value, flags=flags):
                        filtered_out = True
                        break
            except Exception:
                continue

        if filtered_out:
            continue
        
        # Filtrar: primero descartar si casi no hay Han (ruido)
        if _han_ratio(text) < CJK_RATIO_THRESHOLD:
            continue

        # Filtro estricto configurable: porcentaje mínimo de Han
        if _han_ratio(text) < min_han_ratio:
            continue
        
        # Convertir bbox de 4 puntos a [x1, y1, x2, y2]
        x_coords = [float(p[0]) for p in bbox_points]
        y_coords = [float(p[1]) for p in bbox_points]
        x1, y1 = min(x_coords), min(y_coords)
        x2, y2 = max(x_coords), max(y_coords)
        
        # Normalizar bbox
        bbox_normalized = [
            x1 / img_width,
            y1 / img_height,
            x2 / img_width,
            y2 / img_height,
        ]
        
        # Extraer project_id del path
        project_id = image_path.parent.parent.name
        page_number = int(image_path.stem.split("_")[0])
        
        region = TextRegion(
            id=str(uuid.uuid4()),
            project_id=project_id,
            page_number=page_number,
            bbox=[x1, y1, x2, y2],
            bbox_normalized=bbox_normalized,
            src_text=text,
            confidence=confidence,
        )
        regions.append(region)
    
    # Para modo manual, agrupar líneas en párrafos
    if document_type == "manual" and len(regions) > 1:
        regions = _group_lines_into_paragraphs(regions)
    
    return regions


def _group_lines_into_paragraphs(regions: List[TextRegion]) -> List[TextRegion]:
    """
    Agrupa líneas de texto cercanas en párrafos para modo manual.
    
    Criterios de agrupación:
    - Solapamiento horizontal > 50% (misma columna)
    - Distancia vertical < 1.5x alto promedio (líneas consecutivas)
    """
    if not regions:
        return regions
    
    # Ordenar por posición Y (de arriba a abajo)
    sorted_regions = sorted(regions, key=lambda r: r.bbox[1])
    
    grouped = []
    current_group = [sorted_regions[0]]
    
    for i in range(1, len(sorted_regions)):
        prev = current_group[-1]
        curr = sorted_regions[i]
        
        # Calcular solapamiento horizontal
        prev_x1, prev_y1, prev_x2, prev_y2 = prev.bbox
        curr_x1, curr_y1, curr_x2, curr_y2 = curr.bbox
        
        prev_width = prev_x2 - prev_x1
        curr_width = curr_x2 - curr_x1
        
        # Solapamiento en X
        overlap_x = min(prev_x2, curr_x2) - max(prev_x1, curr_x1)
        min_width = min(prev_width, curr_width)
        x_overlap_ratio = overlap_x / min_width if min_width > 0 else 0
        
        # Distancia vertical
        prev_height = prev_y2 - prev_y1
        curr_height = curr_y2 - curr_y1
        avg_height = (prev_height + curr_height) / 2
        vertical_gap = curr_y1 - prev_y2
        
        # Criterios de agrupación
        should_group = (
            x_overlap_ratio > 0.5 and  # >50% solapamiento horizontal
            vertical_gap < avg_height * 1.5  # Distancia < 1.5x alto
        )
        
        if should_group:
            current_group.append(curr)
        else:
            # Finalizar grupo actual y empezar nuevo
            grouped.append(_merge_regions(current_group))
            current_group = [curr]
    
    # No olvidar el último grupo
    if current_group:
        grouped.append(_merge_regions(current_group))
    
    return grouped


def _merge_regions(regions: List[TextRegion]) -> TextRegion:
    """Fusiona múltiples regiones en una sola (para párrafos)."""
    if len(regions) == 1:
        return regions[0]
    
    # Usar la primera región como base
    base = regions[0]
    
    # Calcular bbox que abarca todas las regiones
    all_x1 = [r.bbox[0] for r in regions]
    all_y1 = [r.bbox[1] for r in regions]
    all_x2 = [r.bbox[2] for r in regions]
    all_y2 = [r.bbox[3] for r in regions]
    
    merged_bbox = [min(all_x1), min(all_y1), max(all_x2), max(all_y2)]
    
    # Calcular bbox normalizado
    img_width = base.bbox[2] / base.bbox_normalized[2] if base.bbox_normalized[2] > 0 else 1
    img_height = base.bbox[3] / base.bbox_normalized[3] if base.bbox_normalized[3] > 0 else 1
    
    merged_bbox_normalized = [
        merged_bbox[0] / img_width,
        merged_bbox[1] / img_height,
        merged_bbox[2] / img_width,
        merged_bbox[3] / img_height,
    ]
    
    # Combinar textos con espacio entre líneas
    merged_text = " ".join(r.src_text for r in regions)
    
    # Promediar confianza
    avg_confidence = sum(r.confidence for r in regions) / len(regions)
    
    return TextRegion(
        id=str(uuid.uuid4()),
        project_id=base.project_id,
        page_number=base.page_number,
        bbox=merged_bbox,
        bbox_normalized=merged_bbox_normalized,
        src_text=merged_text,
        confidence=avg_confidence,
    )


def detect_text_batch(image_paths: List[Path], dpi: int, custom_filters: list = None) -> List[List[TextRegion]]:
    """
    Detecta texto en múltiples imágenes usando batch inference GPU.
    
    Args:
        image_paths: Lista de rutas a imágenes
        dpi: DPI de las imágenes
        custom_filters: Filtros OCR opcionales
    
    Returns:
        Lista de listas de TextRegion (una por imagen)
    """
    import time
    import numpy as np
    start_time = time.time()
    
    reader = _get_ocr()
    
    # Cargar imágenes como numpy arrays para batch processing
    image_arrays = []
    image_info = []
    for path in image_paths:
        with Image.open(path) as img:
            image_info.append({
                'path': path,
                'width': img.width,
                'height': img.height,
            })
            image_arrays.append(np.array(img))
    
    # Batch OCR con GPU
    results = reader.readtext(image_arrays)
    
    # Procesar resultados
    all_regions = []
    min_han_ratio = get_min_han_ratio()
    ocr_filters = custom_filters if custom_filters is not None else get_ocr_region_filters()
    
    for img_idx, (info, page_results) in enumerate(zip(image_info, results)):
        regions = []
        project_id = info['path'].parent.parent.name
        page_number = int(info['path'].stem.split("_")[0])
        
        for item in page_results:
            bbox_points = item[0]
            text = item[1]
            confidence = item[2]
            
            # Aplicar filtros (misma lógica que detect_text individual)
            filtered_out = False
            for f in ocr_filters:
                mode = f.get("mode")
                pattern = f.get("pattern")
                if not mode or not pattern:
                    continue
                case_sensitive = bool(f.get("case_sensitive", False))
                raw_value = text or ""
                value = raw_value if case_sensitive else raw_value.lower()
                target = pattern if case_sensitive else str(pattern).lower()
                try:
                    if mode == "contains" and target in value:
                        filtered_out = True
                        break
                    if mode == "starts" and value.startswith(target):
                        filtered_out = True
                        break
                    if mode == "ends" and value.endswith(target):
                        filtered_out = True
                        break
                    if mode == "regex":
                        flags = 0 if case_sensitive else re.IGNORECASE
                        if re.search(str(pattern), raw_value, flags=flags):
                            filtered_out = True
                            break
                except Exception:
                    continue
            
            if filtered_out:
                continue
            
            if _han_ratio(text) < CJK_RATIO_THRESHOLD:
                continue
            if _han_ratio(text) < min_han_ratio:
                continue
            
            # Convertir bbox
            x_coords = [float(p[0]) for p in bbox_points]
            y_coords = [float(p[1]) for p in bbox_points]
            x1, y1 = min(x_coords), min(y_coords)
            x2, y2 = max(x_coords), max(y_coords)
            
            bbox_normalized = [
                x1 / info['width'],
                y1 / info['height'],
                x2 / info['width'],
                y2 / info['height'],
            ]
            
            region = TextRegion(
                id=str(uuid.uuid4()),
                project_id=project_id,
                page_number=page_number,
                bbox=[x1, y1, x2, y2],
                bbox_normalized=bbox_normalized,
                src_text=text,
                confidence=confidence,
            )
            regions.append(region)
        
        all_regions.append(regions)
    
    elapsed = time.time() - start_time
    print(f"OCR batch {len(image_paths)} páginas: {elapsed:.2f}s ({elapsed/len(image_paths):.2f}s/página)")
    
    return all_regions
