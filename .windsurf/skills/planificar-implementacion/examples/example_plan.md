# Ejemplo de plan

**Goal:** Añadir un botón de export adicional con una convención de capa nueva.

**Contexto/Arquitectura:** Se añade una nueva opción de asignación en la UI y se extiende la lógica de export en el módulo existente.

---

## Tareas

### Tarea 1: Identificar puntos de extensión
**Files:**
- Modify: `visualizer_final.py`

**Steps:**
1. Localizar la sección de UI donde se listan tipos de operación.
2. Localizar la función de export y cómo decide nombres de capa.

**Verify:**
- Confirmar manualmente que se encontraron los puntos exactos (funciones/variables).

### Tarea 2: Añadir opción de UI
**Files:**
- Modify: `visualizer_final.py`

**Steps:**
1. Añadir una nueva etiqueta/selector siguiendo el patrón existente.
2. Mantener el layout mínimo.

**Verify:**
- Run: `python main.py`
- Expected: se ve la nueva opción y no rompe el resto.
