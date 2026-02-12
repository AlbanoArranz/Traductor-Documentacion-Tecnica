import { useState, useRef, useEffect, useCallback } from 'react'
import type { DrawingElement } from '../lib/api'

export type DrawingTool = 'select' | 'line' | 'rect' | 'circle' | 'polyline' | 'add_text_box' | 'capture' | 'place_snippet' | null
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null

interface DrawingCanvasProps {
  imageSize: { width: number; height: number }
  scale: number
  tool: DrawingTool
  strokeColor: string
  strokeWidth: number
  fillColor: string | null
  drawings: DrawingElement[]
  selectedDrawingIds: string[]
  onDrawingCreate: (element: Omit<DrawingElement, 'id' | 'project_id' | 'page_number' | 'created_at'>) => void
  onDrawingSelect: (ids: string[]) => void
  onDrawingDelete: (id: string) => void
  onDrawingUpdate?: (id: string, updates: Partial<DrawingElement>) => void
  onAddTextBox?: (position: { x: number; y: number }) => void
  onCaptureArea?: (bbox: number[]) => void
  onPlaceSnippet?: (position: { x: number; y: number }) => void
}

export function DrawingCanvas({
  imageSize,
  scale,
  tool,
  strokeColor,
  strokeWidth,
  fillColor,
  drawings,
  selectedDrawingIds,
  onDrawingCreate,
  onDrawingSelect,
  onDrawingDelete,
  onDrawingUpdate,
  onAddTextBox,
  onCaptureArea,
  onPlaceSnippet,
}: DrawingCanvasProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null)
  const [resizeStartPoint, setResizeStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [resizeOffset, setResizeOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null)
  const [textInput, setTextInput] = useState('')
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null)
  const [polylinePoints, setPolylinePoints] = useState<{ x: number; y: number }[]>([])
  const [lastClickTime, setLastClickTime] = useState<number | null>(null)
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null)
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const getScaledPoint = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    }
  }

  const _distPointToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const vx = x2 - x1
    const vy = y2 - y1
    const wx = px - x1
    const wy = py - y1

    const c1 = vx * wx + vy * wy
    if (c1 <= 0) return Math.hypot(px - x1, py - y1)

    const c2 = vx * vx + vy * vy
    if (c2 <= c1) return Math.hypot(px - x2, py - y2)

    const b = c1 / c2
    const bx = x1 + b * vx
    const by = y1 + b * vy
    return Math.hypot(px - bx, py - by)
  }

  const _hitTestDrawing = (d: DrawingElement, p: { x: number; y: number }): boolean => {
    const x = p.x
    const y = p.y

    if (d.element_type === 'line' && d.points.length >= 4) {
      const [x1, y1, x2, y2] = d.points
      const padding = Math.max((d.stroke_width || strokeWidth) / 2, 6)
      return _distPointToSegment(x, y, x1, y1, x2, y2) <= padding
    }

    if (d.element_type === 'polyline' && d.points.length >= 4 && d.points.length % 2 === 0) {
      const padding = Math.max((d.stroke_width || strokeWidth) / 2, 12)
      for (let i = 0; i < d.points.length - 2; i += 2) {
        const x1 = d.points[i]
        const y1 = d.points[i + 1]
        const x2 = d.points[i + 2]
        const y2 = d.points[i + 3]
        if (_distPointToSegment(x, y, x1, y1, x2, y2) <= padding) return true
      }
      return false
    }

    if ((d.element_type === 'rect' || d.element_type === 'image') && d.points.length >= 4) {
      const [x1, y1, x2, y2] = d.points
      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)
      const padding = 4
      return x >= minX - padding && x <= maxX + padding && y >= minY - padding && y <= maxY + padding
    }

    if (d.element_type === 'circle' && d.points.length >= 4) {
      const [x1, y1, x2, y2] = d.points
      const cx = (x1 + x2) / 2
      const cy = (y1 + y2) / 2
      const rx = Math.abs(x2 - x1) / 2
      const ry = Math.abs(y2 - y1) / 2
      if (rx <= 0 || ry <= 0) return false
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      const padding = 0.15
      return nx * nx + ny * ny <= (1 + padding) * (1 + padding)
    }

    if (d.element_type === 'text' && d.points.length >= 2 && d.text) {
      const [tx, ty] = d.points
      const fontSize = d.font_size || 14
      const w = (d.text.length * fontSize * 0.6 + 10)
      const h = (fontSize + 10)
      const padding = 6
      return x >= tx - padding && x <= tx + w + padding && y >= ty - h - padding && y <= ty + padding
    }

    return false
  }

  const _hitTestTopFirst = (p: { x: number; y: number }): string | null => {
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i]
      if (_hitTestDrawing(d, p)) return d.id
    }
    return null
  }

  const _getDrawingBBox = (d: DrawingElement): { x1: number; y1: number; x2: number; y2: number } | null => {
    if ((d.element_type === 'line' || d.element_type === 'rect' || d.element_type === 'circle' || d.element_type === 'image') && d.points.length >= 4) {
      const [px1, py1, px2, py2] = d.points
      return { x1: Math.min(px1, px2), y1: Math.min(py1, py2), x2: Math.max(px1, px2), y2: Math.max(py1, py2) }
    }
    if (d.element_type === 'polyline' && d.points.length >= 4) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let i = 0; i < d.points.length; i += 2) {
        minX = Math.min(minX, d.points[i])
        maxX = Math.max(maxX, d.points[i])
        minY = Math.min(minY, d.points[i + 1])
        maxY = Math.max(maxY, d.points[i + 1])
      }
      return { x1: minX, y1: minY, x2: maxX, y2: maxY }
    }
    if (d.element_type === 'text' && d.points.length >= 2 && d.text) {
      const [tx, ty] = d.points
      const fontSize = d.font_size || 14
      const w = d.text.length * fontSize * 0.6 + 10
      const h = fontSize + 10
      return { x1: tx, y1: ty - h, x2: tx + w, y2: ty }
    }
    return null
  }

  const finishPolyline = useCallback(() => {
    setPolylinePoints(currentPoints => {
      if (currentPoints.length >= 2) {
        const points = currentPoints.flatMap(p => [p.x, p.y])
        onDrawingCreate({
          element_type: 'polyline',
          points,
          stroke_color: strokeColor,
          stroke_width: strokeWidth,
          fill_color: null,
          text: null,
          font_size: 14,
          font_family: 'Arial',
          text_color: '#000000',
          image_data: null,
        })
        return []
      }
      return currentPoints
    })
  }, [onDrawingCreate, strokeColor, strokeWidth])

  const handleMouseDown = (e: React.MouseEvent) => {
    // Si el click es en un handle de resize, no procesar (el handle lo gestiona en burbuja)
    const target = e.target as Element
    if (target.getAttribute?.('data-testid')?.startsWith('drawing-handle-')) return

    if (!tool || tool === 'select') {
      const point = getScaledPoint(e)
      const hitId = _hitTestTopFirst(point)
      if (!hitId) {
        // Start marquee selection
        setMarqueeStart(point)
        setMarqueeEnd(point)
        onDrawingSelect([])
        return
      }

      if (e.ctrlKey || e.metaKey) {
        if (selectedDrawingIds.includes(hitId)) {
          onDrawingSelect(selectedDrawingIds.filter(id => id !== hitId))
        } else {
          onDrawingSelect([...selectedDrawingIds, hitId])
        }
      } else {
        if (selectedDrawingIds.length !== 1 || selectedDrawingIds[0] !== hitId) {
          onDrawingSelect([hitId])
        }
      }

      const willDragIds = (e.ctrlKey || e.metaKey)
        ? (selectedDrawingIds.includes(hitId) ? selectedDrawingIds : [...selectedDrawingIds, hitId])
        : [hitId]

      if (onDrawingUpdate && willDragIds.includes(hitId)) {
        setIsDragging(true)
        setDragStart(point)
      }
      return
    }

    const point = getScaledPoint(e)

    if (tool === 'add_text_box') {
      // Crear región de texto (TextRegion) en lugar de DrawingElement
      if (onAddTextBox) {
        onAddTextBox(point)
      }
      return
    }

    if (tool === 'place_snippet') {
      if (onPlaceSnippet) {
        onPlaceSnippet(point)
      }
      return
    }

    // Modo polilínea: click añade punto, doble click finaliza, Escape cancela
    if (tool === 'polyline') {
      // Detectar doble-click (300ms desde el último click)
      const now = Date.now()
      if (polylinePoints.length >= 2 && now - (lastClickTime || 0) < 300) {
        // Doble-click: finalizar polilínea
        finishPolyline()
        setLastClickTime(null)
        return
      }
      setLastClickTime(now)
      
      if (polylinePoints.length === 0) {
        // Primer punto
        setPolylinePoints([point])
      } else {
        // Añadir punto con snap a ejes si Shift está presionado
        const lastPoint = polylinePoints[polylinePoints.length - 1]
        let newPoint = point
        
        if (e.shiftKey) {
          const dx = Math.abs(point.x - lastPoint.x)
          const dy = Math.abs(point.y - lastPoint.y)
          
          if (dx > dy) {
            // Horizontal
            newPoint = { x: point.x, y: lastPoint.y }
          } else {
            // Vertical
            newPoint = { x: lastPoint.x, y: point.y }
          }
        }
        
        setPolylinePoints([...polylinePoints, newPoint])
      }
      return
    }

    setIsDrawing(true)
    setStartPoint(point)
    setCurrentPoint(point)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDrawing && startPoint) {
      const point = getScaledPoint(e)
      
      // Si Shift está presionado y estamos dibujando línea, ajustar a ejes
      if (e.shiftKey && tool === 'line') {
        const dx = Math.abs(point.x - startPoint.x)
        const dy = Math.abs(point.y - startPoint.y)
        
        if (dx > dy) {
          // Horizontal
          setCurrentPoint({ x: point.x, y: startPoint.y })
        } else {
          // Vertical
          setCurrentPoint({ x: startPoint.x, y: point.y })
        }
      } else {
        setCurrentPoint(point)
      }
    } else if (isResizing && resizeHandle && resizeStartPoint && selectedDrawingIds.length === 1) {
      const current = getScaledPoint(e)
      const dx = current.x - resizeStartPoint.x
      const dy = current.y - resizeStartPoint.y
      // Acumular offset local sin llamar API
      setResizeOffset({ dx, dy })
    } else if (isDragging && dragStart) {
      const current = getScaledPoint(e)
      const dx = current.x - dragStart.x
      const dy = current.y - dragStart.y
      // Acumular offset local sin llamar API
      setDragOffset({ dx, dy })
    } else if (marqueeStart) {
      const current = getScaledPoint(e)
      setMarqueeEnd(current)
    }
  }

  const handleMouseUp = () => {
    if (isResizing) {
      // Commit resize: aplicar offset acumulado de una sola vez (prioridad sobre drag)
      if (onDrawingUpdate && selectedDrawingIds.length === 1 && (resizeOffset.dx !== 0 || resizeOffset.dy !== 0)) {
        const id = selectedDrawingIds[0]
        const drawing = drawings.find(d => d.id === id)
        if (drawing && drawing.points.length >= 4) {
          const [x1, y1, x2, y2] = drawing.points
          let newPoints: number[] = [x1, y1, x2, y2]

          if (drawing.element_type === 'line') {
            // Líneas: mover solo el endpoint arrastrado, sin normalizar
            switch (resizeHandle) {
              case 'nw': newPoints = [x1 + resizeOffset.dx, y1 + resizeOffset.dy, x2, y2]; break
              case 'se': newPoints = [x1, y1, x2 + resizeOffset.dx, y2 + resizeOffset.dy]; break
            }
          } else {
            switch (resizeHandle) {
              case 'nw': newPoints = [x1 + resizeOffset.dx, y1 + resizeOffset.dy, x2, y2]; break
              case 'ne': newPoints = [x1, y1 + resizeOffset.dy, x2 + resizeOffset.dx, y2]; break
              case 'sw': newPoints = [x1 + resizeOffset.dx, y1, x2, y2 + resizeOffset.dy]; break
              case 'se': newPoints = [x1, y1, x2 + resizeOffset.dx, y2 + resizeOffset.dy]; break
            }

            // Normalizar y aplicar límites mínimos (solo para rect/circle/image/text)
            let nx1 = Math.min(newPoints[0], newPoints[2])
            let nx2 = Math.max(newPoints[0], newPoints[2])
            let ny1 = Math.min(newPoints[1], newPoints[3])
            let ny2 = Math.max(newPoints[1], newPoints[3])
            const minW = 20
            const minH = 10
            if (nx2 - nx1 < minW) nx2 = nx1 + minW
            if (ny2 - ny1 < minH) ny2 = ny1 + minH
            newPoints = [nx1, ny1, nx2, ny2]
          }

          onDrawingUpdate(id, { points: newPoints })
        }
      }
      setIsResizing(false)
      setResizeHandle(null)
      setResizeStartPoint(null)
      setResizeOffset({ dx: 0, dy: 0 })
      // Safety: limpiar drag state si estaba activo por captura
      setIsDragging(false)
      setDragStart(null)
      setDragOffset({ dx: 0, dy: 0 })
      return
    }

    if (isDragging) {
      // Commit drag: aplicar offset acumulado de una sola vez
      if (onDrawingUpdate && (dragOffset.dx !== 0 || dragOffset.dy !== 0)) {
        selectedDrawingIds.forEach(id => {
          const drawing = drawings.find(d => d.id === id)
          if (drawing) {
            const newPoints = drawing.points.map((p, i) =>
              i % 2 === 0 ? p + dragOffset.dx : p + dragOffset.dy
            )
            onDrawingUpdate(id, { points: newPoints })
          }
        })
      }
      setIsDragging(false)
      setDragStart(null)
      setDragOffset({ dx: 0, dy: 0 })
      return
    }
    
    if (marqueeStart && marqueeEnd) {
      const sx1 = Math.min(marqueeStart.x, marqueeEnd.x)
      const sy1 = Math.min(marqueeStart.y, marqueeEnd.y)
      const sx2 = Math.max(marqueeStart.x, marqueeEnd.x)
      const sy2 = Math.max(marqueeStart.y, marqueeEnd.y)
      if (sx2 - sx1 > 3 || sy2 - sy1 > 3) {
        const ids = drawings.filter(d => {
          const bb = _getDrawingBBox(d)
          if (!bb) return false
          return !(bb.x2 < sx1 || bb.x1 > sx2 || bb.y2 < sy1 || bb.y1 > sy2)
        }).map(d => d.id)
        onDrawingSelect(ids)
      }
      setMarqueeStart(null)
      setMarqueeEnd(null)
      return
    }

    if (!isDrawing || !startPoint || !currentPoint) {
      setIsDrawing(false)
      return
    }

    if (tool === 'line') {
      let endX = currentPoint.x
      let endY = currentPoint.y
      
      // Si Shift está presionado, snap a ejes (horizontal o vertical)
      if (window.event && (window.event as MouseEvent).shiftKey) {
        const dx = Math.abs(currentPoint.x - startPoint.x)
        const dy = Math.abs(currentPoint.y - startPoint.y)
        
        if (dx > dy) {
          // Línea horizontal
          endY = startPoint.y
        } else {
          // Línea vertical
          endX = startPoint.x
        }
      }
      
      onDrawingCreate({
        element_type: 'line',
        points: [startPoint.x, startPoint.y, endX, endY],
        stroke_color: strokeColor,
        stroke_width: strokeWidth,
        fill_color: null,
        text: null,
        font_size: 14,
        font_family: 'Arial',
        text_color: '#000000',
        image_data: null,
      })
    } else if (tool === 'rect' || tool === 'circle') {
      const x1 = Math.min(startPoint.x, currentPoint.x)
      const y1 = Math.min(startPoint.y, currentPoint.y)
      const x2 = Math.max(startPoint.x, currentPoint.x)
      const y2 = Math.max(startPoint.y, currentPoint.y)
      onDrawingCreate({
        element_type: tool,
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
    } else if (tool === 'capture') {
      const x1 = Math.min(startPoint.x, currentPoint.x)
      const y1 = Math.min(startPoint.y, currentPoint.y)
      const x2 = Math.max(startPoint.x, currentPoint.x)
      const y2 = Math.max(startPoint.y, currentPoint.y)
      if (x2 - x1 > 5 && y2 - y1 > 5 && onCaptureArea) {
        onCaptureArea([x1, y1, x2, y2])
      }
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
    if (e.key === 'Delete' && selectedDrawingIds.length > 0 && onDrawingDelete) {
      e.preventDefault()
      selectedDrawingIds.forEach(id => {
        if (id) onDrawingDelete(id)
      })
      onDrawingSelect([])
    }
    
    // Flechas para mover elementos
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') 
        && selectedDrawingIds.length > 0 && onDrawingUpdate) {
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      let dx = 0, dy = 0
      
      if (e.key === 'ArrowLeft') dx = -step
      if (e.key === 'ArrowRight') dx = step
      if (e.key === 'ArrowUp') dy = -step
      if (e.key === 'ArrowDown') dy = step
      
      selectedDrawingIds.forEach(id => {
        const drawing = drawings.find(d => d.id === id)
        if (drawing) {
          const newPoints = drawing.points.map((p, i) => 
            i % 2 === 0 ? p + dx : p + dy
          )
          onDrawingUpdate(id, { points: newPoints })
        }
      })
    }
    
    if (e.key === 'Escape') {
      // Cancelar polilínea en progreso
      if (tool === 'polyline' && polylinePoints.length > 0) {
        setPolylinePoints([])
        return
      }
      
      setTextPosition(null)
      setTextInput('')
      onDrawingSelect([])
    }
    
    // Ctrl+Z para deshacer último punto de polilínea
    if (e.key === 'z' && e.ctrlKey && tool === 'polyline' && polylinePoints.length > 0) {
      e.preventDefault()
      setPolylinePoints(polylinePoints.slice(0, -1))
      return
    }
    
    // Enter para finalizar polilínea
    if (e.key === 'Enter' && tool === 'polyline' && polylinePoints.length >= 2) {
      e.preventDefault()
      finishPolyline()
      return
    }
  }

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedDrawingIds.length > 0) {
        selectedDrawingIds.forEach(id => onDrawingDelete(id))
        onDrawingSelect([])
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [selectedDrawingIds, onDrawingDelete, onDrawingSelect])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // Finalizar polilínea con botón derecho
    if (tool === 'polyline' && polylinePoints.length >= 2) {
      finishPolyline()
    }
  }

  // Calcular offset visual para elementos seleccionados durante drag/resize
  const getVisualOffset = (d: DrawingElement): { dx: number; dy: number } => {
    const isSelected = selectedDrawingIds.includes(d.id)
    if (!isSelected) return { dx: 0, dy: 0 }
    if (isDragging) return { dx: dragOffset.dx * scale, dy: dragOffset.dy * scale }
    if (isResizing && selectedDrawingIds.length === 1) return { dx: 0, dy: 0 } // resize aplica en puntos
    return { dx: 0, dy: 0 }
  }

  const renderDrawing = (d: DrawingElement) => {
    const isSelected = selectedDrawingIds.includes(d.id)

    if (d.element_type === 'line') {
      let [x1, y1, x2, y2] = d.points
      // Preview de resize en tiempo real
      if (isSelected && isResizing && selectedDrawingIds.length === 1) {
        if (resizeHandle === 'nw') { x1 += resizeOffset.dx; y1 += resizeOffset.dy }
        if (resizeHandle === 'se') { x2 += resizeOffset.dx; y2 += resizeOffset.dy }
      }
      return (
        <line
          key={d.id}
          data-testid="drawing"
          data-drawing-id={d.id}
          data-selected={isSelected ? 'true' : 'false'}
          x1={x1 * scale}
          y1={y1 * scale}
          x2={x2 * scale}
          y2={y2 * scale}
          stroke={d.stroke_color}
          strokeWidth={d.stroke_width}
          style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
          onMouseDown={(e) => {
            e.stopPropagation()
            if (isResizing) return
            if (tool === 'select' && selectedDrawingIds.includes(d.id) && onDrawingUpdate) {
              setIsDragging(true)
              setDragStart(getScaledPoint(e))
            }
          }}
          className={isSelected ? 'drawing-selected' : ''}
        />
      )
    }

    if (d.element_type === 'polyline' && d.points.length >= 4 && d.points.length % 2 === 0) {
      const pts: string[] = []
      for (let i = 0; i < d.points.length; i += 2) {
        pts.push(`${d.points[i] * scale},${d.points[i + 1] * scale}`)
      }
      return (
        <polyline
          key={d.id}
          data-testid="drawing"
          data-drawing-id={d.id}
          data-selected={isSelected ? 'true' : 'false'}
          points={pts.join(' ')}
          stroke={d.stroke_color}
          strokeWidth={d.stroke_width}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
          onMouseDown={(e) => {
            e.stopPropagation()
            if (tool === 'select' && selectedDrawingIds.includes(d.id) && onDrawingUpdate) {
              setIsDragging(true)
              setDragStart(getScaledPoint(e))
            }
          }}
          className={isSelected ? 'drawing-selected' : ''}
        />
      )
    }

    if (d.element_type === 'rect' || d.element_type === 'circle') {
      const [x1, y1, x2, y2] = d.points
      if (d.element_type === 'circle') {
        const cx = (x1 + x2) / 2
        const cy = (y1 + y2) / 2
        const rx = (x2 - x1) / 2
        const ry = (y2 - y1) / 2
        return (
          <ellipse
            key={d.id}
            data-testid="drawing"
            data-drawing-id={d.id}
            data-selected={isSelected ? 'true' : 'false'}
            cx={cx * scale}
            cy={cy * scale}
            rx={rx * scale}
            ry={ry * scale}
            stroke={d.stroke_color}
            strokeWidth={d.stroke_width}
            fill={d.fill_color || 'transparent'}
            style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
            onMouseDown={(e) => {
              e.stopPropagation()
              if (tool === 'select' && selectedDrawingIds.includes(d.id) && onDrawingUpdate) {
                setIsDragging(true)
                setDragStart(getScaledPoint(e))
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (tool === 'select' && onDrawingUpdate) {
                setEditingTextId(d.id)
                setEditingText(d.text || '')
              }
            }}
            className={isSelected ? 'drawing-selected' : ''}
          />
        )
      }
      return (
        <rect
          key={d.id}
          data-testid="drawing"
          data-drawing-id={d.id}
          data-selected={isSelected ? 'true' : 'false'}
          x={x1 * scale}
          y={y1 * scale}
          width={(x2 - x1) * scale}
          height={(y2 - y1) * scale}
          stroke={d.stroke_color}
          strokeWidth={d.stroke_width}
          fill={d.fill_color || 'transparent'}
          style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
          onMouseDown={(e) => {
            e.stopPropagation()
            if (tool === 'select' && selectedDrawingIds.includes(d.id) && onDrawingUpdate) {
              setIsDragging(true)
              setDragStart(getScaledPoint(e))
            }
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
          data-testid="drawing"
          data-drawing-id={d.id}
          data-selected={isSelected ? 'true' : 'false'}
          x={x * scale}
          y={y * scale}
          fill={d.text_color}
          fontSize={d.font_size * scale}
          fontFamily={d.font_family}
          style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
          onMouseDown={(e) => {
            e.stopPropagation()
            if (tool === 'select' && selectedDrawingIds.includes(d.id) && onDrawingUpdate) {
              setIsDragging(true)
              setDragStart(getScaledPoint(e))
            }
          }}
          className={isSelected ? 'drawing-selected' : ''}
        >
          {d.text}
        </text>
      )
    }

    if (d.element_type === 'image' && d.image_data && d.points.length >= 4) {
      const [x1, y1, x2, y2] = d.points
      return (
        <image
          key={d.id}
          data-testid="drawing"
          data-drawing-id={d.id}
          data-selected={isSelected ? 'true' : 'false'}
          x={x1 * scale}
          y={y1 * scale}
          width={(x2 - x1) * scale}
          height={(y2 - y1) * scale}
          href={`data:image/png;base64,${d.image_data}`}
          preserveAspectRatio="none"
          style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
          onMouseDown={(e) => {
            e.stopPropagation()
            if (tool === 'select' && selectedDrawingIds.includes(d.id) && onDrawingUpdate) {
              setIsDragging(true)
              setDragStart(getScaledPoint(e))
            }
          }}
          className={isSelected ? 'drawing-selected' : ''}
        />
      )
    }

    return null
  }

  const renderSelectionHighlight = () => {
    if (selectedDrawingIds.length === 0) return null

    const handles: JSX.Element[] = []
    
    const highlight = (
      <g pointerEvents="none">
        {selectedDrawingIds.map(id => {
          const selected = drawings.find(d => d.id === id)
          if (!selected) return null

          let cx = 0, cy = 0, rx = 0, ry = 0

          if (selected.element_type === 'line' && selected.points.length >= 4) {
            let [x1, y1, x2, y2] = selected.points
            // Aplicar offset de resize para preview
            if (isResizing && selectedDrawingIds.length === 1) {
              if (resizeHandle === 'nw') { x1 += resizeOffset.dx; y1 += resizeOffset.dy }
              if (resizeHandle === 'se') { x2 += resizeOffset.dx; y2 += resizeOffset.dy }
            }
            cx = ((x1 + x2) / 2) * scale
            cy = ((y1 + y2) / 2) * scale
            rx = (Math.abs(x2 - x1) / 2 + 6) * scale
            ry = (Math.abs(y2 - y1) / 2 + 6) * scale
          } else if ((selected.element_type === 'rect' || selected.element_type === 'circle' || selected.element_type === 'image') && selected.points.length >= 4) {
            const [x1, y1, x2, y2] = selected.points
            cx = ((x1 + x2) / 2) * scale
            cy = ((y1 + y2) / 2) * scale
            rx = (Math.abs(x2 - x1) / 2 + 6) * scale
            ry = (Math.abs(y2 - y1) / 2 + 6) * scale
          } else if (selected.element_type === 'polyline' && selected.points.length >= 4) {
            const bb = _getDrawingBBox(selected)
            if (bb) {
              cx = ((bb.x1 + bb.x2) / 2) * scale
              cy = ((bb.y1 + bb.y2) / 2) * scale
              rx = (Math.abs(bb.x2 - bb.x1) / 2 + 6) * scale
              ry = (Math.abs(bb.y2 - bb.y1) / 2 + 6) * scale
            }
          } else if (selected.element_type === 'text' && selected.points.length >= 2) {
            const [x, y] = selected.points
            const textWidth = ((selected.text?.length || 0) * (selected.font_size || 14) * 0.6 + 10) * scale
            const textHeight = ((selected.font_size || 14) + 10) * scale
            cx = (x + textWidth / 2 / scale - 5) * scale
            cy = (y - (selected.font_size || 14) / 2) * scale
            rx = textWidth / 2 + 6
            ry = textHeight / 2 + 6
          }

          // Solo mostrar handles para selección simple (1 elemento), excluir polylines (resize las corrompería)
          const showHandles = selectedDrawingIds.length === 1 && selectedDrawingIds[0] === id && selected.element_type !== 'polyline'

          if (showHandles && onDrawingUpdate) {
            if (selected.element_type === 'line' && selected.points.length >= 4) {
              // Líneas: 2 handles en los endpoints (con offset de resize)
              let [lx1, ly1, lx2, ly2] = selected.points
              if (isResizing) {
                if (resizeHandle === 'nw') { lx1 += resizeOffset.dx; ly1 += resizeOffset.dy }
                if (resizeHandle === 'se') { lx2 += resizeOffset.dx; ly2 += resizeOffset.dy }
              }
              handles.push(
                <rect
                  key={`${id}-p1`}
                  data-testid="drawing-handle-nw"
                  x={lx1 * scale - 5} y={ly1 * scale - 5} width={10} height={10} fill="#2563eb" rx={5}
                  style={{ cursor: 'crosshair', pointerEvents: 'all' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setIsDragging(false)
                    setDragStart(null)
                    setIsResizing(true)
                    setResizeHandle('nw')
                    setResizeStartPoint(getScaledPoint(e))
                  }}
                />,
                <rect
                  key={`${id}-p2`}
                  data-testid="drawing-handle-se"
                  x={lx2 * scale - 5} y={ly2 * scale - 5} width={10} height={10} fill="#2563eb" rx={5}
                  style={{ cursor: 'crosshair', pointerEvents: 'all' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setIsDragging(false)
                    setDragStart(null)
                    setIsResizing(true)
                    setResizeHandle('se')
                    setResizeStartPoint(getScaledPoint(e))
                  }}
                />
              )
            } else {
              // Rect/circle/image/text: 4 handles de esquina
              handles.push(
                <rect 
                  key={`${id}-nw`}
                  data-testid="drawing-handle-nw"
                  x={cx - rx - 4} y={cy - ry - 4} width={8} height={8} fill="#2563eb" 
                  style={{ cursor: 'nw-resize' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setIsDragging(false)
                    setDragStart(null)
                    setIsResizing(true)
                    setResizeHandle('nw')
                    setResizeStartPoint(getScaledPoint(e))
                  }}
                />,
                <rect 
                  key={`${id}-ne`}
                  data-testid="drawing-handle-ne"
                  x={cx + rx - 4} y={cy - ry - 4} width={8} height={8} fill="#2563eb" 
                  style={{ cursor: 'ne-resize' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setIsDragging(false)
                    setDragStart(null)
                    setIsResizing(true)
                    setResizeHandle('ne')
                    setResizeStartPoint(getScaledPoint(e))
                  }}
                />,
                <rect 
                  key={`${id}-sw`}
                  data-testid="drawing-handle-sw"
                  x={cx - rx - 4} y={cy + ry - 4} width={8} height={8} fill="#2563eb" 
                  style={{ cursor: 'sw-resize' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setIsDragging(false)
                    setDragStart(null)
                    setIsResizing(true)
                    setResizeHandle('sw')
                    setResizeStartPoint(getScaledPoint(e))
                  }}
                />,
                <rect 
                  key={`${id}-se`}
                  data-testid="drawing-handle-se"
                  x={cx + rx - 4} y={cy + ry - 4} width={8} height={8} fill="#2563eb" 
                  style={{ cursor: 'se-resize' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setIsDragging(false)
                    setDragStart(null)
                    setIsResizing(true)
                    setResizeHandle('se')
                    setResizeStartPoint(getScaledPoint(e))
                  }}
                />
              )
            }
          }

          return (
            <g key={id}>
              <rect
                x={cx - rx}
                y={cy - ry}
                width={rx * 2}
                height={ry * 2}
                fill="none"
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="4,4"
              />
            </g>
          )
        })}
      </g>
    )
    
    return (
      <>
        {highlight}
        {handles.length > 0 && <g>{handles}</g>}
      </>
    )
  }

  const renderPreview = () => {
    if (tool === 'polyline' && polylinePoints.length > 0) {
      const points = polylinePoints.map(p => `${p.x * scale},${p.y * scale}`).join(' ')
      
      return (
        <>
          {/* Línea punteada más visible */}
          <polyline
            points={points}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth + 1}
            strokeDasharray="8,4"
            opacity={0.8}
          />
          {/* Puntos en los vértices */}
          {polylinePoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x * scale}
              cy={p.y * scale}
              r={4}
              fill="#2563eb"
              stroke="white"
              strokeWidth={1}
            />
          ))}
        </>
      )
    }
    
    if (!isDrawing || !startPoint || !currentPoint) return null

    if (tool === 'line') {
      // El currentPoint ya está ajustado en handleMouseMove si Shift está presionado
      return (
        <line
          x1={startPoint.x * scale}
          y1={startPoint.y * scale}
          x2={(currentPoint?.x || startPoint.x) * scale}
          y2={(currentPoint?.y || startPoint.y) * scale}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray="5,5"
        />
      )
    }

    if (tool === 'capture') {
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
          stroke="#2563eb"
          strokeWidth={2}
          fill="rgba(37, 99, 235, 0.1)"
          strokeDasharray="6,3"
        />
      )
    }

    if (tool === 'rect' || tool === 'circle') {
      const x1 = Math.min(startPoint.x, currentPoint.x)
      const y1 = Math.min(startPoint.y, currentPoint.y)
      const x2 = Math.max(startPoint.x, currentPoint.x)
      const y2 = Math.max(startPoint.y, currentPoint.y)
      if (tool === 'circle') {
        const cx = (x1 + x2) / 2
        const cy = (y1 + y2) / 2
        const rx = (x2 - x1) / 2
        const ry = (y2 - y1) / 2
        return (
          <ellipse
            cx={cx * scale}
            cy={cy * scale}
            rx={rx * scale}
            ry={ry * scale}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill={fillColor || 'transparent'}
            strokeDasharray="5,5"
          />
        )
      }
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
      data-testid="drawing-canvas"
      ref={canvasRef}
      className="absolute top-0 left-0"
      style={{
        width: imageSize.width * scale,
        height: imageSize.height * scale,
        cursor: tool === 'select' ? 'default' : tool === 'add_text_box' ? 'text' : tool === 'place_snippet' ? 'copy' : 'crosshair',
      }}
      onMouseDownCapture={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <svg
        width={imageSize.width * scale}
        height={imageSize.height * scale}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <style>
          {`.drawing-selected { filter: drop-shadow(0 0 3px #2563eb); }`}
        </style>
        {drawings.map(d => {
          const vo = getVisualOffset(d)
          return vo.dx === 0 && vo.dy === 0
            ? renderDrawing(d)
            : <g key={`wrap-${d.id}`} transform={`translate(${vo.dx},${vo.dy})`}>{renderDrawing(d)}</g>
        })}
        {renderSelectionHighlight()}
        {renderPreview()}
        {marqueeStart && marqueeEnd && (
          <rect
            x={Math.min(marqueeStart.x, marqueeEnd.x) * scale}
            y={Math.min(marqueeStart.y, marqueeEnd.y) * scale}
            width={Math.abs(marqueeEnd.x - marqueeStart.x) * scale}
            height={Math.abs(marqueeEnd.y - marqueeStart.y) * scale}
            stroke="#2563eb"
            strokeWidth={1}
            fill="rgba(37, 99, 235, 0.1)"
            strokeDasharray="4,4"
          />
        )}
      </svg>

      {editingTextId && (
        <div
          style={{
            position: 'absolute',
            left: (() => {
              const d = drawings.find(d => d.id === editingTextId)
              return d ? d.points[0] * scale : 0
            })(),
            top: (() => {
              const d = drawings.find(d => d.id === editingTextId)
              return d ? d.points[1] * scale : 0
            })(),
            zIndex: 1000,
          }}
        >
          <input
            type="text"
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (onDrawingUpdate) {
                  onDrawingUpdate(editingTextId, { text: editingText })
                }
                setEditingTextId(null)
                setEditingText('')
              }
              if (e.key === 'Escape') {
                setEditingTextId(null)
                setEditingText('')
              }
            }}
            onBlur={() => {
              if (onDrawingUpdate) {
                onDrawingUpdate(editingTextId, { text: editingText })
              }
              setEditingTextId(null)
              setEditingText('')
            }}
            autoFocus
            className="px-1 py-0.5 border border-blue-500 rounded text-sm"
            style={{ 
              minWidth: '100px',
              color: (() => {
                const d = drawings.find(d => d.id === editingTextId)
                return d?.text_color || '#000000'
              })(),
            }}
          />
        </div>
      )}

      {polylinePoints.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(37, 99, 235, 0.9)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 1000,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Polilínea: {polylinePoints.length} puntos — Doble-click, Enter o Click derecho para finalizar | Esc para cancelar | Ctrl+Z deshacer
        </div>
      )}

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
            className="px-1 py-0.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Texto..."
            style={{ minWidth: '100px' }}
          />
        </div>
      )}
    </div>
  )
}
