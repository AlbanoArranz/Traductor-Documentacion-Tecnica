#!/usr/bin/env python3
"""
Smoke test completo para herramientas de dibujo incluyendo círculos.
Prueba: crear proyecto → renderizar → OCR → crear drawings (línea, rect, círculo, texto) → componer → exportar
"""

import requests
import json
import time
import sys
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
PDF_PATH = Path("Esquema Electrico NB7X Kyria girado 1-3.pdf")


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
    log("Iniciando smoke test completo de dibujos...")
    
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
    
    # 3. Seleccionar página (0-based)
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
    
    # Círculo relleno
    r = requests.post(
        f"{BASE_URL}/projects/{project_id}/pages/{page_number}/drawings",
        json={
            "element_type": "circle",
            "points": [700, 100, 900, 300],
            "stroke_color": "#00FF00",
            "stroke_width": 2,
            "fill_color": "#CCFFCC"
        }
    )
    if not check_response(r, "Crear círculo relleno"):
        sys.exit(1)
    
    # Elipse sin relleno (solo borde)
    r = requests.post(
        f"{BASE_URL}/projects/{project_id}/pages/{page_number}/drawings",
        json={
            "element_type": "circle",
            "points": [200, 400, 500, 550],
            "stroke_color": "#FF00FF",
            "stroke_width": 3
        }
    )
    if not check_response(r, "Crear elipse sin relleno"):
        sys.exit(1)
    
    # Texto
    r = requests.post(
        f"{BASE_URL}/projects/{project_id}/pages/{page_number}/drawings",
        json={
            "element_type": "text",
            "points": [100, 600],
            "text": "PRUEBA DIBUJO COMPLETO",
            "font_size": 20,
            "text_color": "#00AA00"
        }
    )
    if not check_response(r, "Crear texto"):
        sys.exit(1)
    
    # 7. Listar drawings y verificar conteo
    r = requests.get(f"{BASE_URL}/projects/{project_id}/pages/{page_number}/drawings")
    if check_response(r, "Listar drawings"):
        drawings = r.json()
        expected_count = 5
        if len(drawings) == expected_count:
            log(f"  ✓ Total drawings creados: {len(drawings)} (línea, rect, 2 círculos, texto)")
        else:
            log(f"  ✗ Esperaba {expected_count} drawings, hay {len(drawings)}")
            sys.exit(1)
    
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
    log("Elementos creados:")
    log("  - Línea (roja, 3px)")
    log("  - Rectángulo (azul relleno)")
    log("  - Círculo (verde relleno)")
    log("  - Elipse (magenta, sin relleno)")
    log("  - Texto (verde, 20px)")
    log("Flujo: Crear → Render → OCR → Dibujar → Componer → Exportar ✓")


if __name__ == "__main__":
    main()
