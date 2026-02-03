"""
Modelos de datos del backend.
"""

from enum import Enum
from datetime import datetime
from typing import List, Optional
from dataclasses import dataclass, field


class ProjectStatus(Enum):
    CREATED = "created"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


class DocumentType(Enum):
    SCHEMATIC = "schematic"
    MANUAL = "manual"


@dataclass
class Project:
    id: str
    name: str
    page_count: int
    status: ProjectStatus = ProjectStatus.CREATED
    created_at: datetime = field(default_factory=datetime.now)
    ocr_region_filters: List[dict] = field(default_factory=list)
    document_type: DocumentType = DocumentType.SCHEMATIC


@dataclass
class Page:
    project_id: str
    page_number: int
    has_original: bool = False
    has_translated: bool = False


@dataclass
class TextRegion:
    id: str
    project_id: str
    page_number: int
    bbox: List[float]  # [x1, y1, x2, y2] en píxeles
    bbox_normalized: List[float]  # [x1, y1, x2, y2] normalizado 0-1
    src_text: str
    tgt_text: Optional[str] = None
    confidence: float = 0.0
    locked: bool = False
    needs_review: bool = False
    compose_mode: str = "patch"  # "patch" o "inpaint"
    font_size: Optional[int] = None  # Tamaño de fuente manual (None = auto)
    render_order: int = 0  # Orden de renderizado (menor = se dibuja primero/debajo)
    
    # NUEVOS CAMPOS para editor visual de cajas
    font_family: str = "Arial"  # "Arial", "Times New Roman", "Courier New", etc.
    text_color: str = "#000000"  # Color del texto (hex)
    bg_color: Optional[str] = None  # Color de fondo (None = auto-estimado)
    text_align: str = "center"  # "left", "center", "right"
    rotation: float = 0.0  # Grados de rotación (0-360)
    is_manual: bool = False  # True si fue creada manualmente (no por OCR)
    line_height: float = 1.0  # Interlineado (1.0 = normal, 0.8 = compacto, 1.2 = espaciado)


@dataclass
class GlossaryEntry:
    id: str
    project_id: str
    src_term: str
    tgt_term: str
    locked: bool = False


@dataclass
class Job:
    id: str
    project_id: str
    job_type: str
    status: str = "pending"  # pending, running, completed, error
    progress: float = 0.0
    current_step: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class DrawingElement:
    """Elemento de dibujo sobre un esquema (línea, rectángulo, texto, imagen)."""
    id: str
    project_id: str
    page_number: int
    element_type: str  # 'line', 'rect', 'text', 'image'
    points: List[float]  # line/rect: [x1,y1,x2,y2], text: [x,y], image: [x1,y1,x2,y2]
    stroke_color: str = "#000000"
    stroke_width: int = 2
    fill_color: Optional[str] = None
    text: Optional[str] = None
    font_size: int = 14
    font_family: str = "Arial"
    text_color: str = "#000000"
    image_data: Optional[str] = None  # base64 PNG para type='image'
    created_at: datetime = field(default_factory=datetime.now)
