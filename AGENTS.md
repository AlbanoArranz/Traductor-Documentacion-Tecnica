# AGENTS.md — NB7X Translator (Windows Desktop)

Piensa en este archivo como un README para agentes de programación: contexto, comandos, invariantes, convenciones **y** cómo debemos configurar Windsurf (Rules/Workflows/Memories/Skills/Hooks) siguiendo la documentación oficial.

> Nota: Windsurf aplica instrucciones de `AGENTS.md` por **alcance de directorio** (root = global; subcarpetas = más específico). :contentReference[oaicite:0]{index=0}

---

## Resumen del proyecto
- App de escritorio Windows 10/11 para traducir **PDFs de imagen** (esquemas eléctricos) de **chino (ZH)** a **español (ES)**.
- Sustituye **solo** el texto chino por texto en español **en el mismo lugar**, preservando el resto del esquema.
- UI: Electron + React (Vite). Motor local: Python 3.11 + FastAPI (solo loopback).

## Plataforma objetivo
- Windows 10/11.
- Distribución final: instalador `.exe` (NSIS) con electron-builder.
- Usuario final **no** instala Python/Node (backend embebido con PyInstaller).

---

## Comandos de desarrollo (DX)
> Mantén el README alineado con estos comandos.

### Backend (dev)
- Crear venv e instalar deps: `pip install -r backend/requirements.txt`
- Ejecutar: `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`
- Health: `GET http://127.0.0.1:8000/health`

### Desktop (dev)
- Instalar: `cd desktop && npm install`
- Ejecutar: `npm run dev`
- En dev, Electron debe:
  - arrancar el backend Python como proceso hijo **o**
  - conectarse al backend si ya está levantado (elige uno y documenta; evita mantener ambos si no aportan).

---

## Build / Release (Windows)
### Invariantes de build (no cambiar salvo petición explícita)
- Backend empaquetado con **PyInstaller en modo onefolder** (preferido).
- Electron empaquetado con **electron-builder + NSIS**.
- El backend empaquetado debe copiarse como `extraResources` y ejecutarse desde `process.resourcesPath`.

### Comandos esperados
- `npm run build:backend` → PyInstaller (onefolder) y copia a `desktop/resources/backend/` (o ruta equivalente).
- `npm run build:win` → build UI y genera instalador NSIS `.exe`.

---

## Rutas Windows (persistencia)
- Base de datos y archivos del usuario final en:
  - `%APPDATA%\\NB7XTranslator\\`
    - `projects\\<project_id>\\src.pdf`
    - `projects\\<project_id>\\pages\\000_original_450.png`
    - `projects\\<project_id>\\pages\\000_translated_450.png`
    - `projects\\<project_id>\\thumbs\\...`
    - `projects\\<project_id>\\export\\export_450.pdf`
    - `jobs\\<job_id>.json`
    - `logs\\backend.log` y/o `logs\\desktop.log`
- Reglas:
  - Soportar espacios y backslashes.
  - Usar `pathlib` (Python) y `path`/`URL` (Node).
  - Nunca asumir permisos fuera de `%APPDATA%`.

---

## Archivos clave (lógica autoritativa)
> Si existe una ruta/servicio ya implementado, **extiéndelo**; no dupliques lógica.

### Backend (Python)
- `backend/app/main.py`: arranque FastAPI, routers, `/health`.
- `backend/app/api/`: endpoints de proyectos/páginas/glosario/export/jobs.
- `backend/app/services/render_service.py`: render PDF→PNG (PyMuPDF).
- `backend/app/services/ocr_service.py`: PaddleOCR (detección + filtro CJK + agrupación opcional).
- `backend/app/services/translate_service.py`: DeepL batch + fallback (sin API key).
- `backend/app/services/compose_service.py`: composición (PATCH default + INPAINT opcional).
- `backend/app/services/job_service.py`: jobs background + estado persistente JSON.
- `backend/app/services/export_service.py`: PDF final desde imágenes (tamaño físico por DPI).
- `backend/app/db/models.py`: Project, Page, TextRegion, GlossaryEntry.

### Desktop (Electron)
- `desktop/src/`: UI React (Home/Proyecto/Glosario/Settings).
- `desktop/electron/` (o `desktop/src-electron/`): main process (spawn backend, rutas resources, IPC mínimo).

---

## Invariantes críticos (NO romper)
### Seguridad y red
- Backend debe bindear **solo** a `127.0.0.1`. Nunca escuchar en `0.0.0.0`.
- Puerto preferido: **dinámico** (Electron elige puerto libre y lo pasa al backend por env `PORT`).
- Restringir CORS al origen local de la app.

### Pipeline de imagen (esquemas)
- El PDF es **imagen** (no vector): siempre trabajar con render a PNG.
- DPI por defecto: `450`. DPI alto: `600` (usar heurística por baja confianza o texto pequeño).
- Todo lo no chino debe permanecer intacto: **solo** se modifica el área de cada bbox de texto chino.

### Sustitución de texto: modo por defecto PATCH
- Default **PATCH**:
  - Estimar color de fondo a partir del **marco alrededor** del bbox (mediana).
  - Dibujar rectángulo con padding y escribir texto ES encima.
- Detector de conflicto “texto sobre líneas”:
  - Densidad de bordes (Canny) en la ROI del bbox.
  - Si hay conflicto: forzar padding bajo (≤3px) y mantener PATCH.
- **INPAINT**:
  - Solo opcional por caja (nunca por defecto).
  - Evitar si hay conflicto con líneas/cables.
- Auto-fit:
  - 1 línea; si no cabe, wrap a 2 líneas; reducir tamaño.
  - Si no cabe: `overflow=true` y marcar `needs_review`.

### OCR y filtro CJK
- PaddleOCR `use_angle_cls=True`, `lang="ch"`.
- Filtrar por ratio CJK (default `>= 0.2`).
- Guardar bbox en px + bbox normalizado para overlay.

### Glosario (consistencia terminológica)
- Tabla ZH→ES editable.
- `locked` por término: si existe, manda sobre MT.
- Al aplicar glosario: actualizar cajas no bloqueadas (`locked=false`) con mismo `src_text`.

### Cajetín común (plantilla)
- Implementar soporte para definir ROI de cajetín (por proyecto).
- MVP: permitir ignorar o procesar ROI; no implementar detección automática compleja sin petición explícita.

---

## Contrato de API (no romper sin migración)
Endpoints mínimos esperados:
- `GET /health`
- `POST /projects`
- `GET /projects/{id}`
- `GET /projects/{id}/pages`
- `POST /projects/{id}/pages/{n}/render-original?dpi=`
- `POST /projects/{id}/pages/{n}/ocr?dpi=`
- `GET /projects/{id}/pages/{n}/text-regions`
- `PATCH /projects/{id}/text-regions/{rid}`
- `POST /projects/{id}/pages/{n}/render-translated?dpi=`
- `GET /projects/{id}/pages/{n}/image?kind=original|translated&dpi=`
- `GET /projects/{id}/pages/{n}/thumbnail?kind=original|translated`
- `GET/PUT /projects/{id}/glossary`
- `POST /projects/{id}/glossary/apply`
- `POST /projects/{id}/render-all/async`
- `GET /projects/{id}/jobs/{job_id}`
- `POST /projects/{id}/export/pdf`
- `GET /projects/{id}/export/pdf/file`

---

# Windsurf DX: Rules, Workflows, Memories, Skills, Hooks (OBLIGATORIO en este repo)

## 1) Rules (workspace)
- Crear y versionar reglas en: `.windsurf/rules/` (en root o subcarpetas según alcance). :contentReference[oaicite:1]{index=1}
- Mantener reglas:
  - **cortas, específicas y accionables** (evitar vaguedad). :contentReference[oaicite:2]{index=2}
  - sin redundancia con `AGENTS.md` (AGENTS = por directorio; Rules = activación por “Always/Glob/Manual/Model decision”). :contentReference[oaicite:3]{index=3}
- Activación: preferir `Glob` por carpeta (`backend/**`, `desktop/**`) y `Manual` para reglas raras. :contentReference[oaicite:4]{index=4}

**Reglas mínimas a crear (archivos separados):**
- `.windsurf/rules/backend-python.md` → estilo Python, FastAPI, typing, logging, seguridad loopback, pathlib.
- `.windsurf/rules/desktop-electron.md` → recursos `process.resourcesPath`, spawn backend, puertos, rutas Windows.
- `.windsurf/rules/build-release.md` → PyInstaller onefolder + electron-builder NSIS + no romper scripts.
- `.windsurf/rules/security.md` → no abrir red, no secretos en repo, validar rutas.

> Nota: crea estas rules como parte del setup inicial del repo.

## 2) Workflows (slash commands)
- Crear workflows en `.windsurf/workflows/` (descubiertos en workspace y subdirectorios; invocables con `/nombre`). :contentReference[oaicite:5]{index=5}
- Los workflows deben ser repetibles y step-by-step; permiten llamar otros workflows desde dentro. :contentReference[oaicite:6]{index=6}

**Workflows mínimos a crear:**
- `.windsurf/workflows/smoke-test.md` → ejecuta el smoke test (carga PDF demo, render, OCR, compose, export).
- `.windsurf/workflows/build-backend.md` → empaqueta backend con PyInstaller y copia a resources.
- `.windsurf/workflows/build-installer-win.md` → build completo del instalador NSIS.
- `.windsurf/workflows/release-checklist.md` → checklist de versionado, changelog, artefactos, verificación.
- `.windsurf/workflows/add-skill.md` → guía para crear una Skill usando `skill-master`.

## 3) Skills (carpetas invocables)
- Skills se guardan como carpetas con `SKILL.md` y recursos adicionales en `.windsurf/skills/<skill-name>/`. :contentReference[oaicite:7]{index=7}
- Reglas:
  - nombre en minúsculas con números y guiones.
  - `SKILL.md` con YAML frontmatter: `name` y `description` obligatorios. :contentReference[oaicite:8]{index=8}
  - Incluir plantillas, checklists, scripts y ejemplos dentro de la carpeta. :contentReference[oaicite:9]{index=9}

**Skill-master (obligatorio usarlo)**
- Este repo ya tiene `skill-master` para crear skills: úsalo como herramienta estándar.
- Política: no escribir skills “a mano” si `skill-master` puede generarlas (consistencia y ahorro de tiempo).

**Skills mínimas a crear (con skill-master):**
- `pipeline-page-translate` → “de PNG a traducida”: render→OCR→DeepL/glosario→compose→persist flags.
- `glossary-management` → import/export CSV + aplicar glosario + estrategia terminológica.
- `windows-packaging` → PyInstaller onefolder + electron-builder + recursos + troubleshooting Paddle.
- `roi-cajetin-setup` → configurar ROI cajetín y pruebas.
- `debug-ocr-quality` → heurísticas DPI 600, thresholds, agrupación de cajas.

## 4) Memories (Windsurf Customizations)
- Las Memories se gestionan en la UI de Windsurf (Customizations) y son por workspace; Cascade puede autogenerarlas o puedes pedir “create a memory of …”. :contentReference[oaicite:10]{index=10}
- Política del repo:
  - Guardar decisiones **duraderas** en el repo (AGENTS/Rules/Skills/Workflows).
  - Usar Memories solo para “preferencias operativas” o recordatorios del equipo (no como única fuente de verdad).

**Memories recomendadas a crear en el workspace:**
- “Este proyecto es Windows Desktop con backend local loopback; no abrir red.”
- “Default composition = PATCH; INPAINT solo manual por caja.”
- “Build distribuible: PyInstaller onefolder + electron-builder NSIS; backend dentro de resources.”
- “Datos en %APPDATA%\\NB7XTranslator\\; rutas deben soportar espacios.”

## 5) Hooks (workspace)
- Hooks permiten ejecutar comandos shell en eventos de Cascade (pre/post read/write/run/etc). :contentReference[oaicite:11]{index=11}
- Configuración por workspace (versionada): `.windsurf/hooks.json` en la raíz del workspace. :contentReference[oaicite:12]{index=12}
- Estructura: JSON con `hooks` y eventos; `show_output: true` en desarrollo. :contentReference[oaicite:13]{index=13}
- Pre-hooks pueden **bloquear** acciones (exit code `2`). :contentReference[oaicite:14]{index=14}

**Hooks mínimos a añadir (en `.windsurf/hooks.json` + scripts en `.windsurf/scripts/`):**
- `post_write_code`:
  - backend: ejecutar `ruff`/`black` o al menos `python -m compileall backend` (rápido).
  - desktop: `npm run lint` (si existe) o `npm run typecheck`.
- `pre_run_command`:
  - bloquear comandos peligrosos por defecto (p.ej. `rm -rf`, `del /s`, etc.) salvo whitelist.
- `post_cascade_response`:
  - log simple a `.windsurf/logs/cascade.log` para auditoría local (opcional, ligero).

> Mantén hooks **rápidos** (evitar tests largos en cada write). Para QA pesada usa workflows.

---

## Testing (smoke test)
Tras cambios, ejecutar un smoke test manual rápido:
1) Abrir PDF (crear proyecto).
2) Render página 0 (450 DPI).
3) OCR página 0 (ver cajas).
4) Traducir y render traducida (PATCH).
5) Editar 1 caja (tgt_text), bloquearla, re-render página.
6) Exportar PDF final y abrirlo.
7) Probar “Procesar todo” (job async) y verificar progreso y finalización.

---

## Higiene del repo (reglas de cambios)
- Evitar cambios innecesarios fuera del alcance.
- No crear sistemas alternativos de build si ya existe PyInstaller + electron-builder, salvo petición explícita.
- No sobrescribir `.env` ni secretos (DeepL API key se guarda en storage del usuario).
- No dejar funciones/componentes/variables sin usar.
- Reutilizar patrones existentes (servicios y routers) en lugar de duplicar lógica.

---

## Notas Windows
- Paddle/PaddleOCR en Windows puede requerir VC++ Redistributable: si OCR falla, mostrar aviso claro en UI (no crashear silenciosamente).
- En producción usar `process.resourcesPath` para localizar backend y assets.

