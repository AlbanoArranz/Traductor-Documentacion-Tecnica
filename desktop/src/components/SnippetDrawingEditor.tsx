import { useMemo, useState } from 'react'
import { MousePointer2, Minus, Square, Circle, Route, Type } from 'lucide-react'
import { DrawingCanvas } from './DrawingCanvas'
import type { DrawingTool } from './DrawingCanvas'
import type { DrawingElement, SnippetOverlayElement } from '../lib/api'

interface SnippetDrawingEditorProps {
  imageWidth: number
  imageHeight: number
  scale: number
  elements: SnippetOverlayElement[]
  onChange: (elements: SnippetOverlayElement[]) => void
}

const TOOL_OPTIONS: Array<{ id: DrawingTool; label: string; icon: React.ReactNode }> = [
  { id: 'select', label: 'Seleccionar', icon: <MousePointer2 size={14} /> },
  { id: 'line', label: 'Línea', icon: <Minus size={14} /> },
  { id: 'polyline', label: 'Polilínea', icon: <Route size={14} /> },
  { id: 'rect', label: 'Rectángulo', icon: <Square size={14} /> },
  { id: 'circle', label: 'Círculo', icon: <Circle size={14} /> },
  { id: 'add_text_box', label: 'Texto', icon: <Type size={14} /> },
]

export function SnippetDrawingEditor({ imageWidth, imageHeight, scale, elements, onChange }: SnippetDrawingEditorProps) {
  const [tool, setTool] = useState<DrawingTool>('select')
  const [strokeColor, setStrokeColor] = useState('#ff0000')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [fillColor, setFillColor] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const drawings = useMemo<DrawingElement[]>(() => {
    return elements.map((el, idx) => ({
      id: `snippet-overlay-${idx}`,
      project_id: 'snippet-editor',
      page_number: 0,
      element_type: el.element_type,
      points: el.points,
      stroke_color: el.stroke_color,
      stroke_width: el.stroke_width,
      fill_color: el.fill_color,
      text: el.text,
      font_size: el.font_size,
      font_family: el.font_family,
      text_color: el.text_color,
      image_data: null,
      created_at: new Date().toISOString(),
    }))
  }, [elements])

  const applyUpdateById = (id: string, updater: (el: SnippetOverlayElement) => SnippetOverlayElement) => {
    const idx = Number(id.replace('snippet-overlay-', ''))
    if (Number.isNaN(idx) || !elements[idx]) return
    const next = [...elements]
    next[idx] = updater(next[idx])
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {TOOL_OPTIONS.map((t) => (
          <button
            key={String(t.id)}
            type="button"
            onClick={() => setTool(t.id)}
            className={`px-2 py-1 border rounded flex items-center gap-1 ${tool === t.id ? 'bg-primary-100 text-primary-700 border-primary-300' : 'hover:bg-gray-50'}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
        <label className="flex items-center gap-1 ml-2">
          <span>Trazo</span>
          <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} />
        </label>
        <label className="flex items-center gap-1">
          <span>Grosor</span>
          <select className="border rounded px-1 py-0.5" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))}>
            {[1, 2, 3, 5, 8].map((w) => (
              <option key={w} value={w}>{w}px</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={fillColor !== null} onChange={(e) => setFillColor(e.target.checked ? '#ffffff' : null)} />
          Relleno
        </label>
        {fillColor !== null && (
          <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} />
        )}
      </div>

      <div className="absolute inset-0">
        <DrawingCanvas
          imageSize={{ width: imageWidth, height: imageHeight }}
          scale={scale}
          tool={tool}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          fillColor={fillColor}
          drawings={drawings}
          selectedDrawingIds={selectedIds}
          onDrawingSelect={setSelectedIds}
          onDrawingDelete={(id) => {
            const idx = Number(id.replace('snippet-overlay-', ''))
            if (Number.isNaN(idx) || !elements[idx]) return
            const next = elements.filter((_, i) => i !== idx)
            onChange(next)
            setSelectedIds([])
          }}
          onDrawingCreate={(data) => {
            const next: SnippetOverlayElement = {
              element_type: data.element_type as SnippetOverlayElement['element_type'],
              points: data.points,
              stroke_color: data.stroke_color,
              stroke_width: data.stroke_width,
              fill_color: data.fill_color,
              text: data.text,
              font_size: data.font_size,
              font_family: data.font_family,
              text_color: data.text_color,
            }
            onChange([...elements, next])
            setSelectedIds([])
          }}
          onDrawingUpdate={(id, updates) => {
            applyUpdateById(id, (el) => ({
              ...el,
              points: updates.points || el.points,
              text: updates.text ?? el.text,
              stroke_color: updates.stroke_color || el.stroke_color,
              stroke_width: updates.stroke_width ?? el.stroke_width,
              fill_color: updates.fill_color === undefined ? el.fill_color : updates.fill_color,
              text_color: updates.text_color || el.text_color,
            }))
          }}
          onAddTextBox={(position) => {
            const text = window.prompt('Texto de la anotación', 'Texto')?.trim()
            if (!text) return
            const item: SnippetOverlayElement = {
              element_type: 'text',
              points: [position.x, position.y],
              stroke_color: strokeColor,
              stroke_width: strokeWidth,
              fill_color: null,
              text,
              font_size: 14,
              font_family: 'Arial',
              text_color: strokeColor,
            }
            onChange([...elements, item])
          }}
        />
      </div>
    </div>
  )
}
