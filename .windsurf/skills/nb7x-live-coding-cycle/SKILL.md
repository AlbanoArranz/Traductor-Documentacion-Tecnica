---
name: nb7x-live-coding-cycle
description: "Ejecuta ciclos incrementales de desarrollo (slices 30-90 min) con gates de test obligatorios, validación en navegador y checks específicos para canvas/OCR/export en NB7X Translator. Úsese cuando se hagan cambios importantes, se empiece una sesión de desarrollo, o el usuario mencione slice, ciclo, iteración, live coding o validación de cambios."
---

# NB7X Live Coding Cycle

## Objetivo
Producir incrementos de código validados, commiteados y documentados en bloques acotados (30-90 min) con gates de calidad obligatorios.

## Cuándo usar esta skill
- Al iniciar una sesión de desarrollo con cambios significativos.
- Cuando el usuario diga "slice", "ciclo", "iteración", "live coding" o "validar cambios".
- Después de completar una feature/fix/refactor que afecte render, OCR, canvas, compose o export.
- Cuando el usuario pida asegurar calidad antes de commit.
- **No** usar para fixes triviales de 1 línea, preguntas de docs, ni tareas de build/release.

## Contexto del proyecto (referencia rápida)
| Capa | Stack | Ruta |
|------|-------|------|
| Backend | Python 3.11 + FastAPI | `backend/app/` |
| Frontend | React + Vite + TailwindCSS | `desktop/src/` |
| Electron | main.cjs, preload.cjs | `desktop/electron/` |
| Tests BE | pytest | `backend/tests/` |
| Tests FE | vitest / manual | `desktop/src/components/__tests__/`, `desktop/src/test/` |
| Datos | JSON + imágenes | `%APPDATA%\NB7XTranslator\` |

## Flujo de trabajo (por slice)

### Fase 0 — Scope Card (< 5 min)
- [ ] Rellenar Scope Card (`resources/scope_card_template.md`).
- [ ] Definir: objetivo, archivos afectados, criterio de éxito, riesgos.
- [ ] Si el alcance supera 90 min estimados → dividir en sub-slices.

### Fase 1 — Pre-flight (< 3 min)
- [ ] Backend responde: `GET http://127.0.0.1:8000/health`.
- [ ] UI dev carga: `http://localhost:5173/`.
- [ ] Si falla → arrancar con `/dev-web`.
- [ ] `git status` limpio (no hay cambios pendientes del slice anterior).

### Fase 2 — Implementación (30-90 min)
- [ ] Trabajar **solo** en los archivos de la Scope Card.
- [ ] Archivos < 300 líneas; refactorizar si se acerca.
- [ ] No duplicar lógica; reutilizar lo existente.
- [ ] No crear ramas/carpetas/pantallas sin petición explícita.
- [ ] Si se toca **backend**: coherencia con `backend/app/db/models.py`; si se añade endpoint → actualizar tabla API en README.
- [ ] Si se toca **frontend**: verificar compatibilidad web (Vite) **y** escritorio (Electron); no romper rutas `file://`, CORS ni `baseURL` dinámica.
- [ ] Cada ~15 min: guardar, verificar consola limpia en navegador.

### Fase 3 — Test Gates (obligatorio)
**No se commitea hasta que todos los gates relevantes pasen.**

#### Gate 1: Backend tests
```
cd backend
python -m pytest tests/ -s -v
```

#### Gate 2: Frontend type-check
```
cd desktop
npx tsc --noEmit
```

#### Gate 3: Checks por dominio (solo los afectados por el slice)

| Dominio | Verificar | Método |
|---------|-----------|--------|
| Canvas | Renderiza, zoom/pan, herramientas | Abrir proyecto → página → usar herramientas dibujo |
| OCR | Regiones con texto CJK | Render → OCR → verificar cajas |
| Compose | Texto ES sobre original | OCR → traducir → render-translated → comparar |
| Export | PDF abre, texto chino reemplazado | Exportar → abrir con visor externo |
| Snippets | CRUD + eliminación de fondo | Probar upload, list, delete, nobg |
| Glossary | Persistencia, aplicar, editar | Editar → aplicar → verificar traducciones |
| Settings | DeepL key, DPI, Han filter | Cambiar → recargar → verificar persistencia |

#### Gate 4: Playground reset
1. Matar todos los servidores (backend + Vite).
2. Reiniciar ambos desde cero.
3. Hard-refresh (`Ctrl+Shift+R`) en `http://localhost:5173/`.
4. Ejecutar flujo completo afectado por el slice.
5. DevTools → Console: cero errores rojos.
6. DevTools → Network: peticiones al backend con status 2xx.

### Fase 4 — Commit
**Formato obligatorio:**
```
<tipo>(<alcance>): <descripción corta>

[cuerpo opcional]

Slice: <nombre-del-slice>
Gates: ✅ backend-tests ✅ type-check ✅ <dominio>-visual ✅ playground
```

Tipos: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`.

### Fase 5 — Post-slice log (< 3 min)
- [ ] Rellenar Post-slice log (`resources/post_slice_log_template.md`).
- [ ] Anotar: qué se hizo, gates pasados, deuda técnica, próximo slice.

## Instrucciones para el agente

### Al inicio
1. Anunciar: "Usando skill **nb7x-live-coding-cycle**, slice: `<nombre>`".
2. Leer/crear Scope Card (preguntar al usuario si falta info).
3. Pre-flight checks.

### Durante implementación
- Cambios dentro del alcance de la Scope Card.
- Trabajo fuera de alcance → anotar como deuda para otro slice.
- Cada ~15 min: guardar, consola limpia.

### Al cerrar
1. Ejecutar todos los test gates relevantes.
2. Si un gate falla: fix in-place (< 10 min); si no se resuelve → revertir + documentar.
3. Commit con formato.
4. Post-slice log.
5. Preguntar: "¿Abrimos otro slice o cerramos sesión?"

### Check web ↔ escritorio
Antes de cerrar slices que afecten UI:
- [ ] Funciona en Vite (localhost).
- [ ] No rompe rutas `file://`, `baseURL` dinámica ni CSP de Electron.

## Restricciones
- No saltear test gates; si falla un gate, no se commitea.
- No ejecutar comandos destructivos sin confirmación.
- No sobrescribir `.env` sin petición explícita.
- No crear ramas/carpetas/pantallas sin petición explícita.
- No instalar dependencias sin confirmación.
- No dejar funciones/componentes/variables sin usar.
- Slices ≤ 90 min; si se pasa → dividir.

## Recursos
- Scope Card: `resources/scope_card_template.md`
- Post-slice log: `resources/post_slice_log_template.md`
- Checklist rápida: `resources/checklist.md`
- Test plan: `test_plan.md`

## Ejemplo de uso
**Usuario**: "Vamos a añadir captura de snippets desde el canvas."

**Agente**:
1. Activa `nb7x-live-coding-cycle`, slice: `snippet-capture`.
2. Scope Card: objetivo=captura, archivos=`DrawingCanvas.tsx`, `snippets.py`, `api.ts`.
3. Pre-flight: health OK, UI OK, git clean.
4. Implementa captura.
5. Gate 1: `pytest` → ✅ | Gate 2: `tsc` → ✅ | Gate 3: canvas+snippets visual → ✅ | Gate 4: playground reset → ✅
6. Commit: `feat(canvas): añadir captura de snippets — Slice: snippet-capture`
7. Post-slice log → completado, sin deuda, próximo: "integrar snippets en compose".
