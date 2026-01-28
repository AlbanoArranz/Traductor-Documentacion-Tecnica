---
name: release-packager
description: Empaqueta el ejecutable y archivos clave en una carpeta `release/` para compartir. Úsese cuando el usuario mencione preparar release, empaquetar, zip, carpeta release o distribución.
---

# Preparar release

## Cuándo usar esta skill
- Cuando el usuario pida preparar una carpeta `release/` para compartir.
- Cuando el usuario mencione empaquetar el `.exe`, hacer un zip o distribuir el ejecutable.

## Flujo de trabajo
- [ ] Confirmar que existe el ejecutable en `dist/`.
- [ ] Crear `release/`.
- [ ] Copiar el ejecutable y `requirements.txt`.

## Instrucciones
1. Verifica que existe el ejecutable:
   - ejecutable en `dist/`
2. Crea la carpeta `release/`.
3. Copia dentro de `release/`:
   - ejecutable desde `dist/`
   - `requirements.txt`
4. (Opcional) Incluye archivos mínimos para testing.

## Ejemplos
- Ejemplo (petición): "Prepara una carpeta release para enviar"
- Resultado esperado:
  - Existe `release/`
  - Contiene el ejecutable y `requirements.txt`

## Restricciones
- No borrar artefactos existentes sin confirmación.
- No inventar archivos: si falta `requirements.txt` o el exe, pedir confirmación/pasos previos.

## Recursos
- Layout esperado: `layout.md`
- Test plan: `test_plan.md`
