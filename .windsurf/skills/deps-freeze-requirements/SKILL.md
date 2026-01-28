---
name: deps-freeze-requirements
description: Genera o actualiza `requirements.txt` desde el entorno actual para estabilizar dependencias antes de build/release. Úsese cuando el usuario mencione requirements, congelar dependencias, pip freeze o preparar release.
---

# Congelar dependencias (requirements.txt)

## Cuándo usar esta skill
- Cuando el usuario pida crear/actualizar `requirements.txt`.
- Antes de un build con PyInstaller o preparación de release.

## Flujo de trabajo
- [ ] Confirmar si se debe crear o actualizar `requirements.txt`.
- [ ] Confirmar entorno Python/venv correcto.
- [ ] Pedir confirmación antes de ejecutar comandos.
- [ ] Generar `requirements.txt`.
- [ ] Validar que contiene las dependencias esperadas.

## Instrucciones
1. Confirmar precondiciones:
   - Qué entorno se está usando (venv/conda/system).
   - Si el repo ya tiene `requirements.txt` y si debe sobrescribirse.
2. Proponer comando (requiere confirmación):
   - `python -m pip freeze > requirements.txt`
3. Verificación:
   - Abrir `requirements.txt` y comprobar que incluye los paquetes principales del proyecto.

## Restricciones
- No ejecutar comandos ni sobrescribir `requirements.txt` sin confirmación explícita.
- No instalar dependencias nuevas como parte de esta skill.

## Recursos
- Checklist: `resources/checklist.md`
- Test plan: `test_plan.md`
