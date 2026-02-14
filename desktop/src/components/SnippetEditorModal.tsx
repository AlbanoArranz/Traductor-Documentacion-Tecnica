import { useEffect, useMemo, useState, useRef } from 'react'
import { X, Eye, Undo2, AlertTriangle, Wand2, Droplet } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { snippetsApi } from '../lib/api'
import type { Snippet, OcrDetection, SnippetOp, SnippetOverlayElement } from '../lib/api'
import { SnippetDrawingEditor } from './SnippetDrawingEditor'

interface SnippetEditorModalProps {
  snippet: Snippet
  projectId?: string
  pageNumber?: number
  onClose: () => void
  onSaved?: (updatedSnippet: Snippet) => void
}

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
  const [previewSize, setPreviewSize] = useState({ width: snippet.width, height: snippet.height })
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
    setPreviewSize({ width: snippet.width, height: snippet.height })
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

  const handleSaveName = () => {
    const hasNameOrOps = !(name.trim() === snippet.name && queuedOps.length === 0)
    if (!hasNameOrOps && !ocrDirty && !drawDirty) {
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
    toast.success('Operación añadida. Pulsa Guardar para aplicar.')
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-2xl w-[900px] h-[600px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-xs text-gray-500">Editar snippet</p>
            <h3 className="text-lg font-semibold">{snippet.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 border-r overflow-hidden">
            <div className="p-4 h-full flex flex-col gap-3 min-h-0">
              <div>
                <label className="text-xs text-gray-500">Nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span>Versión actual: v{snippet.current_version}</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={propagateEnabled}
                    onChange={(e) => setPropagateEnabled(e.target.checked)}
                  />
                  Propagar en canvas (página actual)
                </label>
              </div>

              <div className="relative flex-1 min-h-0 border rounded bg-gray-50 overflow-auto">
                {isPreviewRefreshing && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-gray-500 text-sm">
                    Actualizando...
                  </div>
                )}
                <div className="w-full h-full flex items-center justify-center">
                  <div
                    className="relative"
                    style={{
                      width: previewSize.width,
                      height: previewSize.height,
                    }}
                  >
                    <img
                      ref={imgRef}
                      src={imageUrl}
                      alt={snippet.name}
                      className="block w-full h-full object-contain"
                      onLoad={() => {
                        if (imgRef.current) {
                          setPreviewSize({
                            width: imgRef.current.clientWidth,
                            height: imgRef.current.clientHeight,
                          })
                        }
                      }}
                    />
                    <SnippetDrawingEditor
                      imageWidth={snippet.width}
                      imageHeight={snippet.height}
                      scale={previewSize.width / Math.max(snippet.width, 1)}
                      elements={overlayElements}
                      onChange={(elements) => {
                        setOverlayElements(elements)
                        setDrawDirty(true)
                      }}
                    />
                    {ocrDraft.length > 0 && (
                      <div className="absolute inset-0 pointer-events-none">
                        {ocrDraft.map((det, idx) => {
                          const [x1, y1, x2, y2] = det.bbox
                          const left = (x1 / snippet.width) * 100
                          const top = (y1 / snippet.height) * 100
                          const width = ((x2 - x1) / snippet.width) * 100
                          const height = ((y2 - y1) / snippet.height) * 100
                          const fontScale = previewSize.height / snippet.height
                          const pxFontSize = Math.max(8, Math.round((y2 - y1) * fontScale * 0.5))
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
                              <span className="text-blue-900 font-medium truncate px-1" title={det.text}>
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

              {detectedRegions.length > 0 && (
                <div className="text-xs text-gray-600">
                  {detectedRegions.length} regiones detectadas. Borra texto para aplicar cambios.
                </div>
              )}
            </div>
          </div>

          <div className="w-80 flex flex-col">
            <div className="p-4 border-b space-y-3">
              <h4 className="text-sm font-semibold">Acciones</h4>
              <button
                className="w-full px-3 py-2 text-sm border rounded flex items-center gap-2 hover:bg-gray-50"
                onClick={() => queueOp({ type: 'remove_bg' })}
              >
                <Droplet size={16} /> Quitar fondo blanco (cola)
              </button>
              <button
                className="w-full px-3 py-2 text-sm border rounded flex items-center gap-2 hover:bg-gray-50"
                onClick={() => detectMutation.mutate()}
                disabled={detectMutation.isPending}
              >
                <Eye size={16} /> {detectMutation.isPending ? 'Detectando...' : 'Detectar texto'}
              </button>
              <button
                className="w-full px-3 py-2 text-sm border rounded flex items-center gap-2 hover:bg-gray-50"
                onClick={() => removeTextMutation.mutate()}
                disabled={removeTextMutation.isPending || detectedRegions.length === 0}
              >
                <Wand2 size={16} /> {removeTextMutation.isPending ? 'Aplicando...' : 'Borrar texto detectado'}
              </button>
              <button
                className="w-full px-3 py-2 text-sm border rounded flex items-center gap-2 hover:bg-gray-50"
                onClick={() => qaMutation.mutate()}
                disabled={qaMutation.isPending}
              >
                <AlertTriangle size={16} /> QA validate
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">OCR</h4>
                  <button
                    className="text-xs border rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                    onClick={handleSaveOnlyOcr}
                    disabled={!ocrDirty || applyOpsMutation.isPending}
                  >
                    {applyOpsMutation.isPending ? 'Guardando OCR...' : 'Guardar OCR'}
                  </button>
                </div>
                {ocrDraft.length === 0 ? (
                  <p className="text-xs text-gray-500">Sin detecciones OCR para editar.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {ocrDraft.map((det, idx) => (
                      <div key={idx} className="border rounded p-2">
                        <p className="text-[10px] text-gray-500 mb-1">
                          bbox: [{det.bbox.map((v) => Math.round(v)).join(', ')}]
                        </p>
                        <input
                          value={det.text}
                          onChange={(e) => {
                            const next = [...ocrDraft]
                            next[idx] = { ...next[idx], text: e.target.value }
                            setOcrDraft(next)
                            setDetectedRegions(next)
                            setOcrDirty(true)
                          }}
                          className="w-full border rounded px-2 py-1 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Historial</h4>
                {metaQuery.isLoading && <p className="text-xs text-gray-500">Cargando...</p>}
                {metaQuery.data?.versions?.length ? (
                  <div className="space-y-2 text-xs">
                    {metaQuery.data.versions
                      .slice()
                      .sort((a, b) => b.version - a.version)
                      .map((version) => (
                        <div key={version.version} className="border rounded px-2 py-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">v{version.version}</span>
                            <button
                              className="text-primary-600 hover:underline"
                              onClick={() => restoreMutation.mutate(version.version)}
                              disabled={restoreMutation.isPending}
                            >
                              <Undo2 size={14} />
                            </button>
                          </div>
                          <p className="text-gray-500">{new Date(version.created_at).toLocaleString()}</p>
                          {version.comment && <p className="text-gray-600">{version.comment}</p>}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Sin versiones previas.</p>
                )}
              </div>

              {queuedOps.length > 0 && (
                <div className="text-xs text-gray-600 bg-primary-50 border border-primary-100 rounded px-2 py-1">
                  {queuedOps.length} operación(es) pendiente(s) • Guarda para aplicar.
                </div>
              )}
              {drawDirty && (
                <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded px-2 py-1">
                  {overlayElements.length} anotación(es) de dibujo pendiente(s) • Guarda para aplicar.
                </div>
              )}
            </div>

            <div className="p-4 border-t flex gap-2">
              <button
                className="flex-1 border rounded px-3 py-2 text-sm hover:bg-gray-50"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                className="flex-1 bg-primary-600 text-white rounded px-3 py-2 text-sm hover:bg-primary-700 disabled:opacity-50"
                onClick={handleSaveName}
                disabled={applyOpsMutation.isPending}
              >
                {applyOpsMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
