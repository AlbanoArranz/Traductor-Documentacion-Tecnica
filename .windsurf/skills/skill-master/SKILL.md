---
name: skill-master
description: "Genera (scaffold) nuevas Skills para Windsurf (.windsurf/skills) con buenas practicas: metadatos claros, progressive disclosure, ejemplos y guardrails."
---

## Objetivo
Generar directorios `.windsurf/skills/` de alta calidad, predecibles y eficientes basados en los requerimientos del usuario.

## Cuándo usar esta Skill
Úsala cuando el usuario pida:
- Crear una Skill nueva para este workspace.
- Mejorar/estandarizar una Skill existente.
- Añadir plantillas, ejemplos o scripts a una Skill.

## 1. Requisitos estructurales principales
Cada Skill que generes debe seguir estrictamente esta jerarquía de carpetas:
- Raíz del directorio de la Skill
- `SKILL.md` (obligatorio)
- `scripts/` (opcional)
- `examples/` (opcional)
- `resources/` (opcional)

Usar siempre rutas con barras normales `/`.

## 2. Estándares del Frontmatter (YAML)
El archivo `SKILL.md` debe comenzar con un encabezado YAML (frontmatter) con estas reglas estrictas:
- `name`:
  - Formato **infinitivo** (ej.: `probar-codigo`, `gestionar-bases-datos`).
  - Máximo 64 caracteres.
  - Solo minúsculas, números y guiones.
  - No usar nombres de marcas (p.ej. no incluir `claude` o `anthropic`).
- `description`:
  - Escrita en **tercera persona**.
  - Debe incluir disparadores (keywords) específicos.
  - Máximo 1024 caracteres.
  - Debe incluir *qué hace* y *cuándo se usa*.

## 3. Principios de redacción (estilo directo)
- Concisión: asumir que el agente es inteligente; no explicar conceptos generales.
- Divulgación progresiva:
  - Mantener `SKILL.md` por debajo de 500 líneas.
  - Si hace falta más detalle, enlazar a archivos secundarios en `resources/` o `examples/`.
  - Profundizar solo un nivel (no crear cadenas largas de referencias).
- Barras de ruta: usar siempre `/`.
- Grados de libertad:
  - Alta libertad (heurística/criterio): usar viñetas.
  - Libertad media (plantillas): usar bloques de código.
  - Baja libertad (operaciones frágiles): usar comandos específicos.

## 4. Flujo de trabajo y bucles de retroalimentación
Cuando el usuario pida crear una Skill, seguir este patrón:

### 4.1 Planificar
- Recoger requisitos usando `resources/spec_form.md`.
- Identificar:
  - Archivos a crear/modificar.
  - Si hace falta `scripts/`, `examples/`, `resources/`.

### 4.2 Validar
- Validar `name` y `description` contra los estándares (longitud, formato, tercera persona, keywords).
- Validar rutas objetivo:
  - Las Skills de este workspace deben vivir en `.windsurf/skills/<skill-name>/`.
- Validar que no se sobrescribe nada existente:
  - Si la carpeta ya existe, abortar y pedir confirmación/plan alternativo.
- Si hay scripts:
  - Tratar los scripts como caja negra.
  - Si hay dudas, ejecutar `--help` antes de intentar ejecutarlos.

### 4.3 Ejecutar
- Generar estructura de carpetas.
- Crear `SKILL.md` con estructura directa (cuándo usar, flujo, instrucciones, restricciones, recursos).
- Añadir recursos (plantillas) y ejemplos (few-shot) cuando aporten precisión.

### 4.4 Validar (post)
- Presentar un árbol final de archivos.
- Confirmar que la Skill cumple la checklist (ver `resources/checklist.md`).

### 4.5 Checklist operativa (copiar/pegar)
- [ ] `name` cumple infinitivo + kebab-case + <= 64
- [ ] `description` en 3ª persona + keywords + <= 1024
- [ ] `SKILL.md` <= 500 líneas
- [ ] Incluye: cuándo usar, flujo, instrucciones, restricciones, recursos
- [ ] Rutas con `/` (no `\`)
- [ ] No sobrescribe contenido existente
- [ ] Scripts (si existen): tienen un modo `--help` y restricciones claras

## Entradas requeridas (preguntas que debes hacer)
1. Nombre de la Skill (`kebab-case`, minúsculas, números y guiones).
2. Descripción (qué hace + cuándo debe usarse).
3. Alcance y ubicación:
  - En este proyecto, las Skills van en `.windsurf/skills/<skill-name>/`.
4. Flujo principal (pasos) que debe seguir el agente.
5. Recursos:
  - ¿Necesita plantillas (`resources/`)?
  - ¿Necesita ejemplos few-shot (`examples/`)?
  - ¿Necesita scripts ejecutables (`scripts/`)? Si sí, definir:
    - Lenguaje (Python recomendado en este repo)
    - Entradas/salidas
    - Restricciones de seguridad

## Instrucciones
1. Diseña la Skill desde la perspectiva del modelo:
  - La decisión de activación depende sobre todo de `name` y **especialmente** de `description`.
  - La descripción debe explicar *qué hace* y *cuándo usarla*, con keywords explícitas.
2. Aplica divulgación progresiva:
  - Mantén `SKILL.md` operativo.
  - Mueve detalles a `resources/` y enlázalos.
3. Usa esta estructura para el cuerpo de `SKILL.md` (mínimo):
  - `# <Título de la Skill>`
  - `## Cuándo usar esta skill`
  - `## Flujo de trabajo` (idealmente con checklist)
  - `## Instrucciones`
  - `## Restricciones`
  - `## Recursos`
4. Si necesitas scaffold automático:
  - Usa `scripts/scaffold_skill.py`.
  - Si la carpeta ya existe, aborta.
5. Seguridad:
  - No hardcodear secretos.
  - Evitar red por defecto.
  - No ejecutar comandos destructivos ni instalar dependencias sin confirmación.

## 5. Plantilla de salida (formato obligatorio)
Cuando se te pida crear una Skill, presenta el resultado en este formato:

### [Nombre de la Carpeta]
Ruta: `.windsurf/skills/[nombre-de-skill]/`

### [SKILL.md]
```markdown
---
name: [nombre-en-infinitivo]
description: [descripción en 3ª persona con disparadores/keywords]
---

# [Título de la Skill]

## Cuándo usar esta skill
- [Disparador 1]
- [Disparador 2]

## Flujo de trabajo
- [ ] Paso 1
- [ ] Paso 2

## Instrucciones
[Lógica específica, fragmentos de código o reglas]

## Restricciones
- [Qué no hacer]

## Recursos
- [Enlace a scripts/ o resources/]
```

[Archivos de soporte]

(Si aplica, proporciona el contenido para `scripts/`, `examples/` o `resources/`.)

## Recursos
- Checklist: `resources/checklist.md`
- Plantilla de `SKILL.md`: `resources/skill_md_template.md`
- Formulario de especificación: `resources/spec_form.md`
- Test plan: `test_plan.md`

## Ejemplo de uso
Usuario: "Crea una skill para validar exports DXF y generar un reporte."
Agente:
1. Pregunta por nombre, descripción, inputs/outputs.
2. Decide estructura (SKILL.md + checklist + ejemplo).
3. Ejecuta `python .windsurf/skills/skill-master/scripts/scaffold_skill.py <name> "<description>"`.
4. Rellena el contenido y añade ejemplos.
