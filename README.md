# NB7X Translator

Aplicación de escritorio para Windows 10/11 que traduce **PDFs de imagen** (esquemas eléctricos) de **chino (ZH)** a **español (ES)**.

## Características

- Renderiza PDFs de imagen a PNG de alta resolución (450/600 DPI)
- Detecta texto chino usando PaddleOCR
- Traduce automáticamente usando DeepL API
- Compone el texto traducido sobre la imagen original (modo PATCH)
- Glosario editable para consistencia terminológica
- Exporta PDF final con traducciones

## Arquitectura

- **Backend**: Python 3.11 + FastAPI (solo loopback `127.0.0.1`)
- **Desktop**: Electron + React (Vite) + TailwindCSS
- **OCR**: PaddleOCR (chino)
- **Traducción**: DeepL API

## Requisitos

- Windows 10/11
- Python 3.11+
- Node.js 18+

## Instalación (Desarrollo)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Desktop

```bash
cd desktop
npm install
```

## Ejecución (Desarrollo)

### 1. Iniciar Backend

```bash
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Verificar: `GET http://127.0.0.1:8000/health`

### 2. Iniciar Desktop

```bash
cd desktop
npm run dev
```

O con Electron:

```bash
npm run electron:dev
```

## Build (Producción)

### 1. Empaquetar Backend

```bash
npm run build:backend
```

Genera el backend empaquetado con PyInstaller en `desktop/resources/backend/`.

### 2. Generar Instalador Windows

```bash
cd desktop
npm run build:win
```

Genera el instalador NSIS `.exe` en `desktop/dist-electron/`.

## Estructura del Proyecto

```
├── backend/
│   ├── app/
│   │   ├── api/           # Endpoints FastAPI
│   │   ├── db/            # Modelos y repositorios
│   │   ├── services/      # Lógica de negocio
│   │   ├── config.py      # Configuración
│   │   └── main.py        # Entrada FastAPI
│   └── requirements.txt
├── desktop/
│   ├── electron/          # Main process Electron
│   ├── src/               # UI React
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
│   └── package.json
├── .windsurf/             # Configuración Windsurf
└── AGENTS.md              # Guía del proyecto
```

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/projects` | Crear proyecto (upload PDF) |
| GET | `/projects` | Listar proyectos |
| GET | `/projects/{id}` | Obtener proyecto |
| POST | `/projects/{id}/pages/{n}/render-original` | Renderizar página |
| POST | `/projects/{id}/pages/{n}/ocr` | Ejecutar OCR |
| GET | `/projects/{id}/pages/{n}/text-regions` | Obtener regiones de texto |
| PATCH | `/projects/{id}/text-regions/{rid}` | Actualizar región |
| POST | `/projects/{id}/pages/{n}/render-translated` | Componer traducción |
| GET/PUT | `/projects/{id}/glossary` | Glosario |
| POST | `/projects/{id}/glossary/apply` | Aplicar glosario |
| POST | `/projects/{id}/jobs/render-all/async` | Procesar todo (async) |
| POST | `/projects/{id}/export/pdf` | Exportar PDF |

## Persistencia

Los datos se almacenan en `%APPDATA%\NB7XTranslator\`:

```
projects/
  {project_id}/
    src.pdf
    meta.json
    pages/
      000_original_450.png
      000_translated_450.png
    thumbs/
    export/
jobs/
logs/
```

## Configuración

- **DeepL API Key**: Configurar en Settings de la app (persistente en `%APPDATA%\\NB7XTranslator\\config.json`)
- **DPI por defecto**: 450 (configurable: 300, 450, 600)
- **Filtro OCR Han**: % mínimo de caracteres chinos (Han) configurable desde Settings

## Seguridad

- Backend solo escucha en `127.0.0.1` (loopback)
- CORS restringido a origen local
- No se almacenan API keys en el código

## Windsurf

- Configuración y automatizaciones en `.windsurf/`
- Workflows:
  - `/smoke-test`
  - `/build-backend`
  - `/build-installer-win`
  - `/release-checklist`
  - `/add-skill`
- Skills:
  - `antivirus-false-positive-mitigation`
  - `build-exe-pyinstaller`
  - `configurar-windsurf-proyecto`
  - `deps-freeze-requirements`
  - `dxf-export-validator`
  - `gestionar-repo-git-github`
  - `idear-diseno`
  - `log-collector`
  - `manejar-errores`
  - `planificar-implementacion`
  - `release-packager`
  - `skill-master`
  - `ui-label-tweaks`

## Licencia

Privado - Todos los derechos reservados
