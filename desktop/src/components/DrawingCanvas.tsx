import { useState, useRef, useEffect, useCallback } from 'react'
import type { DrawingElement } from '../lib/api'

export type DrawingTool = 'select' | 'line' | 'rect' | 'circle' | 'polyline' | 'add_text_box' | null
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
}: DrawingCanvasProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null)
  const [resizeStartPoint, setResizeStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null)
  const [textInput, setTextInput] = useState('')
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null)
  const [polylinePoints, setPolylinePoints] = useState<{ x: number; y: number }[]>([])
  const polylinePointsRef = useRef(polylinePoints)
  
  // Actualizar ref siempre que cambie polylinePoints
  useEffect(() => {
    polylinePointsRef.current = polylinePoints
  }, [polylinePoints])
  
  const [lastClickTime, setLastClickTime] = useState<number | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const getScaledPoint = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    }
  }

  const finishPolyline = useCallback(() => {
    const currentPoints = polylinePointsRef.current
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
      setPolylinePoints([])
    }
  }, [onDrawingCreate, strokeColor, strokeWidth])

  const handleMouseDown = (e: React.MouseEvent) => {
    // Si la herramienta es 'select', permitir que el click pase a los elementos
    // pero si se hace click en el canvas vacío, deseleccionar
    if (!tool || tool === 'select') {
      if (e.target === canvasRef.current || e.target === e.currentTarget) {
        onDrawingSelect([])
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

    // Modo polilínea: click añade punto, doble click finaliza, Escape cancela
    if (tool === 'polyline') {
      // Detectar doble-click (300ms desde el último click)
      const now = Date.now()
      const currentPoints = polylinePointsRef.current
      if (currentPoints.length >= 2 && now - (lastClickTime || 0) < 300) {
        // Doble-click: finalizar polilínea
        finishPolyline()
        setLastClickTime(null)
        return
      }
      setLastClickTime(now)
      
      if (currentPoints.length === 0) {
        // Primer punto
        setPolylinePoints([point])
      } else {
        // Añadir punto con snap a ejes si Shift está presionado
        const lastPoint = currentPoints[currentPoints.length - 1]
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
        
        setPolylinePoints([...currentPoints, newPoint])
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
    } else if (isDragging && dragStart && onDrawingUpdate) {
      const current = getScaledPoint(e)
      const dx = current.x - dragStart.x
      const dy = current.y - dragStart.y
      
      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        selectedDrawingIds.forEach(id => {
          const drawing = drawings.find(d => d.id === id)
          if (drawing) {
            const newPoints = drawing.points.map((p, i) => 
              i % 2 === 0 ? p + dx : p + dy
            )
            onDrawingUpdate(id, { points: newPoints })
          }
        })
        setDragStart(current)
      }
    } else if (isResizing && resizeHandle && resizeStartPoint && onDrawingUpdate && selectedDrawingIds.length === 1) {
      const current = getScaledPoint(e)
      const dx = current.x - resizeStartPoint.x
      const dy = current.y - resizeStartPoint.y
      
      const id = selectedDrawingIds[0]
      const drawing = drawings.find(d => d.id === id)
      if (drawing && drawing.points.length >= 4) {
        const [x1, y1, x2, y2] = drawing.points
        let newPoints: number[] = []
        
        switch (resizeHandle) {
          case 'nw':
            newPoints = [x1 + dx, y1 + dy, x2, y2]
            break
          case 'ne':
            newPoints = [x1, y1 + dy, x2 + dx, y2]
            break
          case 'sw':
            newPoints = [x1 + dx, y1, x2, y2 + dy]
            break
          case 'se':
            newPoints = [x1, y1, x2 + dx, y2 + dy]
            break
          default:
            newPoints = [x1, y1, x2, y2]
        }
        
        onDrawingUpdate(id, { points: newPoints })
        setResizeStartPoint(current)
      }
    }
  }

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false)
      setDragStart(null)
      return
    }
    
    if (isResizing) {
      setIsResizing(false)
      setResizeHandle(null)
      setResizeStartPoint(null)
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

  // Cambiar grosor de elementos seleccionados cuando cambia strokeWidth
  useEffect(() => {
    if (selectedDrawingIds.length > 0 && onDrawingUpdate && tool === 'select') {
      selectedDrawingIds.forEach(id => {
        onDrawingUpdate(id, { stroke_width: strokeWidth })
      })
    }
  }, [strokeWidth, tool, selectedDrawingIds, onDrawingUpdate])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // Finalizar polilínea con botón derecho
    if (tool === 'polyline' && polylinePoints.length >= 2) {
      finishPolyline()
    }
  }

  const renderDrawing = (d: DrawingElement) => {
    const isSelected = selectedDrawingIds.includes(d.id)

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
            if (tool === 'select') {
              if (e.ctrlKey || e.metaKey) {
                // Toggle selection
                if (selectedDrawingIds.includes(d.id)) {
                  onDrawingSelect(selectedDrawingIds.filter(id => id !== d.id))
                } else {
                  onDrawingSelect([...selectedDrawingIds, d.id])
                }
              } else {
                // Single selection
                onDrawingSelect([d.id])
              }
            }
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            if (tool === 'select' && selectedDrawingIds.includes(d.id) && onDrawingUpdate) {
              setIsDragging(true)
              setDragStart(getScaledPoint(e))
            }
          }}
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
            cx={cx * scale}
            cy={cy * scale}
            rx={rx * scale}
            ry={ry * scale}
            stroke={d.stroke_color}
            strokeWidth={d.stroke_width}
            fill={d.fill_color || 'transparent'}
            style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
            onClick={(e) => {
              e.stopPropagation()
              if (tool === 'select') {
                if (e.ctrlKey || e.metaKey) {
                  if (selectedDrawingIds.includes(d.id)) {
                    onDrawingSelect(selectedDrawingIds.filter(id => id !== d.id))
                  } else {
                    onDrawingSelect([...selectedDrawingIds, d.id])
                  }
                } else {
                  onDrawingSelect([d.id])
                }
              }
            }}
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
            if (tool === 'select') {
              if (e.ctrlKey || e.metaKey) {
                // Toggle selection
                if (selectedDrawingIds.includes(d.id)) {
                  onDrawingSelect(selectedDrawingIds.filter(id => id !== d.id))
                } else {
                  onDrawingSelect([...selectedDrawingIds, d.id])
                }
              } else {
                // Single selection
                onDrawingSelect([d.id])
              }
            }
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            if (tool === 'select' && selectedDrawingIds.includes(d.id) && onDrawingUpdate) {
              setIsDragging(true)
              setDragStart(getScaledPoint(e))
            }
          }}
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
            if (tool === 'select') {
              if (e.ctrlKey || e.metaKey) {
                // Toggle selection
                if (selectedDrawingIds.includes(d.id)) {
                  onDrawingSelect(selectedDrawingIds.filter(id => id !== d.id))
                } else {
                  onDrawingSelect([...selectedDrawingIds, d.id])
                }
              } else {
                // Single selection
                onDrawingSelect([d.id])
              }
            }
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            if (tool === 'select' && selectedDrawingIds.includes(d.id) && onDrawingUpdate) {
              setIsDragging(true)
              setDragStart(getScaledPoint(e))
            }
          }}
        >
          {d.text}
        </text>
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
            const [x1, y1, x2, y2] = selected.points
            cx = ((x1 + x2) / 2) * scale
            cy = ((y1 + y2) / 2) * scale
            rx = (Math.abs(x2 - x1) / 2 + 6) * scale
            ry = (Math.abs(y2 - y1) / 2 + 6) * scale
          } else if ((selected.element_type === 'rect' || selected.element_type === 'circle') && selected.points.length >= 4) {
            const [x1, y1, x2, y2] = selected.points
            cx = ((x1 + x2) / 2) * scale
            cy = ((y1 + y2) / 2) * scale
            rx = (Math.abs(x2 - x1) / 2 + 6) * scale
            ry = (Math.abs(y2 - y1) / 2 + 6) * scale
          } else if (selected.element_type === 'text' && selected.points.length >= 2) {
            const [x, y] = selected.points
            const textWidth = ((selected.text?.length || 0) * (selected.font_size || 14) * 0.6 + 10) * scale
            const textHeight = ((selected.font_size || 14) + 10) * scale
            cx = (x + textWidth / 2 / scale - 5) * scale
            cy = (y - (selected.font_size || 14) / 2) * scale
            rx = textWidth / 2 + 6
            ry = textHeight / 2 + 6
          }

          // Solo mostrar handles para selección simple (1 elemento)
          const showHandles = selectedDrawingIds.length === 1 && selectedDrawingIds[0] === id

          if (showHandles && onDrawingUpdate) {
            handles.push(
              <rect 
                key={`${id}-nw`}
                x={cx - rx - 4} y={cy - ry - 4} width={8} height={8} fill="#2563eb" 
                style={{ cursor: 'nw-resize' }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  setIsResizing(true)
                  setResizeHandle('nw')
                  setResizeStartPoint(getScaledPoint(e))
                }}
              />,
              <rect 
                key={`${id}-ne`}
                x={cx + rx - 4} y={cy - ry - 4} width={8} height={8} fill="#2563eb" 
                style={{ cursor: 'ne-resize' }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  setIsResizing(true)
                  setResizeHandle('ne')
                  setResizeStartPoint(getScaledPoint(e))
                }}
              />,
              <rect 
                key={`${id}-sw`}
                x={cx - rx - 4} y={cy + ry - 4} width={8} height={8} fill="#2563eb" 
                style={{ cursor: 'sw-resize' }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  setIsResizing(true)
                  setResizeHandle('sw')
                  setResizeStartPoint(getScaledPoint(e))
                }}
              />,
              <rect 
                key={`${id}-se`}
                x={cx + rx - 4} y={cy + ry - 4} width={8} height={8} fill="#2563eb" 
                style={{ cursor: 'se-resize' }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  setIsResizing(true)
                  setResizeHandle('se')
                  setResizeStartPoint(getScaledPoint(e))
                }}
              />
            )
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
      ref={canvasRef}
      className="absolute top-0 left-0"
      style={{
        width: imageSize.width * scale,
        height: imageSize.height * scale,
        cursor: tool === 'select' ? 'default' : tool === 'add_text_box' ? 'text' : 'crosshair',
      }}
      onMouseDown={handleMouseDown}
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
        {drawings.map(renderDrawing)}
        {renderSelectionHighlight()}
        {renderPreview()}
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
