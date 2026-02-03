---
name: actualizar-repo-git
description: Genera comandos git concatenados para limpiar pycache, añadir cambios, commitear y pushear en un solo paso. Activa con keywords "git update", "subir cambios git", "commit y push", "sincronizar repo".
---

# Git Update Skill

## Cuándo usar esta skill
- El usuario pide "git update", "subir cambios", "commit y push"
- Hay cambios pendientes en el repositorio (modificados y/o untracked)
- Se necesita sincronizar el repo local con GitHub
- Se detectan archivos `__pycache__` en el tracking que deben eliminarse

## Flujo de trabajo
- [ ] 1. Detectar estado del repo (`git status`)
- [ ] 2. Identificar archivos `__pycache__` en el tracking para eliminar
- [ ] 3. Identificar archivos modificados y nuevos para añadir
- [ ] 4. Generar comando concatenado con todos los pasos
- [ ] 5. Entregar el comando listo para copiar y ejecutar

## Instrucciones

### Paso 1: Analizar estado
Ejecutar `git status --porcelain` o leer el estado actual del repo para identificar:
- Archivos `__pycache__/*.pyc` marcados como `M` (modificados en tracking)
- Archivos nuevos (`??`) que deban añadirse
- Archivos modificados (`M`) que deban commitearse

### Paso 2: Generar comando concatenado
Construir un único comando con `&&` que incluya:

```bash
cd "<repo-path>" && \
git rm --cached <archivos-pycache...> && \
git add <archivos-nuevos-y-modificados...> && \
git commit -m "<mensaje-descriptivo>" && \
git push origin <branch>
```

### Reglas del mensaje de commit
- Si hay cambios de feature: `feat: <descripción breve>`
- Si son fixes: `fix: <descripción>`
- Si es refactor: `refactor: <descripción>`
- Incluir bullet points si hay múltiples cambios significativos

### Paso 3: Entregar al usuario
Presentar el comando completo en un bloque de código listo para copiar, con una breve explicación de qué hará.

## Restricciones
- NO ejecutar el comando automáticamente (solo generarlo)
- Si no hay cambios para commitear, informar "No hay cambios pendientes"
- Si hay conflictos de merge pendientes, advertir antes de generar comandos
- Si el repo no está inicializado o no tiene remote, abortar y explicar

## Recursos
- `scripts/generate-git-update.sh` - Plantilla del script (ejemplo)
- `examples/example-usage.md` - Ejemplos de uso
