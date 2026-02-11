# Checklist rápida — nb7x-live-coding-cycle

## Antes de empezar (pre-flight)
- [ ] Backend responde en `http://127.0.0.1:8000/health`
- [ ] UI dev carga en `http://localhost:5173/`
- [ ] `git status` limpio
- [ ] Scope Card rellenada

## Durante implementación
- [ ] Cambios dentro del alcance de la Scope Card
- [ ] Archivos < 300 líneas
- [ ] No duplicación de lógica
- [ ] Imports al inicio del archivo
- [ ] No funciones/componentes/variables sin usar
- [ ] Consola del navegador limpia cada ~15 min

## Compatibilidad web ↔ escritorio (si toca UI)
- [ ] Funciona en Vite (localhost)
- [ ] No rompe rutas `file://` de Electron
- [ ] No rompe `baseURL` dinámica
- [ ] No rompe CSP / CORS

## Test gates (antes de commit)
- [ ] Gate 1: `python -m pytest tests/ -s -v` → todos pasan
- [ ] Gate 2: `npx tsc --noEmit` → sin errores de tipo
- [ ] Gate 3: Check visual de dominios afectados
- [ ] Gate 4: Playground reset (kill → restart → hard-refresh → flujo)

## Commit
- [ ] Formato: `<tipo>(<alcance>): <desc>` + línea `Slice:` + línea `Gates:`
- [ ] No se commitea código con tests fallando
- [ ] No hay archivos untracked/unstaged accidentales

## Post-slice
- [ ] Post-slice log rellenado
- [ ] Deuda técnica documentada (si aplica)
- [ ] Próximo slice identificado
