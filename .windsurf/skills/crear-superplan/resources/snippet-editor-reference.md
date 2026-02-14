# Snippet Editor V2 Reference Plan

Fuente original: `C:/Users/Lenovo/.windsurf/plans/snippet-editor-v2-15a5e6.md`

> Usa este recurso como guía completa paso a paso cuando la skill "crear-superplan" indique que debes consultar el plan de referencia.

---

## Uso

Este recurso explica **cómo consultar el plan maestro original** y qué elementos debes recordar al adaptarlo.

1. El plan completo vive en: `C:/Users/Lenovo/.windsurf/plans/snippet-editor-v2-15a5e6.md`.
2. Cuando necesites generar un superplan:
   - Abre el archivo original y estudia sus secciones principales (Principios, Puntos críticos, Fases 1-7, Modelo de datos, Reglas, Riesgos).
   - Decide qué partes aplican al nuevo cambio y cuáles deben omitirse.
   - Copia solo los conceptos necesarios, no el texto íntegro.

## Elementos clave a recordar

- **Principios**: cambios incrementales, verificación obligatoria, revertir si una fase falla.
- **Puntos críticos**: detectar cuellos de botella (persistencia, versionado, propagación, UX, tests, tamaño de componentes).
- **Fases**: cada una define objetivo → cambios → verificación. Mantener esta estructura.
- **Modelo de datos**: Snippet con `current_version`, meta por archivo, `source_snippet_id` en drawings.
- **Reglas técnicas**: no tocar CaptureDialog, versionado append-only, persistencia atómica, QA post-save.
- **Riesgos**: migraciones, corrupción de index, performance en propagación, paridad web/Electron.

## Cómo adaptar el plan

1. **Clasificar el alcance**: ¿aplica a snippets, OCR, frontend, propagación, u otros módulos?
2. **Seleccionar fases**: reutiliza las existentes o crea nuevas manteniendo el mismo patrón (Objetivo/Cambios/Verificación).
3. **Actualizar verificaciones**: especifica tests (pytest, npm run build), QA manual y criterios de salida.
4. **Personalizar riesgos**: lista riesgos nuevos y asocia mitigaciones.
5. **Documentar principios**: incluye siempre la idea de "no avanzar sin green".

## Plantilla base para cada fase

```
### Fase N — [Nombre]

**Objetivo**: ...

**Cambios**:
- ...

**Verificación**:
- [ ] pytest ...
- [ ] npm run build ...
- [ ] QA manual ...
```

## Recomendaciones

- Limita el superplan a ≤ 500 líneas. Si necesitas más, mueve detalles a anexos.
- Usa tablas para riesgos/mitigaciones cuando añadas nuevos puntos.
- Mantén referencias claras al plan original cuando reutilices ideas.

---

## Plan de referencia completo

```markdown
# Snippet Editor V2: Edición avanzada + Versionado + Propagación

Implementación incremental con verificación obligatoria tras cada fase. Cada fase produce un entregable testeable antes de avanzar a la siguiente.

---

## Principio rector: Cambios incrementales verificables

- **Cada fase es un commit lógico** que deja la app funcional
- **No se avanza a Fase N+1** sin haber verificado Fase N (tests backend + QA manual front)
- **Si una fase rompe algo**, se revierte antes de continuar
- **El usuario ejecuta los comandos de test** y confirma que pasa antes de seguir

---

## Puntos críticos identificados

### ⚠️ C1: DrawingElement no guarda snippet_id → propagación imposible
Al colocar un snippet en canvas se crea un `DrawingElement` con `image_data=base64` pero sin `snippet_id`. Imposible saber qué drawings vinieron de qué snippet.
**Solución**: Campo opcional `source_snippet_id` en toda la cadena (models → repo → API → frontend). Default `None`, backward-compatible.

### ⚠️ C2: Renombrar {id}.png rompe datos existentes
**Solución**: NO renombrar. `{id}.png` = original para siempre. Renders nuevos → `{id}_v{N}.png`. Endpoints sirven versión actual con fallback al original.

### ⚠️ C3: index.json se hincharía con ops
**Solución**: Dos niveles: `index.json` (ligero) + `{id}_meta.json` per-snippet (ops, versiones). Escritura atómica (temp+fsync+rename).

### ⚠️ C4: Simplificar CaptureDialog = regresión UX
**Solución**: NO simplificar. Ya es compacto (100 líneas). El editor es ADICIONAL, no sustituto.

### ⚠️ C5: Tests parchean rutas que cambiarán
**Solución**: `snippet_service.py` importa desde mismos módulos. Tests existentes siguen funcionando.

### ⚠️ C6: drawings.json pesado con base64 inline
**Mitigación**: Propagación limitada a `current_page`, batch `_save()`.

### ⚠️ C7: DrawingCanvas.tsx = 1238 líneas
**Solución**: Cero cambios en DrawingCanvas. `source_snippet_id` se pasa desde ProjectPage.

---

## Archivos a crear/modificar

### Backend — Modificar
- `backend/app/db/models.py` — extender Snippet (current_version), añadir SnippetVersionMeta, añadir source_snippet_id a DrawingElement
- `backend/app/db/repository.py` — migración lazy, atomic save, load/save meta per-snippet, serializar source_snippet_id
- `backend/app/api/snippets.py` — PATCH, restore-version, OCR detect/remove, QA, versioned image serving
- `backend/app/api/drawings.py` — source_snippet_id en Create/Update/Response
- `backend/tests/test_snippets.py` — tests por fase

### Backend — Crear
- `backend/app/services/snippet_service.py` — render_from_ops, create_version, restore_version, qa_validate, OCR helpers

### Frontend — Modificar
- `desktop/src/lib/api.ts` — source_snippet_id, endpoints v2, Snippet interface
- `desktop/src/components/SnippetLibraryPanel.tsx` — doble clic → editor
- `desktop/src/pages/ProjectPage.tsx` — source_snippet_id al colocar, integrar editor, propagación

### Frontend — Crear
- `desktop/src/components/SnippetEditorModal.tsx` — editor avanzado

---

## Plan de ejecución por fases

---

### Fase 1 — source_snippet_id en DrawingElement

**Objetivo**: Añadir campo opcional para vincular drawings con snippets. Prerequisito para propagación.

**Cambios**:
- `models.py`: `source_snippet_id: Optional[str] = None` en DrawingElement
- `repository.py` DrawingsRepository: serializar/deserializar con `.get()` y default
- `drawings.py`: añadir a Create/Update/Response Pydantic models
- `api.ts`: añadir a DrawingElement interface
- `ProjectPage.tsx`: extender `placingSnippetData` a `{base64, width, height, snippetId}`, pasar `source_snippet_id` al crear drawing

**Verificación Fase 1**:
- [ ] `pytest backend/tests/ -v` → todos los tests existentes pasan (sin cambios)
- [ ] Arrancar backend+frontend (`/dev-web`)
- [ ] Capturar snippet → colocarlo en canvas → funciona igual que antes
- [ ] Verificar en `drawings.json` que el nuevo drawing tiene `source_snippet_id`
- [ ] Drawings antiguos (sin el campo) cargan sin error
- [ ] Mover/redimensionar/eliminar drawing funciona igual

---

### Fase 2 — Modelo Snippet v2 + migración lazy + atomic save

**Objetivo**: Extender Snippet con `current_version`. Persistencia atómica. Métodos per-snippet meta.

**Cambios**:
- `models.py`: añadir `SnippetVersionMeta` dataclass, añadir `current_version: int = 1` a Snippet
- `repository.py` SnippetsRepository:
  - `_load()`: lazy migration (si no hay `current_version` → 1)
  - `_save()` → `_atomic_save()` (temp+fsync+rename)
  - Nuevos: `load_snippet_meta(id)`, `save_snippet_meta(id, meta)`
  - `delete()`: limpiar `{id}_meta.json` y `{id}_v*.png`

**Verificación Fase 2**:
- [ ] `pytest backend/tests/test_snippets.py -v` → tests existentes pasan
- [ ] Nuevo test: `test_lazy_migration_v1_to_v2` (snippet sin current_version carga con 1)
- [ ] Nuevo test: `test_atomic_save` (index.json se escribe correctamente)
- [ ] Nuevo test: `test_load_save_snippet_meta` (escribir y leer {id}_meta.json)
- [ ] Nuevo test: `test_delete_cleans_meta_and_versions` (delete limpia meta + v*.png)
- [ ] Arrancar app → snippets existentes cargan sin error → librería se muestra normal
- [ ] Capturar un snippet nuevo → funciona → index.json tiene current_version: 1

---

### Fase 3 — Endpoints backend v2 + snippet_service.py

**Objetivo**: Nuevos endpoints y servicio de render/versionado. Endpoints existentes sirven versión actual.

**Crear `snippet_service.py`**:
- `render_from_ops(snippet_id, ops) → PIL.Image`
- `create_version(snippet_id, ops, name, comment) → SnippetVersionMeta`
- `restore_version(snippet_id, target_version) → SnippetVersionMeta`
- `qa_validate(snippet_id) → dict`
- Mover `_run_ocr_on_crop()` y `_erase_text_regions()` aquí

**Nuevos endpoints**:
```
PATCH  /snippets/{id}                 → actualizar (ops, name, comment, propagate)
POST   /snippets/{id}/restore-version → rollback
POST   /snippets/{id}/ocr/detect      → detectar regiones OCR
POST   /snippets/{id}/ocr/remove-text → borrar texto
POST   /snippets/{id}/qa-validate     → QA post-save
GET    /snippets/{id}/versions        → listar versiones
GET    /snippets/{id}/meta            → meta completa
```

**Modificar existentes**:
- `get_snippet_image/base64`: si `current_version > 1` → servir `{id}_v{N}.png` (fallback `{id}.png`)
- `SnippetResponse`: añadir `current_version: int = 1`
- `list_snippets`: incluir current_version

**Verificación Fase 3**:
- [ ] `pytest backend/tests/test_snippets.py -v` → tests existentes pasan
- [ ] Nuevo test: `test_patch_creates_version` (PATCH incrementa versión, genera render)
- [ ] Nuevo test: `test_restore_version_append_only` (restore v1 → crea v(N+1))
- [ ] Nuevo test: `test_qa_validate_passes` (imagen válida → passed=true)
- [ ] Nuevo test: `test_image_serves_latest_version` (GET image sirve versión actual)
- [ ] Nuevo test: `test_ocr_detect_endpoint` (detecta regiones)
- [ ] Nuevo test: `test_ocr_remove_text_endpoint` (borra texto)
- [ ] Probar con curl/httpie: `GET /snippets` devuelve `current_version` en cada snippet
- [ ] Probar captura existente sigue funcionando (endpoints no rotos)

---

### Fase 4 — SnippetEditorModal (frontend)

**Objetivo**: Editor avanzado accesible por doble clic en miniatura.

**Crear `SnippetEditorModal.tsx`** (~250 líneas max):
- Props: `snippetId`, `onClose`, `onSaved`
- Carga meta (`GET /snippets/{id}/meta`)
- Preview imagen actual
- Herramientas: quitar fondo, OCR detectar, OCR borrar texto, renombrar
- Historial versiones con "Restaurar"
- Guardar (PATCH) / Cancelar
- Checkbox "Actualizar instancias en canvas"

**Modificar `SnippetLibraryPanel.tsx`**:
- `onDoubleClick` en SnippetCard → prop `onEditSnippet`

**Modificar `api.ts`**:
- Añadir: `update`, `restoreVersion`, `ocrDetect`, `ocrRemoveText`, `qaValidate`, `getVersions`, `getMeta`

**Modificar `ProjectPage.tsx`**:
- Integrar SnippetEditorModal (estado `editingSnippetId`)

**Verificación Fase 4**:
- [ ] Compilación sin errores (`npm run build` en desktop/)
- [ ] Doble clic en miniatura → SnippetEditorModal se abre
- [ ] Modal muestra imagen actual del snippet
- [ ] Quitar fondo → crea nueva versión → miniatura se actualiza
- [ ] OCR detectar → muestra regiones detectadas
- [ ] OCR borrar texto → crea nueva versión sin texto
- [ ] Historial muestra versiones correctas
- [ ] Cancelar → descarta, no crea versión
- [ ] Clic simple en miniatura → sigue colocando en canvas (no se rompe)

---

### Fase 5 — Propagación de instancias

**Objetivo**: Al guardar en editor con checkbox activo, actualizar drawings vinculados.

**Backend** (en PATCH `/snippets/{id}`):
- Si `propagate.enabled=true`: buscar DrawingElements con `source_snippet_id`, actualizar `image_data`, retornar `updated_count`

**Frontend** (ProjectPage):
- Tras guardar con propagate → `queryClient.invalidateQueries(['drawings'])`

**Verificación Fase 5**:
- [ ] Nuevo test: `test_propagate_updates_drawings` (PATCH con propagate actualiza drawings)
- [ ] Colocar snippet A en canvas 2 veces → editar snippet A con propagate → ambas instancias se actualizan
- [ ] Editar sin propagate → instancias NO cambian
- [ ] Nuevas inserciones usan versión actual

---

### Fase 6 — Rollback UI

**Objetivo**: Verificar que el flujo de restaurar versión funciona end-to-end.

(Endpoint ya existe en Fase 3, UI del historial en Fase 4. Esta fase es verificación + pulido.)

**Verificación Fase 6**:
- [ ] En editor: crear v2, v3 → restaurar v1 → se crea v4 con contenido de v1
- [ ] Imagen servida tras rollback es la correcta
- [ ] Historial muestra v1, v2, v3, v4

---

### Fase 7 — Tests finales + hardening

**Objetivo**: Cobertura completa, regresión, limpieza.

**Tests backend**: verificar todos los de fases anteriores + añadir:
- `test_concurrent_saves` (dos saves rápidos no corrompen)
- `test_meta_not_found_creates_default` (acceder meta de snippet v1 → defaults vacíos)

**Checklist regresión completa**:
- [ ] Tijeras → arrastrar → modal con opciones → guardar
- [ ] Capturar sidebar → mismo flujo
- [ ] Upload externo funciona
- [ ] Drag&drop snippet al canvas funciona
- [ ] Mover/redimensionar instancia funciona
- [ ] Snippets v1 (sin meta.json) cargan sin error
- [ ] Funciona en web (Vite) y Electron

---

## Formato de respuesta al terminar cada fase

Al completar cada fase, se entregará:

### Resumen de arquitectura final (máx 12 bullets)
_(Qué se ha hecho, qué ha cambiado en la arquitectura)_

### Lista de archivos modificados/creados
_(Tabla con archivo y resumen del cambio)_

### Diffs relevantes por archivo
_(Fragmentos de código con los cambios clave, formato citation)_

### Resultado de tests (front/back)
_(Output del pytest y/o resultado de compilación frontend)_

### Evidencias del checklist QA manual
_(Qué se probó manualmente y resultado)_

### Riesgos y mitigaciones
_(Riesgos descubiertos durante implementación + cómo se resolvieron)_

### Deuda técnica pendiente (si aplica)
_(Qué queda por hacer, qué se decidió posponer y por qué)_

---

## Modelo de datos TypeScript

```typescript
export interface SnippetVersionMeta {
  version: number
  created_at: string
  comment?: string
  checksum?: string
}

export interface SnippetMeta {
  ops: SnippetOp[]
  versions: SnippetVersionMeta[]
  ocr_detections: OcrDetection[]
}

export type SnippetOp =
  | { type: 'remove_bg' }
  | { type: 'ocr_remove_text'; regions?: OcrDetection[] }
  | { type: 'draw'; payload: Record<string, unknown> }
  | { type: 'erase'; payload: Record<string, unknown> }

export interface Snippet {
  id: string
  name: string
  width: number
  height: number
  has_transparent: boolean
  text_erased: boolean
  created_at: string
  ocr_detections: OcrDetection[]
  current_version: number  // default 1
}

export interface DrawingElement {
  // ... campos existentes ...
  source_snippet_id: string | null  // NUEVO
}
```

---

## Reglas técnicas

1. **CaptureDialog intacto** — no simplificar
2. **No destructivo** — `{id}.png` = original para siempre, renders en `{id}_v{N}.png`
3. **Versionado append-only** — cada save/restore crea nueva versión
4. **Persistencia atómica** — write temp + fsync + rename
5. **Ops en per-snippet meta** — index.json queda ligero
6. **QA post-save** — si falla, no se crea versión
7. **source_snippet_id** — backward-compatible
8. **DrawingCanvas.tsx** — cero cambios
9. **Verificar tras cada fase** — no avanzar sin green

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Migración v1→v2 rompe carga | Lazy migration con defaults + test explícito en Fase 2 |
| index.json corrupto | Atomic save (temp+rename) + backup antes de write |
| SnippetEditorModal > 300 líneas | Extraer subcomponentes |
| Propagación lenta | Limitar a current_page, un solo _save() |
| Tests existentes fallan | Campos opcionales, patches se mantienen |
| Incompatibilidad web vs Electron | Solo URLs de API, no rutas absolutas en frontend |
| `{id}_meta.json` no existe para v1 | Crear on-the-fly con defaults vacíos |
```

