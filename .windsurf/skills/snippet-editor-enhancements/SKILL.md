---
name: snippet-editor-enhancements
description: Implementa herramienta borrador (rectángulo + cursor circular) y cambio de color de textos OCR en el SnippetEditorModal. Úsese cuando el usuario pida añadir funcionalidades de borrado de áreas, eraser tool, o personalización de color en textos detectados.
---

# Snippet Editor Enhancements

## Cuándo usar esta skill
- Usuario pide herramienta borrador/eraser para snippets
- Usuario quiere borrar áreas rectangulares o circulares
- Usuario quiere cambiar color de textos OCR detectados
- Usuario menciona "borrador", "eraser", "color OCR", "texto color"

## Flujo de trabajo

### Fase 1: Herramienta Borrador
- [ ] Añadir `'eraser'` a `DrawingTool` type en `DrawingCanvas.tsx`
- [ ] Añadir botón borrador a `SnippetToolbar.tsx` con icono `Eraser`
- [ ] Implementar modo rectángulo (arrastre + resize + Enter para confirmar)
- [ ] Implementar modo circular (click borra área bajo cursor)
- [ ] Añadir slider para tamaño de cursor circular
- [ ] Añadir operación `erase_region` al backend

### Fase 2: Color de Textos OCR
- [ ] Añadir `text_color?: string` a `OcrDetection` en frontend y backend
- [ ] Añadir color picker en `SnippetInspector.tsx` para cada detección
- [ ] Modificar `replace_ocr_text_regions()` para usar `text_color`

### Fase 3: Tests y QA
- [ ] Test backend para `erase_region` (rect y circle)
- [ ] Test backend para OCR con color
- [ ] QA funcional Puppeteer

## Instrucciones

### Herramienta Borrador

**Modo Rectángulo:**
1. Usuario selecciona herramienta borrador
2. Arrastra para crear rectángulo de selección
3. Puede redimensionar con handles en esquinas
4. Puede mover el rectángulo arrastrando
5. **Enter** = confirma borrado (rellena con blanco)
6. **Escape** = cancela operación

**Modo Circular:**
1. Usuario hace click simple = borra área circular
2. Tamaño configurable via slider "Radio"
3. Cursor muestra círculo de tamaño actual

**Implementación clave:**
```typescript
// DrawingCanvas.tsx - estados nuevos
const [eraserRect, setEraserRect] = useState<{x, y, w, h} | null>(null)
const [eraserRadius, setEraserRadius] = useState(20)
const [eraserMode, setEraserMode] = useState<'rect' | 'circle'>('rect')
```

### Color de Textos OCR

**Frontend:**
```typescript
// OcrDetection - añadir campo
text_color?: string  // hex color, default: "#000000"
```

**Backend:**
```python
# snippet_service.py - replace_ocr_text_regions
text_color = det.get("text_color") or "black"
draw.text((tx, ty), text, fill=text_color, font=font)
```

**UI:**
- En `SnippetInspector`, tab OCR, añadir:
  - Color picker individual por detección
  - Botón "Color global" para aplicar a todas

## Restricciones
- No modificar la lógica de detección OCR (parámetros del motor)
- Mantener compatibilidad con snippets existentes (versiones previas)
- El borrado debe ser reversible via historial de versiones
- No hardcodear colores de relleno (usar configurable)

## Recursos
- Plan detallado: `C:/Users/Lenovo/.windsurf/plans/snippet-editor-enhancements-f3192e.md`
- Componentes clave:
  - `desktop/src/components/DrawingCanvas.tsx`
  - `desktop/src/components/SnippetToolbar.tsx`
  - `desktop/src/components/SnippetInspector.tsx`
  - `backend/app/services/snippet_service.py`