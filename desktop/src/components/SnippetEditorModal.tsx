import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { snippetsApi } from '../lib/api'
import type { Snippet, OcrDetection, SnippetOp, SnippetOverlayElement } from '../lib/api'
import { SnippetToolbar } from './SnippetToolbar'
import { SnippetInspector } from './SnippetInspector'
import { SnippetDrawingEditor } from './SnippetDrawingEditor'
import { SnippetCropOverlay } from './SnippetCropOverlay'
import type { DrawingTool } from './DrawingCanvas'

interface SnippetEditorModalProps {
  snippet: Snippet
  projectId?: string
  pageNumber?: number
  onClose: () => void
  onSaved?: (updatedSnippet: Snippet) => void
}

const ZOOM_LEVELS = [25, 50, 75, 100, 150, 200, 300, 400]
const DEFAULT_ZOOM = 100

export function SnippetEditorModal({ snippet, projectId, pageNumber, onClose, onSaved }: SnippetEditorModalProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(snippet.name)
  const [queuedOps, setQueuedOps] = useState<SnippetOp[]>([])
  const [detectedRegions, setDetectedRegions] = useState<OcrDetection[]>([])
  const [ocrDraft, setOcrDraft] = useState<OcrDetection[]>(snippet.ocr_detections || [])
  const [ocrDirty, setOcrDirty] = useState(false)
  const [overlayElements, setOverlayElements] = useState<SnippetOverlayElement[]>([])
  const [drawDirty, setDrawDirty] = useState(false)
  const [propagateEnabled, setPropagateEnabled] = useState(false)
  const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [tool, setTool] = useState<DrawingTool>('select')
  const [strokeColor, setStrokeColor] = useState('#ff0000')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [fillColor, setFillColor] = useState<string | null>(null)
  const [isCropMode, setIsCropMode] = useState(false)
  const [ocrTypography, setOcrTypography] = useState({ fontSize: 100, fontFamily: 'Arial' })
  const [eraserRadius, setEraserRadius] = useState(20)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const metaQuery = useQuery({
    queryKey: ['snippet-meta', snippet.id],
    queryFn: () => snippetsApi.getMeta(snippet.id).then(res => res.data),
  })

  const reloadSnippetList = () => {
    queryClient.invalidateQueries({ queryKey: ['snippets'] })
  }

  const imageUrl = useMemo(() => {
    const bust = Date.now()
    return snippetsApi.getImageUrl(snippet.id) + `&t=${bust}`
  }, [snippet.id, snippet.current_version])

  const applyOpsMutation = useMutation({
    mutationFn: (payload: { name?: string; ops?: SnippetOp[]; comment?: string }) =>
      snippetsApi.update(snippet.id, {
        ...payload,
        propagate: propagateEnabled
          ? { enabled: true, scope: 'current_page', project_id: projectId, page_number: pageNumber }
          : undefined,
      }),
    onSuccess: (res) => {
      toast.success('Snippet actualizado')
      if ((res.data.updated_count || 0) > 0) {
        toast.success(`Propagado en ${res.data.updated_count} instancia(s) del canvas`)
      }
      reloadSnippetList()
      queryClient.invalidateQueries({ queryKey: ['snippet-meta', snippet.id] })
      setDetectedRegions([])
      setQueuedOps([])
      setOcrDirty(false)
      setDrawDirty(false)
      setOverlayElements([])
      setIsPreviewRefreshing(true)
      setTimeout(() => setIsPreviewRefreshing(false), 400)
      setName(res.data.name)
      onSaved?.(res.data)
    },
    onError: () => toast.error('Error al actualizar snippet'),
  })

  const restoreMutation = useMutation({
    mutationFn: (targetVersion: number) =>
      snippetsApi.restoreVersion(snippet.id, targetVersion, `Restore to v${targetVersion}`),
    onSuccess: (res) => {
      toast.success('Versión restaurada')
      reloadSnippetList()
      queryClient.invalidateQueries({ queryKey: ['snippet-meta', snippet.id] })
      setIsPreviewRefreshing(true)
      setTimeout(() => setIsPreviewRefreshing(false), 400)
      setName(res.data.name)
      onSaved?.(res.data)
    },
    onError: () => toast.error('Error al restaurar versión'),
  })

  const detectMutation = useMutation({
    mutationFn: () => snippetsApi.detectOcr(snippet.id),
    onSuccess: (res) => {
      toast.success(`Detectados ${res.data.detections.length} textos`)
      setDetectedRegions(res.data.detections)
      setOcrDraft(res.data.detections)
      setOcrDirty(true)
    },
    onError: () => toast.error('Error al detectar texto'),
  })

  const removeTextMutation = useMutation({
    mutationFn: () =>
      snippetsApi.removeText(snippet.id, {
        regions: ocrDraft,
      }),
    onSuccess: (res) => {
      toast.success('Texto eliminado')
      reloadSnippetList()
      queryClient.invalidateQueries({ queryKey: ['snippet-meta', snippet.id] })
      setDetectedRegions([])
      setOcrDraft([])
      setOcrDirty(false)
      onSaved?.(res.data)
    },
    onError: () => toast.error('No se pudo borrar texto'),
  })

  const qaMutation = useMutation({
    mutationFn: () => snippetsApi.qaValidate(snippet.id),
    onSuccess: (res) => {
      if (res.data.passed) {
        toast.success('QA OK')
      } else {
        toast.error('QA falló, revisa el snippet')
      }
    },
    onError: () => toast.error('QA no disponible'),
  })

  useEffect(() => {
    setName(snippet.name)
    setDetectedRegions(snippet.ocr_detections || [])
    setOcrDraft(snippet.ocr_detections || [])
    setOcrDirty(false)
    setDrawDirty(false)
    setOverlayElements([])
    setZoom(DEFAULT_ZOOM)
    setIsCropMode(false)
    setOcrTypography({ fontSize: 100, fontFamily: 'Arial' })
  }, [snippet.id, snippet.name])

  useEffect(() => {
    if (!ocrDirty && metaQuery.data?.ocr_detections) {
      setDetectedRegions(metaQuery.data.ocr_detections)
      setOcrDraft(metaQuery.data.ocr_detections)
    }
  }, [metaQuery.data?.ocr_detections, ocrDirty])

  const buildPendingOps = (): SnippetOp[] => {
    const ops: SnippetOp[] = [...queuedOps]
    if (ocrDirty) {
      ops.push({
        type: 'ocr_replace_text',
        payload: { regions: ocrDraft, shrink_px: 2 },
      })
    }
    if (drawDirty && overlayElements.length > 0) {
      ops.push({
        type: 'draw_overlay',
        payload: { elements: overlayElements },
      })
    }
    return ops
  }

  const applyPendingChanges = () => {
    applyOpsMutation.mutate({
      name: name.trim() || snippet.name,
      ops: buildPendingOps(),
      comment: 'Manual edit',
    })
  }

  const handleSave = () => {
    const hasChanges = !(name.trim() === snippet.name && queuedOps.length === 0) || ocrDirty || drawDirty
    if (!hasChanges) {
      onClose()
      return
    }
    applyPendingChanges()
  }

  const handleSaveOnlyOcr = () => {
    applyOpsMutation.mutate({
      name: snippet.name,
      ops: [{ type: 'ocr_replace_text', payload: { regions: ocrDraft, shrink_px: 2 } }],
      comment: 'OCR replace text',
    })
  }

  const queueOp = (op: SnippetOp) => {
    setQueuedOps((prev) => [...prev, op])
    toast.success('Operación añadida')
  }

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => {
      const idx = ZOOM_LEVELS.findIndex((z) => z >= prev)
      return ZOOM_LEVELS[Math.min(idx + 1, ZOOM_LEVELS.length - 1)]
    })
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const idx = ZOOM_LEVELS.findIndex((z) => z >= prev)
      return ZOOM_LEVELS[Math.max(idx - 1, 0)]
    })
  }, [])

  const handleZoomFit = useCallback(() => {
    if (!containerRef.current) return
    const containerW = containerRef.current.clientWidth - 32
    const containerH = containerRef.current.clientHeight - 32
    const scaleX = (containerW / snippet.width) * 100
    const scaleY = (containerH / snippet.height) * 100
    setZoom(Math.min(scaleX, scaleY, 100))
  }, [snippet.width, snippet.height])

  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.altKey) {
      e.preventDefault()
      if (e.deltaY < 0) {
        handleZoomIn()
      } else {
        handleZoomOut()
      }
    }
  }, [handleZoomIn, handleZoomOut])

  const handleDoubleClickZoom = useCallback(() => {
    setZoom((prev) => (prev === 100 ? DEFAULT_ZOOM : 100))
  }, [])

  const handleCropModeToggle = () => {
    setIsCropMode((prev) => !prev)
    if (!isCropMode) {
      setTool('select')
    }
  }

  const scaledWidth = (snippet.width * zoom) / 100
  const scaledHeight = (snippet.height * zoom) / 100

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-2xl w-[1100px] h-[700px] flex flex-col max-w-[95vw] max-h-[95vh]">
        {/* Header compacto */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 rounded-t-lg">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-gray-800">{snippet.name}</h3>
            <span className="text-xs text-gray-500">v{snippet.current_version}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={propagateEnabled}
                onChange={(e) => setPropagateEnabled(e.target.checked)}
                className="cursor-pointer"
              />
              Propagar
            </label>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-200">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Panel izquierdo: toolbar + zoom + canvas */}
          <div className="flex-1 flex flex-col border-r overflow-hidden">
            {/* Toolbar */}
            <SnippetToolbar
              tool={tool}
              onToolChange={setTool}
              strokeColor={strokeColor}
              onStrokeColorChange={setStrokeColor}
              strokeWidth={strokeWidth}
              onStrokeWidthChange={setStrokeWidth}
              fillColor={fillColor}
              onFillColorChange={setFillColor}
              onCropModeToggle={handleCropModeToggle}
              isCropMode={isCropMode}
              eraserRadius={eraserRadius}
              onEraserRadiusChange={setEraserRadius}
            />

            {/* Zoom controls */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border-b text-xs">
              <button
                onClick={handleZoomOut}
                className="p-1 rounded hover:bg-gray-200"
                title="Alejar (Ctrl -)"
              >
                <ZoomOut size={14} />
              </button>
              <span className="w-12 text-center font-medium">{zoom}%</span>
              <button
                onClick={handleZoomIn}
                className="p-1 rounded hover:bg-gray-200"
                title="Acercar (Ctrl +)"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={handleZoomFit}
                className="p-1 rounded hover:bg-gray-200 ml-1"
                title="Ajustar"
              >
                <Maximize size={14} />
              </button>
              <span className="text-gray-400 ml-2">{snippet.width}×{snippet.height}px</span>
            </div>

            {/* Canvas area */}
            <div
              ref={containerRef}
              className="flex-1 overflow-auto bg-gray-200 p-4"
              onWheel={handleWheelZoom}
            >
              {isPreviewRefreshing && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-gray-500 text-sm z-10">
                  Actualizando...
                </div>
              )}
              <div
                className="relative mx-auto bg-white shadow-md"
                style={{
                  width: scaledWidth,
                  height: scaledHeight,
                }}
                onDoubleClick={handleDoubleClickZoom}
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt={snippet.name}
                  className="block w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
                <SnippetDrawingEditor
                  imageWidth={snippet.width}
                  imageHeight={snippet.height}
                  scale={zoom / 100}
                  elements={overlayElements}
                  onChange={(elements) => {
                    setOverlayElements(elements)
                    setDrawDirty(true)
                  }}
                  tool={tool}
                  strokeColor={strokeColor}
                  strokeWidth={strokeWidth}
                  fillColor={fillColor}
                  eraserRadius={eraserRadius}
                  onEraseRect={(rect) => {
                    queueOp({
                      type: 'erase_region',
                      payload: { rect, fill_color: '#ffffff' },
                    })
                  }}
                  onEraseCircle={(circle) => {
                    queueOp({
                      type: 'erase_region',
                      payload: { circle, fill_color: '#ffffff' },
                    })
                  }}
                />
                <SnippetCropOverlay
                  imageWidth={snippet.width}
                  imageHeight={snippet.height}
                  scale={zoom / 100}
                  isActive={isCropMode}
                  onCrop={(region) => {
                    // Añadir operación de copia de región
                    queueOp({
                      type: 'crop_copy',
                      payload: {
                        src_rect: region,
                        dst_rect: region,
                      },
                    })
                  }}
                  onCancel={() => setIsCropMode(false)}
                />
                {ocrDraft.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {ocrDraft.map((det, idx) => {
                      const [x1, y1, x2, y2] = det.bbox
                      const left = (x1 / snippet.width) * 100
                      const top = (y1 / snippet.height) * 100
                      const width = ((x2 - x1) / snippet.width) * 100
                      const height = ((y2 - y1) / snippet.height) * 100
                      const pxFontSize = Math.max(8, Math.round((y2 - y1) * (zoom / 100) * 0.5))
                      return (
                        <div
                          key={`${idx}-${x1}-${y1}`}
                          className="absolute flex items-center justify-center border border-blue-400/70 bg-white/60 rounded-sm"
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                            fontSize: `${pxFontSize}px`,
                          }}
                        >
                          <span
                            className="font-medium truncate px-1"
                            style={{ color: det.text_color || '#1e3a8a' }}
                            title={det.text}
                          >
                            {det.text}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panel derecho: Inspector con tabs */}
          <div className="w-72 flex flex-col bg-gray-50">
            <SnippetInspector
              snippetName={snippet.name}
              currentVersion={snippet.current_version}
              meta={metaQuery.data}
              metaLoading={metaQuery.isLoading}
              ocrDraft={ocrDraft}
              onOcrDraftChange={(draft) => {
                setOcrDraft(draft)
                setDetectedRegions(draft)
                setOcrDirty(true)
              }}
              ocrDirty={ocrDirty}
              queuedOps={queuedOps}
              drawDirty={drawDirty}
              overlayCount={overlayElements.length}
              onRemoveBg={() => queueOp({ type: 'remove_bg' })}
              onDetectOcr={() => detectMutation.mutate()}
              onRemoveText={() => removeTextMutation.mutate()}
              onQaValidate={() => qaMutation.mutate()}
              onRestoreVersion={(v) => restoreMutation.mutate(v)}
              onSaveOcr={handleSaveOnlyOcr}
              detectPending={detectMutation.isPending}
              removeTextPending={removeTextMutation.isPending}
              qaPending={qaMutation.isPending}
              restorePending={restoreMutation.isPending}
              saveOcrPending={applyOpsMutation.isPending}
              hasDetectedRegions={detectedRegions.length > 0}
              ocrTypography={ocrTypography}
              onOcrTypographyChange={setOcrTypography}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-t bg-gray-50 rounded-b-lg">
          <button
            className="px-4 py-1.5 text-sm border rounded hover:bg-gray-100"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
            onClick={handleSave}
            disabled={applyOpsMutation.isPending}
          >
            {applyOpsMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}