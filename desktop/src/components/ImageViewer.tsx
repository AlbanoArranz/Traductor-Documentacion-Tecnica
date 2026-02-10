import { useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import type { TextRegion, DrawingElement } from '../lib/api'
import { EditableTextBox } from './EditableTextBox'
import { DrawingCanvas, type DrawingTool } from './DrawingCanvas'
import { DrawingToolbar } from './DrawingToolbar'

interface ImageViewerProps {
  projectId: string
  selectedPage: number
  imageUrl: string | null
  imageSize: { width: number; height: number }
  imageScale: number
  zoomLevel: number
  onZoomChange: (level: number) => void
  showTranslated: boolean
  onShowTranslatedChange: (show: boolean) => void
  drawingMode: boolean
  onDrawingModeChange: (mode: boolean) => void
  drawingTool: DrawingTool
  onDrawingToolChange: (tool: DrawingTool) => void
  drawingStrokeColor: string
  drawingStrokeWidth: number
  drawingFillColor: string | null
  onDrawingStyleChange: (style: { strokeColor: string; strokeWidth: number; fillColor: string | null }) => void
  drawings: DrawingElement[]
  selectedDrawingIds: string[]
  onDrawingCreate: (data: Omit<DrawingElement, 'id' | 'project_id' | 'page_number' | 'created_at'>) => void
  onDrawingSelect: (ids: string[]) => void
  onDrawingDelete: (id: string) => void
  onDrawingUpdate: (id: string, updates: Partial<DrawingElement>) => void
  selectedRegionIds: Set<string>
  onRegionSelect: (ids: Set<string>) => void
  regions: TextRegion[]
  onRender: () => void
  onOcr: () => void
  onCompose: () => void
  onComposeAll: () => void
  onAddTextBox: () => void
  isRendering: boolean
  isOcring: boolean
  isComposing: boolean
  isComposingAll: boolean
  composeProgress?: { current: number; total: number }
  canShowOriginal: boolean
  canShowTranslated: boolean
  documentType?: 'schematic' | 'manual'
  updateRegionMutation: any
  imageViewerRef?: React.RefObject<HTMLDivElement>
  imageRef?: React.RefObject<HTMLImageElement>
  onImageLoad?: () => void
}

const ZOOM_STEP = 0.25
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4

export function ImageViewer({
  projectId,
  selectedPage,
  imageUrl,
  imageSize,
  imageScale,
  zoomLevel,
  onZoomChange,
  showTranslated,
  onShowTranslatedChange,
  drawingMode,
  onDrawingModeChange,
  drawingTool,
  onDrawingToolChange,
  drawingStrokeColor,
  drawingStrokeWidth,
  drawingFillColor,
  onDrawingStyleChange,
  drawings,
  selectedDrawingIds,
  onDrawingCreate,
  onDrawingSelect,
  onDrawingDelete,
  onDrawingUpdate,
  selectedRegionIds,
  onRegionSelect,
  regions,
  onRender,
  onOcr,
  onCompose,
  onComposeAll,
  onAddTextBox,
  isRendering,
  isOcring,
  isComposing,
  isComposingAll,
  composeProgress,
  canShowOriginal,
  canShowTranslated,
  documentType,
  updateRegionMutation,
  imageViewerRef,
  imageRef,
  onImageLoad,
}: ImageViewerProps) {
  const [isDraggingSelection, setIsDraggingSelection] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{x: number, y: number, width: number, height: number} | null>(null)
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null)

  const handleImageLoad = () => {
    if (imageRef.current && onImageLoad) {
      const naturalWidth = imageRef.current.naturalWidth
      const naturalHeight = imageRef.current.naturalHeight
      imageSize.width = naturalWidth
      imageSize.height = naturalHeight
    }
  }

  return (
    <div ref={imageViewerRef} className="flex-1 overflow-auto p-4 bg-gray-100">
      <div className="flex gap-2 mb-4">
        <button
          onClick={onRender}
          disabled={isRendering}
          className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
        >
          {isRendering ? 'Renderizando...' : 'Renderizar'}
        </button>
        <button
          onClick={onOcr}
          disabled={isOcring || !canShowOriginal}
          className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
        >
          {isOcring ? 'Detectando...' : 'OCR'}
        </button>
        <button
          onClick={onAddTextBox}
          disabled={!canShowOriginal}
          className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
          title="Añadir caja de texto manual"
        >
          + Añadir caja
        </button>
        <button
          onClick={onCompose}
          disabled={isComposing || !regions.length}
          className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
        >
          {isComposing ? 'Componiendo...' : 'Componer'}
        </button>
        <button
          onClick={onComposeAll}
          disabled={isComposingAll}
          className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
          title="Componer la imagen traducida de todas las páginas"
        >
          {isComposingAll
            ? `Componiendo ${composeProgress?.current || 0}/${composeProgress?.total || 0}...`
            : 'Componer todas'}
        </button>
        {canShowOriginal && canShowTranslated && (
          <button
            onClick={() => onShowTranslatedChange(!showTranslated)}
            className="px-3 py-1 text-sm border rounded hover:bg-white ml-4 bg-gray-100"
          >
            Ver: {showTranslated ? 'Traducida' : 'Original'}
          </button>
        )}
        <button
          onClick={() => onDrawingModeChange(!drawingMode)}
          className={`px-3 py-1 text-sm border rounded hover:bg-white ml-2 flex items-center gap-1 ${
            drawingMode ? 'bg-primary-100 border-primary-500 text-primary-700' : ''
          }`}
          title="Herramientas de dibujo"
        >
          <Pencil size={14} />
          Dibujar
        </button>
        <div className="flex items-center gap-1 ml-4 border rounded bg-white">
          <button
            onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP))}
            disabled={zoomLevel <= MIN_ZOOM}
            className="px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Alejar (-)"
          >
            −
          </button>
          <span className="px-2 text-sm font-medium min-w-[3.5rem] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP))}
            disabled={zoomLevel >= MAX_ZOOM}
            className="px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Acercar (+)"
          >
            +
          </button>
          <button
            onClick={() => onZoomChange(1)}
            disabled={zoomLevel === 1}
            className="px-2 py-1 text-sm hover:bg-gray-100 border-l disabled:opacity-30 disabled:cursor-not-allowed"
            title="Reset zoom (100%)"
          >
            ⟲
          </button>
        </div>
      </div>

      {/* Drawing toolbar - fixed */}
      {drawingMode && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <DrawingToolbar
            tool={drawingTool}
            onToolChange={onDrawingToolChange}
            strokeColor={drawingStrokeColor}
            onStrokeColorChange={(color) => onDrawingStyleChange({ strokeColor: color, strokeWidth: drawingStrokeWidth, fillColor: drawingFillColor })}
            strokeWidth={drawingStrokeWidth}
            onStrokeWidthChange={(width) => onDrawingStyleChange({ strokeColor: drawingStrokeColor, strokeWidth: width, fillColor: drawingFillColor })}
            fillColor={drawingFillColor}
            onFillColorChange={(fill) => onDrawingStyleChange({ strokeColor: drawingStrokeColor, strokeWidth: drawingStrokeWidth, fillColor: fill })}
            onClose={() => onDrawingModeChange(false)}
          />
        </div>
      )}

      {imageUrl ? (
        <div className="relative inline-block">
          <img
            ref={imageRef}
            src={imageUrl}
            alt={`Página ${selectedPage + 1}`}
            className="shadow-lg block"
            style={{
              maxWidth: 'none',
              maxHeight: 'none',
              width: imageSize.width > 0 ? imageSize.width * imageScale : undefined,
              height: imageSize.height > 0 ? imageSize.height * imageScale : undefined,
            }}
            onLoad={handleImageLoad}
          />
          {/* Overlay interactivo para regiones de texto */}
          {regions && regions.length > 0 && imageSize.width > 0 && (
            <div
              className="absolute top-0 left-0"
              style={{
                width: imageSize.width * imageScale,
                height: imageSize.height * imageScale,
                cursor: isDraggingSelection ? 'crosshair' : 'default',
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const y = e.clientY - rect.top
                  setDragStart({ x, y })
                  setSelectionRect({ x, y, width: 0, height: 0 })
                  setIsDraggingSelection(true)
                  if (!e.ctrlKey && !e.metaKey) {
                    onRegionSelect(new Set())
                  }
                }
              }}
              onMouseMove={(e) => {
                if (!isDraggingSelection || !dragStart) return
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                const newRect = {
                  x: Math.min(dragStart.x, x),
                  y: Math.min(dragStart.y, y),
                  width: Math.abs(x - dragStart.x),
                  height: Math.abs(y - dragStart.y),
                }
                setSelectionRect(newRect)
              }}
              onMouseUp={() => {
                if (!isDraggingSelection || !selectionRect) {
                  setIsDraggingSelection(false)
                  setDragStart(null)
                  return
                }
                const selectedIds = new Set(selectedRegionIds)
                regions.forEach((region) => {
                  const [x1, y1, x2, y2] = region.bbox
                  const sx1 = x1 * imageScale
                  const sy1 = y1 * imageScale
                  const sx2 = x2 * imageScale
                  const sy2 = y2 * imageScale
                  const intersects = !(
                    sx2 < selectionRect.x ||
                    sx1 > selectionRect.x + selectionRect.width ||
                    sy2 < selectionRect.y ||
                    sy1 > selectionRect.y + selectionRect.height
                  )
                  if (intersects) {
                    selectedIds.add(region.id)
                  }
                })
                onRegionSelect(selectedIds)
                setIsDraggingSelection(false)
                setDragStart(null)
                setSelectionRect(null)
              }}
            >
              {selectionRect && (
                <div
                  style={{
                    position: 'absolute',
                    left: selectionRect.x,
                    top: selectionRect.y,
                    width: selectionRect.width,
                    height: selectionRect.height,
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    border: '2px dashed #2563eb',
                    pointerEvents: 'none',
                    zIndex: 1000,
                  }}
                />
              )}
              {regions.map((region, index) => (
                <EditableTextBox
                  key={region.id}
                  region={region}
                  scale={imageScale}
                  isSelected={selectedRegionIds.has(region.id)}
                  index={index}
                  onSelect={(e) => {
                    if (e?.ctrlKey || e?.metaKey) {
                      const newIds = new Set(selectedRegionIds)
                      if (newIds.has(region.id)) newIds.delete(region.id)
                      else newIds.add(region.id)
                      onRegionSelect(newIds)
                    } else {
                      onRegionSelect(new Set([region.id]))
                    }
                  }}
                  onUpdate={(updates) =>
                    updateRegionMutation.mutate({
                      regionId: region.id,
                      updates,
                    })
                  }
                  documentType={documentType}
                />
              ))}
            </div>
          )}
          {/* Canvas de dibujo */}
          {drawingMode && imageSize.width > 0 && (
            <DrawingCanvas
              imageSize={imageSize}
              scale={imageScale}
              tool={drawingTool}
              strokeColor={drawingStrokeColor}
              strokeWidth={drawingStrokeWidth}
              fillColor={drawingFillColor}
              drawings={drawings}
              selectedDrawingIds={selectedDrawingIds}
              onDrawingCreate={onDrawingCreate}
              onDrawingSelect={onDrawingSelect}
              onDrawingDelete={onDrawingDelete}
              onDrawingUpdate={onDrawingUpdate}
              onAddTextBox={(position) => {
                const defaultWidth = 150
                const defaultHeight = 30
                const bbox = [
                  position.x,
                  position.y,
                  position.x + defaultWidth,
                  position.y + defaultHeight
                ]
                // This needs to be handled by parent
                console.log('Add text box at:', bbox)
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-400">
          Haz clic en "Renderizar" para ver la página
        </div>
      )}
    </div>
  )
}
