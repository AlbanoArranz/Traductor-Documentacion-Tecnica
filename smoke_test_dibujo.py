#!/usr/bin/env python3
"""
Smoke test automatizado para la herramienta de dibujo.
Prueba: crear proyecto → renderizar → OCR → crear drawings → componer
"""

import requests
import json
import time
import sys
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
PDF_PATH = Path("Esquema Electrico NB7X Kyria girado 1-3.pdf")
# Nota: PaddleOCR no es compatible con Python 3.13 debido a conflictos de numpy.
# El smoke test usa EasyOCR (motor por defecto).


def log(msg):
    print(f"[SMOKE TEST] {msg}")


def check_response(r, step):
    if r.status_code >= 200 and r.status_code < 300:
        log(f"✓ {step}")
        return True
    else:
        log(f"✗ {step}: HTTP {r.status_code}")
        log(f"  Response: {r.text[:200]}")
        return False


def main():
    log("Iniciando smoke test...")
    
    # 1. Health check
    r = requests.get(f"{BASE_URL}/health")
    if not check_response(r, "Health check"):
        sys.exit(1)
    
    # 2. Crear proyecto
    log("Creando proyecto...")
    if not PDF_PATH.exists():
        log(f"✗ No se encuentra el PDF: {PDF_PATH}")
        sys.exit(1)
    
    with open(PDF_PATH, "rb") as f:
        files = {"file": (PDF_PATH.name, f, "application/pdf")}
        r = requests.post(
            f"{BASE_URL}/projects?name=SmokeTestDibujo&document_type=schematic&rotation=0",
            files=files
        )
    
    if not check_response(r, "Crear proyecto"):
        sys.exit(1)
    
    project = r.json()
    project_id = project["id"]
    log(f"  Project ID: {project_id}")
    page_count = int(project.get("page_count") or 0)
    if page_count <= 0:
        log("✗ El proyecto tiene page_count=0")
        sys.exit(1)
    
    # 3. Seleccionar página (0-based). Nota: /pages solo devuelve páginas materializadas en pages.json
    page_number = 0
    log(f"  Página (0-based): {page_number} / page_count={page_count}")
    
    # 4. Renderizar original
    log("Renderizando página original...")
    r = requests.post(f"{BASE_URL}/projects/{project_id}/pages/{page_number}/render-original?dpi=150")
    if not check_response(r, "Render original"):
        sys.exit(1)

    # Verificación opcional: ahora sí debería aparecer en /pages
    r = requests.get(f"{BASE_URL}/projects/{project_id}/pages")
    if check_response(r, "Listar páginas (post-render)"):
        pages = r.json()
        log(f"  /pages devuelve {len(pages)} páginas materializadas")
    
    # 5. OCR
    log("Ejecutando OCR...")
    r = requests.post(f"{BASE_URL}/projects/{project_id}/pages/{page_number}/ocr?dpi=150")
    if not check_response(r, "OCR"):
        sys.exit(1)
    
    # 6. Crear elementos de dibujo
    log("Creando elementos de dibujo...")
    
    # Línea
    r = requests.post(
        f"{BASE_URL}/projects/{project_id}/pages/{page_number}/drawings",
        json={
            "element_type": "line",
            "points": [100, 100, 300, 200],
            "stroke_color": "#FF0000",
            "stroke_width": 3
        }
    )
    if not check_response(r, "Crear línea"):
        sys.exit(1)
    
    # Rectángulo
    r = requests.post(
        f"{BASE_URL}/projects/{project_id}/pages/{page_number}/drawings",
        json={
            "element_type": "rect",
            "points": [400, 100, 600, 250],
            "stroke_color": "#0000FF",
            "stroke_width": 2,
            "fill_color": "#E0E0FF"
        }
    )
    if not check_response(r, "Crear rectángulo"):
        sys.exit(1)
    
    # Texto
    r = requests.post(
        f"{BASE_URL}/projects/{project_id}/pages/{page_number}/drawings",
        json={
            "element_type": "text",
            "points": [100, 400],
            "text": "PRUEBA DIBUJO",
            "font_size": 20,
            "text_color": "#00AA00"
        }
    )
    if not check_response(r, "Crear texto"):
        sys.exit(1)
    
    # 7. Listar drawings
    r = requests.get(f"{BASE_URL}/projects/{project_id}/pages/{page_number}/drawings")
    if check_response(r, "Listar drawings"):
        drawings = r.json()
        log(f"  Total drawings creados: {len(drawings)}")
    
    # 8. Componer (renderizar traducida con drawings)
    log("Componiendo imagen traducida con drawings...")
    r = requests.post(f"{BASE_URL}/projects/{project_id}/pages/{page_number}/render-translated?dpi=150")
    if not check_response(r, "Componer traducida"):
        sys.exit(1)
    
    # 9. Verificar imagen traducida existe
    r = requests.get(f"{BASE_URL}/projects/{project_id}/pages/{page_number}/image?kind=translated&dpi=150")
    if check_response(r, "Obtener imagen traducida"):
        log(f"  Imagen traducida: {len(r.content)} bytes")
    
    # 10. Exportar PDF
    log("Exportando PDF...")
    r = requests.post(f"{BASE_URL}/projects/{project_id}/export/pdf?dpi=150")
    if not check_response(r, "Exportar PDF"):
        sys.exit(1)
    
    log("=" * 50)
    log("✓ SMOKE TEST COMPLETADO EXITOSAMENTE")
    log("=" * 50)
    log(f"Proyecto: {project_id}")
    log("Flujo: Crear → Render → OCR → Dibujar → Componer → Exportar ✓")


if __name__ == "__main__":
    main()
