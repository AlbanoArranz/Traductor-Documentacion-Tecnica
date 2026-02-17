"""
Tests para la funcionalidad de snippets (librería de imágenes).
Cubre: modelo, repositorio, eliminación de fondo, API endpoints.

Nota: Los tests de API usan TestClient de FastAPI. El main.py del proyecto
reescribe sys.stdout/stderr al importarse, lo que puede interferir con pytest.
Para evitarlo, los tests de API se ejecutan con captura desactivada (-s).
"""

import io
import json
from datetime import datetime
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from PIL import Image, ImageDraw
import numpy as np


# ---------- Fixtures ----------

@pytest.fixture
def snippets_dir(tmp_path):
    """Directorio temporal para snippets."""
    d = tmp_path / "snippets"
    d.mkdir()
    return d


@pytest.fixture
def repo(snippets_dir):
    """SnippetsRepository aislado apuntando a directorio temporal."""
    from app.db.repository import SnippetsRepository
    r = SnippetsRepository()
    r.INDEX_FILE = snippets_dir / "index.json"
    r._cache = {}
    # Parchear SNIPPETS_DIR para que delete() borre del sitio correcto
    with patch("app.db.repository.SNIPPETS_DIR", snippets_dir), \
         patch("app.services.snippet_service.SNIPPETS_DIR", snippets_dir), \
         patch("app.services.snippet_service.snippets_repo", r):
        yield r, snippets_dir


@pytest.fixture
def sample_png_bytes():
    """Imagen PNG roja de 100x80."""
    img = Image.new("RGB", (100, 80), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()


@pytest.fixture
def white_bg_png_bytes():
    """Imagen con fondo blanco y líneas negras."""
    img = Image.new("RGB", (200, 150), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.line([(10, 10), (190, 140)], fill=(0, 0, 0), width=3)
    draw.rectangle([(50, 30), (150, 120)], outline=(0, 0, 0), width=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()


# ---------- Tests del modelo Snippet ----------

class TestSnippetModel:
    def test_create_snippet(self):
        from app.db.models import Snippet
        s = Snippet(id="abc", name="Test", width=100, height=80)
        assert s.id == "abc"
        assert s.name == "Test"
        assert s.width == 100
        assert s.height == 80
        assert s.has_transparent is False

    def test_snippet_with_transparent(self):
        from app.db.models import Snippet
        s = Snippet(id="xyz", name="Circuit", width=200, height=150, has_transparent=True)
        assert s.has_transparent is True


# ---------- Tests del repositorio ----------

class TestSnippetsRepository:
    def test_create_and_get(self, repo):
        r, _ = repo
        snippet = r.create(name="Test", width=100, height=80)
        assert snippet.id is not None
        assert snippet.name == "Test"
        retrieved = r.get(snippet.id)
        assert retrieved is not None
        assert retrieved.name == "Test"

    def test_list_all(self, repo):
        r, _ = repo
        r.create(name="A", width=10, height=10)
        r.create(name="B", width=20, height=20)
        assert len(r.list_all()) == 2

    def test_delete_with_files(self, repo):
        r, snippets_dir = repo
        snippet = r.create(name="ToDelete", width=50, height=50)
        (snippets_dir / f"{snippet.id}.png").write_bytes(b"fake")
        (snippets_dir / f"{snippet.id}_nobg.png").write_bytes(b"fake")
        
        assert r.delete(snippet.id) is True
        assert r.get(snippet.id) is None
        assert not (snippets_dir / f"{snippet.id}.png").exists()
        assert not (snippets_dir / f"{snippet.id}_nobg.png").exists()

    def test_delete_nonexistent(self, repo):
        r, _ = repo
        assert r.delete("nonexistent") is False

    def test_persistence_to_json(self, repo):
        r, snippets_dir = repo
        r.create(name="Persist", width=100, height=100)
        index_file = snippets_dir / "index.json"
        assert index_file.exists()
        data = json.loads(index_file.read_text(encoding="utf-8"))
        assert len(data) == 1
        assert data[0]["name"] == "Persist"

    def test_list_sorted_by_date(self, repo):
        r, _ = repo
        import time
        r.create(name="Old", width=10, height=10)
        time.sleep(0.01)
        r.create(name="New", width=20, height=20)
        items = r.list_all()
        assert items[0].name == "New"  # Más reciente primero

    def test_lazy_migration_sets_current_version(self, repo):
        r, snippets_dir = repo
        legacy = [
            {
                "id": "legacy",
                "name": "Legacy",
                "width": 10,
                "height": 10,
                "has_transparent": False,
                "ocr_detections": [],
                "text_erased": False,
                "created_at": datetime.now().isoformat(),
            }
        ]
        (snippets_dir / "index.json").write_text(json.dumps(legacy, ensure_ascii=False))
        r._cache = {}
        r._meta_cache = {}
        r._load()
        snippet = r.get("legacy")
        assert snippet is not None
        assert snippet.current_version == 1

    def test_load_save_snippet_meta_roundtrip(self, repo):
        r, snippets_dir = repo
        snippet = r.create(name="Meta", width=30, height=30)
        meta_path = snippets_dir / f"{snippet.id}_meta.json"
        assert meta_path.exists()
        meta = r.load_snippet_meta(snippet.id)
        assert meta["versions"][0]["version"] == 1
        meta["ops"].append({"type": "remove_bg"})
        r.save_snippet_meta(snippet.id, meta)
        reloaded = r.load_snippet_meta(snippet.id)
        assert reloaded["ops"] == meta["ops"]

    def test_delete_cleans_meta_and_versions(self, repo):
        r, snippets_dir = repo
        snippet = r.create(name="Clean", width=40, height=40)
        meta_path = snippets_dir / f"{snippet.id}_meta.json"
        version_path = snippets_dir / f"{snippet.id}_v2.png"
        meta_path.write_text(meta_path.read_text(encoding="utf-8"))  # ensure file exists
        version_path.write_bytes(b"fake")
        assert r.delete(snippet.id) is True
        assert not meta_path.exists()
        assert not version_path.exists()


# ---------- Tests de eliminación de fondo ----------

class TestRemoveBackground:
    def test_white_pixels_become_transparent(self):
        from app.api.snippets import _remove_white_background
        img = Image.new("RGB", (10, 10), color=(255, 255, 255))
        result = _remove_white_background(img, threshold=240)
        assert result.mode == "RGBA"
        arr = np.array(result)
        assert (arr[:, :, 3] == 0).all()

    def test_dark_pixels_stay_opaque(self):
        from app.api.snippets import _remove_white_background
        img = Image.new("RGB", (10, 10), color=(0, 0, 0))
        result = _remove_white_background(img, threshold=240)
        arr = np.array(result)
        assert (arr[:, :, 3] == 255).all()

    def test_mixed_image(self):
        from app.api.snippets import _remove_white_background
        img = Image.new("RGB", (10, 10), color=(255, 255, 255))
        for x in range(10):
            img.putpixel((x, 0), (0, 0, 0))
        result = _remove_white_background(img, threshold=240)
        arr = np.array(result)
        assert (arr[0, :, 3] == 255).all()   # Primera fila: opaca
        assert (arr[1:, :, 3] == 0).all()    # Resto: transparente

    def test_threshold_boundary(self):
        from app.api.snippets import _remove_white_background
        # Gris claro (luminancia ~230) con threshold 240 → debe quedar opaco
        img = Image.new("RGB", (5, 5), color=(230, 230, 230))
        result = _remove_white_background(img, threshold=240)
        arr = np.array(result)
        assert (arr[:, :, 3] == 255).all()

    def test_rgba_input(self):
        from app.api.snippets import _remove_white_background
        img = Image.new("RGBA", (5, 5), color=(255, 255, 255, 255))
        result = _remove_white_background(img, threshold=240)
        arr = np.array(result)
        assert (arr[:, :, 3] == 0).all()


# ---------- Tests de API endpoints ----------
# Estos tests importan app.main que reescribe sys.stdout.
# Ejecutar con: pytest tests/test_snippets.py -s -v

class TestSnippetsAPI:
    @pytest.fixture(autouse=True)
    def setup_client(self, snippets_dir):
        """Crea TestClient parcheando SNIPPETS_DIR y el repo singleton."""
        from app.db.repository import SnippetsRepository
        test_repo = SnippetsRepository()
        test_repo.INDEX_FILE = snippets_dir / "index.json"
        test_repo._cache = {}
        
        with patch("app.api.snippets.SNIPPETS_DIR", snippets_dir), \
             patch("app.api.snippets.snippets_repo", test_repo), \
             patch("app.services.snippet_service.SNIPPETS_DIR", snippets_dir), \
             patch("app.services.snippet_service.snippets_repo", test_repo):
            from app.main import app
            from fastapi.testclient import TestClient
            self.client = TestClient(app)
            self.snippets_dir = snippets_dir
            yield

    def test_list_empty(self):
        resp = self.client.get("/snippets")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_upload_and_list(self, sample_png_bytes):
        resp = self.client.post(
            "/snippets/upload",
            files={"file": ("test.png", sample_png_bytes, "image/png")},
            data={"name": "Test Upload", "remove_bg": "false"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Upload"
        assert data["width"] == 100
        assert data["height"] == 80
        assert data["has_transparent"] is False
        
        resp2 = self.client.get("/snippets")
        assert resp2.status_code == 200
        assert len(resp2.json()) == 1

    def test_upload_with_remove_bg(self, white_bg_png_bytes):
        resp = self.client.post(
            "/snippets/upload",
            files={"file": ("circuit.png", white_bg_png_bytes, "image/png")},
            data={"name": "Circuit", "remove_bg": "true"},
        )
        assert resp.status_code == 200
        assert resp.json()["has_transparent"] is True
        # Verificar que se creó el archivo _nobg.png
        snippet_id = resp.json()["id"]
        assert (self.snippets_dir / f"{snippet_id}_nobg.png").exists()

    def test_get_image(self, sample_png_bytes):
        resp = self.client.post(
            "/snippets/upload",
            files={"file": ("test.png", sample_png_bytes, "image/png")},
            data={"name": "Img", "remove_bg": "false"},
        )
        snippet_id = resp.json()["id"]
        resp2 = self.client.get(f"/snippets/{snippet_id}/image")
        assert resp2.status_code == 200
        assert "image/png" in resp2.headers["content-type"]

    def test_get_image_transparent(self, white_bg_png_bytes):
        resp = self.client.post(
            "/snippets/upload",
            files={"file": ("c.png", white_bg_png_bytes, "image/png")},
            data={"name": "C", "remove_bg": "true"},
        )
        snippet_id = resp.json()["id"]
        resp2 = self.client.get(f"/snippets/{snippet_id}/image?transparent=true")
        assert resp2.status_code == 200
        img = Image.open(io.BytesIO(resp2.content))
        assert img.mode == "RGBA"

    def test_get_base64(self, sample_png_bytes):
        resp = self.client.post(
            "/snippets/upload",
            files={"file": ("test.png", sample_png_bytes, "image/png")},
            data={"name": "B64", "remove_bg": "false"},
        )
        snippet_id = resp.json()["id"]
        resp2 = self.client.get(f"/snippets/{snippet_id}/base64")
        assert resp2.status_code == 200
        data = resp2.json()
        assert "base64" in data
        assert data["width"] == 100
        assert data["height"] == 80
        assert len(data["base64"]) > 0

    def test_delete_snippet(self, sample_png_bytes):
        resp = self.client.post(
            "/snippets/upload",
            files={"file": ("test.png", sample_png_bytes, "image/png")},
            data={"name": "Del", "remove_bg": "false"},
        )
        snippet_id = resp.json()["id"]
        resp2 = self.client.delete(f"/snippets/{snippet_id}")
        assert resp2.status_code == 200
        resp3 = self.client.get(f"/snippets/{snippet_id}/image")
        assert resp3.status_code == 404

    def test_delete_nonexistent(self):
        resp = self.client.delete("/snippets/nonexistent-id")
        assert resp.status_code == 404

    def test_get_image_nonexistent(self):
        resp = self.client.get("/snippets/nonexistent-id/image")
        assert resp.status_code == 404

    def test_upload_invalid_file(self):
        resp = self.client.post(
            "/snippets/upload",
            files={"file": ("test.txt", b"not an image", "text/plain")},
            data={"name": "Bad", "remove_bg": "false"},
        )
        assert resp.status_code == 400

    def test_capture_without_project(self):
        resp = self.client.post(
            "/snippets/capture",
            json={
                "project_id": "nonexistent",
                "page_number": 0,
                "bbox": [0, 0, 100, 100],
                "name": "Test",
                "remove_bg": False,
            },
        )
        assert resp.status_code == 404

    def test_patch_with_propagate_returns_updated_count(self, sample_png_bytes):
        create_resp = self.client.post(
            "/snippets/upload",
            files={"file": ("test.png", sample_png_bytes, "image/png")},
            data={"name": "Prop", "remove_bg": "false"},
        )
        assert create_resp.status_code == 200
        snippet_id = create_resp.json()["id"]

        fake_drawings_repo = MagicMock()
        fake_drawings_repo.propagate_snippet_image.return_value = 2

        with patch("app.api.snippets.drawings_repo", fake_drawings_repo):
            resp = self.client.patch(
                f"/snippets/{snippet_id}",
                json={
                    "comment": "propagate",
                    "propagate": {
                        "enabled": True,
                        "scope": "current_page",
                        "project_id": "p1",
                        "page_number": 0,
                    },
                },
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["updated_count"] == 2
        fake_drawings_repo.propagate_snippet_image.assert_called_once()

    def test_patch_propagate_enabled_requires_project_id(self, sample_png_bytes):
        create_resp = self.client.post(
            f"/snippets/upload",
            files={"file": ("test.png", sample_png_bytes, "image/png")},
            data={"name": "PropErr", "remove_bg": "false"},
        )
        assert create_resp.status_code == 200
        snippet_id = create_resp.json()["id"]

        resp = self.client.patch(
            f"/snippets/{snippet_id}",
            json={
                "comment": "propagate",
                "propagate": {
                    "enabled": True,
                    "scope": "current_page",
                    "page_number": 0,
                },
            },
        )

        assert resp.status_code == 400

    def test_patch_ocr_replace_text_updates_detections(self, sample_png_bytes):
        create_resp = self.client.post(
            "/snippets/upload",
            files={"file": ("test.png", sample_png_bytes, "image/png")},
            data={"name": "OCRReplace", "remove_bg": "false"},
        )
        assert create_resp.status_code == 200
        snippet_id = create_resp.json()["id"]

        resp = self.client.patch(
            f"/snippets/{snippet_id}",
            json={
                "ops": [
                    {
                        "type": "ocr_replace_text",
                        "payload": {
                            "regions": [
                                {
                                    "bbox": [10, 10, 40, 25],
                                    "text": "L1_NEW",
                                    "confidence": 0.99,
                                }
                            ],
                            "shrink_px": 2,
                        },
                    }
                ],
                "comment": "replace text",
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["ocr_detections"][0]["text"] == "L1_NEW"
        assert data["current_version"] == 2

    def test_patch_draw_overlay_creates_new_version(self, sample_png_bytes):
        create_resp = self.client.post(
            "/snippets/upload",
            files={"file": ("test.png", sample_png_bytes, "image/png")},
            data={"name": "DrawOverlay", "remove_bg": "false"},
        )
        assert create_resp.status_code == 200
        snippet_id = create_resp.json()["id"]

        resp = self.client.patch(
            f"/snippets/{snippet_id}",
            json={
                "ops": [
                    {
                        "type": "draw_overlay",
                        "payload": {
                            "elements": [
                                {
                                    "element_type": "line",
                                    "points": [5, 5, 80, 5],
                                    "stroke_color": "#ff0000",
                                    "stroke_width": 2,
                                    "fill_color": None,
                                    "text": None,
                                    "font_size": 14,
                                    "font_family": "Arial",
                                    "text_color": "#ff0000",
                                }
                            ]
                        },
                    }
                ],
                "comment": "draw overlay",
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["current_version"] == 2

    def test_patch_consecutive_ocr_replace_text(self, sample_png_bytes):
        """Regression test: two consecutive OCR replace operations should increment version correctly."""
        create_resp = self.client.post(
            "/snippets/upload",
            files={"file": ("test.png", sample_png_bytes, "image/png")},
            data={"name": "ConsecutiveOCR", "remove_bg": "false"},
        )
        assert create_resp.status_code == 200
        snippet_id = create_resp.json()["id"]

        # First OCR replace
        resp1 = self.client.patch(
            f"/snippets/{snippet_id}",
            json={
                "ops": [
                    {
                        "type": "ocr_replace_text",
                        "payload": {
                            "regions": [
                                {
                                    "bbox": [10, 10, 40, 25],
                                    "text": "FIRST",
                                    "confidence": 0.95,
                                    "font_size_ui": 100,
                                }
                            ],
                            "shrink_px": 2,
                        },
                    }
                ],
                "comment": "first replace",
            },
        )
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1["current_version"] == 2
        assert data1["ocr_detections"][0]["text"] == "FIRST"

        # Second OCR replace on same region with different text
        resp2 = self.client.patch(
            f"/snippets/{snippet_id}",
            json={
                "ops": [
                    {
                        "type": "ocr_replace_text",
                        "payload": {
                            "regions": [
                                {
                                    "bbox": [10, 10, 40, 25],
                                    "text": "SECOND",
                                    "confidence": 0.95,
                                    "font_size_ui": 120,
                                }
                            ],
                            "shrink_px": 2,
                        },
                    }
                ],
                "comment": "second replace",
            },
        )
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["current_version"] == 3
        assert data2["ocr_detections"][0]["text"] == "SECOND"
        # Verify font_size_ui is preserved
        assert data2["ocr_detections"][0].get("font_size_ui") == 120
