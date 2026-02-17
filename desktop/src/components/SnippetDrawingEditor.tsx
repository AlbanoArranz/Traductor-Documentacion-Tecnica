import { useMemo, useState } from 'react'
import { DrawingCanvas } from './DrawingCanvas'
import type { DrawingTool } from './DrawingCanvas'
import type { DrawingElement, SnippetOverlayElement } from '../lib/api'

interface SnippetDrawingEditorProps {
  imageWidth: number
  imageHeight: number
  scale: number
  elements: SnippetOverlayElement[]
  onChange: (elements: SnippetOverlayElement[]) => void
  // Props controladas desde SnippetEditorModal (toolbar unificada)
  tool: DrawingTool
  strokeColor: string
  strokeWidth: number
  fillColor: string | null
}

export function SnippetDrawingEditor({ 
  imageWidth, 
  imageHeight, 
  scale, 
  elements, 
  onChange,
  tool,
  strokeColor,
  strokeWidth,
  fillColor,
}: SnippetDrawingEditorProps) {
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
    <div className="absolute inset-0 z-20">
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
  )
}
