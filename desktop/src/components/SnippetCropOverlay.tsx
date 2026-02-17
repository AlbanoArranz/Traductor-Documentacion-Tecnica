import { useState, useRef, useCallback, useEffect } from 'react'
import { Copy, X, Move } from 'lucide-react'

interface CropRegion {
  id: string
  x: number
  y: number
  w: number
  h: number
}

interface SnippetCropOverlayProps {
  imageWidth: number
  imageHeight: number
  scale: number
  isActive: boolean
  onCrop: (region: { x: number; y: number; w: number; h: number }) => void
  onCancel: () => void
}

export function SnippetCropOverlay({
  imageWidth,
  imageHeight,
  scale,
  isActive,
  onCrop,
  onCancel,
}: SnippetCropOverlayProps) {
  const [selection, setSelection] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const [copiedRegion, setCopiedRegion] = useState<CropRegion | null>(null)
  const [pastePosition, setPastePosition] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingPaste, setIsDraggingPaste] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const getCoords = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!overlayRef.current) return null
    const rect = overlayRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    return { x: Math.max(0, Math.min(imageWidth, x)), y: Math.max(0, Math.min(imageHeight, y)) }
  }, [scale, imageWidth, imageHeight])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isActive) return
    const coords = getCoords(e)
    if (!coords) return
    
    if (copiedRegion && e.shiftKey) {
      // Iniciar arrastre para pegar
      setPastePosition({ x: coords.x - copiedRegion.w / 2, y: coords.y - copiedRegion.h / 2 })
      setIsDraggingPaste(true)
      return
    }
    
    setSelection({ startX: coords.x, startY: coords.y, currentX: coords.x, currentY: coords.y })
  }, [isActive, getCoords, copiedRegion])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isActive) return
    
    if (isDraggingPaste && copiedRegion) {
      const coords = getCoords(e)
      if (coords) {
        setPastePosition({ x: coords.x - copiedRegion.w / 2, y: coords.y - copiedRegion.h / 2 })
      }
      return
    }
    
    if (selection) {
      const coords = getCoords(e)
      if (coords) {
        setSelection(prev => prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null)
      }
    }
  }, [isActive, selection, getCoords, isDraggingPaste, copiedRegion])

  const handleMouseUp = useCallback(() => {
    if (isDraggingPaste && copiedRegion && pastePosition) {
      // Confirmar pegado
      onCrop({
        x: Math.round(pastePosition.x),
        y: Math.round(pastePosition.y),
        w: Math.round(copiedRegion.w),
        h: Math.round(copiedRegion.h),
      })
      // Mantener copiedRegion para más pegados
      setIsDraggingPaste(false)
      setPastePosition(null)
      return
    }
    
    if (selection) {
      const x = Math.min(selection.startX, selection.currentX)
      const y = Math.min(selection.startY, selection.currentY)
      const w = Math.abs(selection.currentX - selection.startX)
      const h = Math.abs(selection.currentY - selection.startY)
      
      if (w > 5 && h > 5) {
        setCopiedRegion({
          id: `crop-${Date.now()}`,
          x: Math.round(x),
          y: Math.round(y),
          w: Math.round(w),
          h: Math.round(h),
        })
      }
      setSelection(null)
    }
  }, [isDraggingPaste, copiedRegion, pastePosition, selection, onCrop])

  const handleConfirmPaste = useCallback(() => {
    if (copiedRegion) {
      onCrop({
        x: Math.round(copiedRegion.x),
        y: Math.round(copiedRegion.y),
        w: Math.round(copiedRegion.w),
        h: Math.round(copiedRegion.h),
      })
    }
  }, [copiedRegion, onCrop])

  const handleCancel = useCallback(() => {
    setSelection(null)
    setCopiedRegion(null)
    setPastePosition(null)
    setIsDraggingPaste(false)
    onCancel()
  }, [onCancel])

  useEffect(() => {
    if (!isActive) {
      setSelection(null)
      setCopiedRegion(null)
      setPastePosition(null)
      setIsDraggingPaste(false)
    }
  }, [isActive])

  if (!isActive) return null

  const selectionRect = selection ? {
    left: Math.min(selection.startX, selection.currentX) * scale,
    top: Math.min(selection.startY, selection.currentY) * scale,
    width: Math.abs(selection.currentX - selection.startX) * scale,
    height: Math.abs(selection.currentY - selection.startY) * scale,
  } : null

  const copiedRect = copiedRegion ? {
    left: copiedRegion.x * scale,
    top: copiedRegion.y * scale,
    width: copiedRegion.w * scale,
    height: copiedRegion.h * scale,
  } : null

  const pasteRect = copiedRegion && pastePosition ? {
    left: pastePosition.x * scale,
    top: pastePosition.y * scale,
    width: copiedRegion.w * scale,
    height: copiedRegion.h * scale,
  } : null

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Selection rectangle */}
      {selectionRect && (
        <div
          className="absolute border-2 border-dashed border-orange-500 bg-orange-500/10"
          style={{
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        />
      )}

      {/* Copied region indicator */}
      {copiedRect && !selection && (
        <div
          className="absolute border-2 border-green-500 bg-green-500/10"
          style={{
            left: copiedRect.left,
            top: copiedRect.top,
            width: copiedRect.width,
            height: copiedRect.height,
          }}
        >
          <div className="absolute -top-6 left-0 flex items-center gap-1 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded">
            <Copy size={10} />
            <span>{copiedRegion?.w}×{copiedRegion?.h}</span>
          </div>
        </div>
      )}

      {/* Paste preview */}
      {pasteRect && (
        <div
          className="absolute border-2 border-blue-500 border-dashed bg-blue-500/20"
          style={{
            left: pasteRect.left,
            top: pasteRect.top,
            width: pasteRect.width,
            height: pasteRect.height,
          }}
        >
          <div className="absolute -top-6 left-0 flex items-center gap-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded">
            <Move size={10} />
            <span>Pegar aquí</span>
          </div>
        </div>
      )}

      {/* Toolbar flotante */}
      {copiedRegion && !selection && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white rounded shadow-lg p-1 text-xs">
          <span className="text-gray-600 px-1">Región copiada</span>
          <button
            onClick={handleConfirmPaste}
            className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            title="Pegar en origen (click para duplicar)"
          >
            <Copy size={12} /> Pegar
          </button>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-gray-100 rounded"
            title="Cancelar"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Instrucciones */}
      {!copiedRegion && !selection && (
        <div className="absolute top-2 left-2 bg-white/90 rounded shadow px-2 py-1 text-xs text-gray-600">
          Arrastra para seleccionar zona · Shift+click para pegar
        </div>
      )}
    </div>
  )
}
