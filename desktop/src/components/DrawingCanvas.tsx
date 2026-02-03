import { useState, useRef, useEffect } from 'react'
import type { DrawingElement } from '../lib/api'

export type DrawingTool = 'select' | 'line' | 'rect' | 'text' | null

interface DrawingCanvasProps {
  imageSize: { width: number; height: number }
  scale: number
  tool: DrawingTool
  strokeColor: string
  strokeWidth: number
  fillColor: string | null
  drawings: DrawingElement[]
  selectedDrawingId: string | null
  onDrawingCreate: (element: Omit<DrawingElement, 'id' | 'project_id' | 'page_number' | 'created_at'>) => void
  onDrawingSelect: (id: string | null) => void
  onDrawingDelete: (id: string) => void
}

export function DrawingCanvas({
  imageSize,
  scale,
  tool,
  strokeColor,
  strokeWidth,
  fillColor,
  drawings,
  selectedDrawingId,
  onDrawingCreate,
  onDrawingSelect,
  onDrawingDelete,
}: DrawingCanvasProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null)
  const [textInput, setTextInput] = useState('')
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const getScaledPoint = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tool || tool === 'select') {
      onDrawingSelect(null)
      return
    }

    const point = getScaledPoint(e)

    if (tool === 'text') {
      setTextPosition(point)
      setTextInput('')
      return
    }

    setIsDrawing(true)
    setStartPoint(point)
    setCurrentPoint(point)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPoint) return
    setCurrentPoint(getScaledPoint(e))
  }

  const handleMouseUp = () => {
    if (!isDrawing || !startPoint || !currentPoint) {
      setIsDrawing(false)
      return
    }

    if (tool === 'line') {
      onDrawingCreate({
        element_type: 'line',
        points: [startPoint.x, startPoint.y, currentPoint.x, currentPoint.y],
        stroke_color: strokeColor,
        stroke_width: strokeWidth,
        fill_color: null,
        text: null,
        font_size: 14,
        font_family: 'Arial',
        text_color: '#000000',
        image_data: null,
      })
    } else if (tool === 'rect') {
      const x1 = Math.min(startPoint.x, currentPoint.x)
      const y1 = Math.min(startPoint.y, currentPoint.y)
      const x2 = Math.max(startPoint.x, currentPoint.x)
      const y2 = Math.max(startPoint.y, currentPoint.y)
      onDrawingCreate({
        element_type: 'rect',
        points: [x1, y1, x2, y2],
        stroke_color: strokeColor,
        stroke_width: strokeWidth,
        fill_color: fillColor,
        text: null,
        font_size: 14,
        font_family: 'Arial',
        text_color: '#000000',
        image_data: null,
      })
    }

    setIsDrawing(false)
    setStartPoint(null)
    setCurrentPoint(null)
  }

  const handleTextSubmit = () => {
    if (!textPosition || !textInput.trim()) {
      setTextPosition(null)
      setTextInput('')
      return
    }

    onDrawingCreate({
      element_type: 'text',
      points: [textPosition.x, textPosition.y],
      stroke_color: strokeColor,
      stroke_width: strokeWidth,
      fill_color: null,
      text: textInput,
      font_size: 14,
      font_family: 'Arial',
      text_color: strokeColor,
      image_data: null,
    })

    setTextPosition(null)
    setTextInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' && selectedDrawingId) {
      onDrawingDelete(selectedDrawingId)
      onDrawingSelect(null)
    }
    if (e.key === 'Escape') {
      setTextPosition(null)
      setTextInput('')
      onDrawingSelect(null)
    }
  }

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedDrawingId) {
        onDrawingDelete(selectedDrawingId)
        onDrawingSelect(null)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [selectedDrawingId, onDrawingDelete, onDrawingSelect])

  const renderDrawing = (d: DrawingElement) => {
    const isSelected = d.id === selectedDrawingId

    if (d.element_type === 'line') {
      const [x1, y1, x2, y2] = d.points
      return (
        <line
          key={d.id}
          x1={x1 * scale}
          y1={y1 * scale}
          x2={x2 * scale}
          y2={y2 * scale}
          stroke={d.stroke_color}
          strokeWidth={d.stroke_width}
          style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
          onClick={(e) => {
            e.stopPropagation()
            if (tool === 'select') onDrawingSelect(d.id)
          }}
          className={isSelected ? 'drawing-selected' : ''}
        />
      )
    }

    if (d.element_type === 'rect') {
      const [x1, y1, x2, y2] = d.points
      return (
        <rect
          key={d.id}
          x={x1 * scale}
          y={y1 * scale}
          width={(x2 - x1) * scale}
          height={(y2 - y1) * scale}
          stroke={d.stroke_color}
          strokeWidth={d.stroke_width}
          fill={d.fill_color || 'transparent'}
          style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
          onClick={(e) => {
            e.stopPropagation()
            if (tool === 'select') onDrawingSelect(d.id)
          }}
          className={isSelected ? 'drawing-selected' : ''}
        />
      )
    }

    if (d.element_type === 'text' && d.text) {
      const [x, y] = d.points
      return (
        <text
          key={d.id}
          x={x * scale}
          y={y * scale}
          fill={d.text_color}
          fontSize={d.font_size * scale}
          fontFamily={d.font_family}
          style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
          onClick={(e) => {
            e.stopPropagation()
            if (tool === 'select') onDrawingSelect(d.id)
          }}
          className={isSelected ? 'drawing-selected' : ''}
        >
          {d.text}
        </text>
      )
    }

    return null
  }

  const renderPreview = () => {
    if (!isDrawing || !startPoint || !currentPoint) return null

    if (tool === 'line') {
      return (
        <line
          x1={startPoint.x * scale}
          y1={startPoint.y * scale}
          x2={currentPoint.x * scale}
          y2={currentPoint.y * scale}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray="5,5"
        />
      )
    }

    if (tool === 'rect') {
      const x1 = Math.min(startPoint.x, currentPoint.x)
      const y1 = Math.min(startPoint.y, currentPoint.y)
      const x2 = Math.max(startPoint.x, currentPoint.x)
      const y2 = Math.max(startPoint.y, currentPoint.y)
      return (
        <rect
          x={x1 * scale}
          y={y1 * scale}
          width={(x2 - x1) * scale}
          height={(y2 - y1) * scale}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill={fillColor || 'transparent'}
          strokeDasharray="5,5"
        />
      )
    }

    return null
  }

  if (!tool) return null

  return (
    <div
      ref={canvasRef}
      className="absolute top-0 left-0"
      style={{
        width: imageSize.width * scale,
        height: imageSize.height * scale,
        cursor: tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <svg
        width={imageSize.width * scale}
        height={imageSize.height * scale}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        <style>
          {`.drawing-selected { filter: drop-shadow(0 0 3px #2563eb); }`}
        </style>
        {drawings.map(renderDrawing)}
        {renderPreview()}
      </svg>

      {textPosition && (
        <div
          style={{
            position: 'absolute',
            left: textPosition.x * scale,
            top: textPosition.y * scale,
            zIndex: 1000,
          }}
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTextSubmit()
              if (e.key === 'Escape') {
                setTextPosition(null)
                setTextInput('')
              }
            }}
            onBlur={handleTextSubmit}
            autoFocus
            className="px-1 py-0.5 border border-blue-500 rounded text-sm"
            placeholder="Texto..."
            style={{ minWidth: '100px' }}
          />
        </div>
      )}
    </div>
  )
}
