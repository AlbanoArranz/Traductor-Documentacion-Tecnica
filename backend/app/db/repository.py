"""
Repositorios para persistencia de datos (in-memory + JSON).
"""

import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any

from ..config import PROJECTS_DIR, JOBS_DIR, SNIPPETS_DIR
from .models import Project, ProjectStatus, Page, TextRegion, GlossaryEntry, Job, DocumentType, DrawingElement, Snippet
from .global_glossary_repository import GlobalGlossaryRepository


class ProjectsRepository:
    """Repositorio de proyectos."""
    
    def __init__(self):
        self._cache: Dict[str, Project] = {}
        self._load_all()
    
    def _load_all(self):
        """Carga todos los proyectos desde disco."""
        if not PROJECTS_DIR.exists():
            return
        for project_dir in PROJECTS_DIR.iterdir():
            if project_dir.is_dir():
                meta_path = project_dir / "meta.json"
                if meta_path.exists():
                    with open(meta_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        ocr_filters = data.get("ocr_region_filters", [])
                        if not isinstance(ocr_filters, list):
                            ocr_filters = []
                        self._cache[data["id"]] = Project(
                            id=data["id"],
                            name=data["name"],
                            page_count=data["page_count"],
                            status=ProjectStatus(data.get("status", "created")),
                            created_at=datetime.fromisoformat(data["created_at"]),
                            ocr_region_filters=ocr_filters,
                            document_type=DocumentType(data.get("document_type", "schematic")),
                        )
    
    def _save(self, project: Project):
        """Guarda un proyecto a disco."""
        project_dir = PROJECTS_DIR / project.id
        project_dir.mkdir(parents=True, exist_ok=True)
        meta_path = project_dir / "meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump({
                "id": project.id,
                "name": project.name,
                "page_count": project.page_count,
                "status": project.status.value,
                "created_at": project.created_at.isoformat(),
                "ocr_region_filters": project.ocr_region_filters if project.ocr_region_filters else [],
                "document_type": project.document_type.value,
            }, f, ensure_ascii=False, indent=2)
    
    def create(self, id: str, name: str, page_count: int, document_type: DocumentType = DocumentType.SCHEMATIC) -> Project:
        project = Project(id=id, name=name, page_count=page_count, document_type=document_type)
        self._cache[id] = project
        self._save(project)
        return project
    
    def get(self, id: str) -> Optional[Project]:
        return self._cache.get(id)
    
    def list_all(self) -> List[Project]:
        return list(self._cache.values())
    
    def update(self, id: str, **kwargs) -> Optional[Project]:
        project = self._cache.get(id)
        if not project:
            return None
        for key, value in kwargs.items():
            if hasattr(project, key) and value is not None:
                setattr(project, key, value)
        self._save(project)
        return project
    
    def delete(self, id: str):
        if id in self._cache:
            del self._cache[id]


class PagesRepository:
    """Repositorio de páginas."""
    
    def __init__(self):
        self._cache: Dict[str, Dict[int, Page]] = {}
    
    def _get_project_pages(self, project_id: str) -> Dict[int, Page]:
        if project_id not in self._cache:
            self._cache[project_id] = {}
            # Cargar desde disco si existe
            pages_file = PROJECTS_DIR / project_id / "pages.json"
            if pages_file.exists():
                with open(pages_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for p in data:
                        self._cache[project_id][p["page_number"]] = Page(**p)
        return self._cache[project_id]
    
    def _save(self, project_id: str):
        pages = self._get_project_pages(project_id)
        pages_file = PROJECTS_DIR / project_id / "pages.json"
        with open(pages_file, "w", encoding="utf-8") as f:
            json.dump([
                {
                    "project_id": p.project_id,
                    "page_number": p.page_number,
                    "has_original": p.has_original,
                    "has_translated": p.has_translated,
                }
                for p in pages.values()
            ], f, ensure_ascii=False, indent=2)
    
    def upsert(self, project_id: str, page_number: int, **kwargs) -> Page:
        pages = self._get_project_pages(project_id)
        if page_number in pages:
            page = pages[page_number]
            for key, value in kwargs.items():
                if hasattr(page, key) and value is not None:
                    setattr(page, key, value)
        else:
            page = Page(project_id=project_id, page_number=page_number, **kwargs)
            pages[page_number] = page
        self._save(project_id)
        return page
    
    def list_by_project(self, project_id: str) -> List[Page]:
        return list(self._get_project_pages(project_id).values())


class TextRegionsRepository:
    """Repositorio de regiones de texto."""
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, TextRegion]] = {}
    
    def _get_project_regions(self, project_id: str) -> Dict[str, TextRegion]:
        if project_id not in self._cache:
            self._cache[project_id] = {}
            regions_file = PROJECTS_DIR / project_id / "text_regions.json"
            if regions_file.exists():
                with open(regions_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for r in data:
                        self._cache[project_id][r["id"]] = TextRegion(**r)
        return self._cache[project_id]
    
    def _save(self, project_id: str):
        regions = self._get_project_regions(project_id)
        regions_file = PROJECTS_DIR / project_id / "text_regions.json"
        with open(regions_file, "w", encoding="utf-8") as f:
            json.dump([
                {
                    "id": r.id,
                    "project_id": r.project_id,
                    "page_number": r.page_number,
                    "bbox": r.bbox,
                    "bbox_normalized": r.bbox_normalized,
                    "src_text": r.src_text,
                    "tgt_text": r.tgt_text,
                    "confidence": r.confidence,
                    "locked": r.locked,
                    "needs_review": r.needs_review,
                    "compose_mode": r.compose_mode,
                    "font_size": r.font_size,
                    "render_order": getattr(r, 'render_order', 0),
                    "font_family": getattr(r, 'font_family', 'Arial'),
                    "text_color": getattr(r, 'text_color', '#000000'),
                    "bg_color": getattr(r, 'bg_color', None),
                    "text_align": getattr(r, 'text_align', 'center'),
                    "rotation": getattr(r, 'rotation', 0.0),
                    "is_manual": getattr(r, 'is_manual', False),
                }
                for r in regions.values()
            ], f, ensure_ascii=False, indent=2)
    
    def get(self, region_id: str, project_id: str = None) -> Optional[TextRegion]:
        # Si se proporciona project_id, asegurar que está cargado
        if project_id:
            project_regions = self._get_project_regions(project_id)
            if region_id in project_regions:
                return project_regions[region_id]
        # Buscar en toda la caché
        for project_regions in self._cache.values():
            if region_id in project_regions:
                return project_regions[region_id]
        return None
    
    def list_by_page(self, project_id: str, page_number: int) -> List[TextRegion]:
        regions = self._get_project_regions(project_id)
        return [r for r in regions.values() if r.page_number == page_number]
    
    def replace_for_page(self, project_id: str, page_number: int, regions: List[TextRegion]):
        """
        Reemplaza las regiones de una página.
        Preserva regiones bloqueadas (locked=True) o manuales (is_manual=True).
        """
        project_regions = self._get_project_regions(project_id)
        # Eliminar SOLO regiones NO bloqueadas y NO manuales de esta página
        to_delete = [
            rid for rid, r in project_regions.items() 
            if r.page_number == page_number and not r.locked and not getattr(r, 'is_manual', False)
        ]
        for rid in to_delete:
            del project_regions[rid]
        # Añadir nuevas regiones (o actualizar existentes si cambiaron)
        for r in regions:
            project_regions[r.id] = r
        self._save(project_id)
    
    def update(self, region_id: str, **kwargs) -> Optional[TextRegion]:
        for project_id, project_regions in self._cache.items():
            if region_id in project_regions:
                region = project_regions[region_id]
                for key, value in kwargs.items():
                    if hasattr(region, key) and value is not None:
                        setattr(region, key, value)
                self._save(project_id)
                return region
        return None
    
    def delete(self, region_id: str, project_id: str = None) -> bool:
        """Elimina una región de texto."""
        if project_id:
            project_regions = self._get_project_regions(project_id)
            if region_id in project_regions:
                del project_regions[region_id]
                self._save(project_id)
                return True
        # Buscar en toda la caché
        for pid, project_regions in self._cache.items():
            if region_id in project_regions:
                del project_regions[region_id]
                self._save(pid)
                return True
        return False


class GlossaryRepository:
    """Repositorio de glosario."""
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, GlossaryEntry]] = {}
    
    def _get_project_glossary(self, project_id: str) -> Dict[str, GlossaryEntry]:
        if project_id not in self._cache:
            self._cache[project_id] = {}
            glossary_file = PROJECTS_DIR / project_id / "glossary.json"
            if glossary_file.exists():
                with open(glossary_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for e in data:
                        self._cache[project_id][e["id"]] = GlossaryEntry(**e)
        return self._cache[project_id]
    
    def _save(self, project_id: str):
        entries = self._get_project_glossary(project_id)
        glossary_file = PROJECTS_DIR / project_id / "glossary.json"
        with open(glossary_file, "w", encoding="utf-8") as f:
            json.dump([
                {
                    "id": e.id,
                    "project_id": e.project_id,
                    "src_term": e.src_term,
                    "tgt_term": e.tgt_term,
                    "locked": e.locked,
                }
                for e in entries.values()
            ], f, ensure_ascii=False, indent=2)
    
    def list_by_project(self, project_id: str) -> List[GlossaryEntry]:
        return list(self._get_project_glossary(project_id).values())
    
    def replace_for_project(self, project_id: str, entries: List[Any]):
        self._cache[project_id] = {}
        for e in entries:
            entry_id = e.id or str(uuid.uuid4())
            self._cache[project_id][entry_id] = GlossaryEntry(
                id=entry_id,
                project_id=project_id,
                src_term=e.src_term,
                tgt_term=e.tgt_term,
                locked=e.locked,
            )
        self._save(project_id)


class DrawingsRepository:
    """Repositorio de elementos de dibujo."""
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, DrawingElement]] = {}
    
    def _get_project_drawings(self, project_id: str) -> Dict[str, DrawingElement]:
        if project_id not in self._cache:
            self._cache[project_id] = {}
            drawings_file = PROJECTS_DIR / project_id / "drawings.json"
            if drawings_file.exists():
                with open(drawings_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for d in data:
                        created_at = d.get("created_at")
                        if isinstance(created_at, str):
                            created_at = datetime.fromisoformat(created_at)
                        else:
                            created_at = datetime.now()
                        self._cache[project_id][d["id"]] = DrawingElement(
                            id=d["id"],
                            project_id=d["project_id"],
                            page_number=d["page_number"],
                            element_type=d["element_type"],
                            points=d["points"],
                            stroke_color=d.get("stroke_color", "#000000"),
                            stroke_width=d.get("stroke_width", 2),
                            fill_color=d.get("fill_color"),
                            text=d.get("text"),
                            font_size=d.get("font_size", 14),
                            font_family=d.get("font_family", "Arial"),
                            text_color=d.get("text_color", "#000000"),
                            image_data=d.get("image_data"),
                            created_at=created_at,
                        )
        return self._cache[project_id]
    
    def _save(self, project_id: str):
        drawings = self._get_project_drawings(project_id)
        drawings_file = PROJECTS_DIR / project_id / "drawings.json"
        with open(drawings_file, "w", encoding="utf-8") as f:
            json.dump([
                {
                    "id": d.id,
                    "project_id": d.project_id,
                    "page_number": d.page_number,
                    "element_type": d.element_type,
                    "points": d.points,
                    "stroke_color": d.stroke_color,
                    "stroke_width": d.stroke_width,
                    "fill_color": d.fill_color,
                    "text": d.text,
                    "font_size": d.font_size,
                    "font_family": d.font_family,
                    "text_color": d.text_color,
                    "image_data": d.image_data,
                    "created_at": d.created_at.isoformat(),
                }
                for d in drawings.values()
            ], f, ensure_ascii=False, indent=2)
    
    def create(self, project_id: str, page_number: int, element_type: str, points: List[float], **kwargs) -> DrawingElement:
        drawing_id = str(uuid.uuid4())
        drawing = DrawingElement(
            id=drawing_id,
            project_id=project_id,
            page_number=page_number,
            element_type=element_type,
            points=points,
            stroke_color=kwargs.get("stroke_color", "#000000"),
            stroke_width=kwargs.get("stroke_width", 2),
            fill_color=kwargs.get("fill_color"),
            text=kwargs.get("text"),
            font_size=kwargs.get("font_size", 14),
            font_family=kwargs.get("font_family", "Arial"),
            text_color=kwargs.get("text_color", "#000000"),
            image_data=kwargs.get("image_data"),
        )
        project_drawings = self._get_project_drawings(project_id)
        project_drawings[drawing_id] = drawing
        self._save(project_id)
        return drawing
    
    def get(self, drawing_id: str, project_id: str) -> Optional[DrawingElement]:
        project_drawings = self._get_project_drawings(project_id)
        return project_drawings.get(drawing_id)
    
    def list_by_page(self, project_id: str, page_number: int) -> List[DrawingElement]:
        drawings = self._get_project_drawings(project_id)
        return [d for d in drawings.values() if d.page_number == page_number]
    
    def list_by_project(self, project_id: str) -> List[DrawingElement]:
        return list(self._get_project_drawings(project_id).values())
    
    def update(self, drawing_id: str, project_id: str, **kwargs) -> Optional[DrawingElement]:
        project_drawings = self._get_project_drawings(project_id)
        if drawing_id not in project_drawings:
            return None
        drawing = project_drawings[drawing_id]
        for key, value in kwargs.items():
            if hasattr(drawing, key) and value is not None:
                setattr(drawing, key, value)
        self._save(project_id)
        return drawing
    
    def delete(self, drawing_id: str, project_id: str) -> bool:
        project_drawings = self._get_project_drawings(project_id)
        if drawing_id in project_drawings:
            del project_drawings[drawing_id]
            self._save(project_id)
            return True
        return False


class SnippetsRepository:
    """Repositorio de snippets de imagen (librería global)."""
    
    INDEX_FILE = SNIPPETS_DIR / "index.json"
    
    def __init__(self):
        self._cache: Dict[str, Snippet] = {}
        self._load()
    
    def _load(self):
        if self.INDEX_FILE.exists():
            try:
                with open(self.INDEX_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data:
                    created_at = item.get("created_at")
                    if isinstance(created_at, str):
                        created_at = datetime.fromisoformat(created_at)
                    else:
                        created_at = datetime.now()
                    self._cache[item["id"]] = Snippet(
                        id=item["id"],
                        name=item["name"],
                        width=item["width"],
                        height=item["height"],
                        has_transparent=item.get("has_transparent", False),
                        ocr_detections=item.get("ocr_detections", []),
                        text_erased=item.get("text_erased", False),
                        created_at=created_at,
                    )
            except Exception:
                self._cache = {}
    
    def _save(self):
        with open(self.INDEX_FILE, "w", encoding="utf-8") as f:
            json.dump([
                {
                    "id": s.id,
                    "name": s.name,
                    "width": s.width,
                    "height": s.height,
                    "has_transparent": s.has_transparent,
                    "ocr_detections": s.ocr_detections,
                    "text_erased": s.text_erased,
                    "created_at": s.created_at.isoformat(),
                }
                for s in self._cache.values()
            ], f, ensure_ascii=False, indent=2)
    
    def create(self, name: str, width: int, height: int, has_transparent: bool = False, ocr_detections: list = None, text_erased: bool = False) -> Snippet:
        snippet_id = str(uuid.uuid4())
        snippet = Snippet(
            id=snippet_id,
            name=name,
            width=width,
            height=height,
            has_transparent=has_transparent,
            ocr_detections=ocr_detections or [],
            text_erased=text_erased,
        )
        self._cache[snippet_id] = snippet
        self._save()
        return snippet
    
    def get(self, snippet_id: str) -> Optional[Snippet]:
        return self._cache.get(snippet_id)
    
    def list_all(self) -> List[Snippet]:
        return sorted(self._cache.values(), key=lambda s: s.created_at, reverse=True)
    
    def update_ocr_detections(self, snippet_id: str, ocr_detections: list) -> Optional[Snippet]:
        snippet = self._cache.get(snippet_id)
        if not snippet:
            return None
        snippet.ocr_detections = ocr_detections
        self._save()
        return snippet

    def delete(self, snippet_id: str) -> bool:
        if snippet_id in self._cache:
            del self._cache[snippet_id]
            self._save()
            # Eliminar archivos de imagen
            for suffix in [".png", "_nobg.png"]:
                img_path = SNIPPETS_DIR / f"{snippet_id}{suffix}"
                if img_path.exists():
                    img_path.unlink()
            return True
        return False


# Instancias singleton
projects_repo = ProjectsRepository()
pages_repo = PagesRepository()
text_regions_repo = TextRegionsRepository()
glossary_repo = GlossaryRepository()
global_glossary_repo = GlobalGlossaryRepository()
drawings_repo = DrawingsRepository()
snippets_repo = SnippetsRepository()
