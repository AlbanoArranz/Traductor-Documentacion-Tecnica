# Implementación DrawingCanvas - Paso 1

## Cambios en DrawingCanvas.tsx

1. Actualizar tipos y props:
   - Cambiar `selectedDrawingId: string | null` → `selectedDrawingIds: string[]`
   - Añadir `onDrawingUpdate?: (id: string, updates: Partial<DrawingElement>) => void`
   - Exportar `ResizeHandle` tipo

2. Añadir estados:
   - `isDragging`, `isResizing`
   - `dragStart`, `resizeHandle`, `resizeStartPoint`
   - `editingTextId`, `editingText`

3. Implementar handlers:
   - Selección múltiple con Ctrl+click
   - Drag de elementos seleccionados
   - Resize con handles
   - Edición de texto con doble-click

4. Actualizar ProjectPage.tsx:
   - Cambiar `selectedDrawingId` a `selectedDrawingIds` (array)
   - Añadir mutation `updateDrawingMutation`
   - Pasar callback `onDrawingUpdate`

