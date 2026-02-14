import { useEffect, useMemo, useState } from 'react'
import { X, Eye, Undo2, AlertTriangle, Wand2, Droplet } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { snippetsApi } from '../lib/api'
import type { Snippet, OcrDetection, SnippetOp } from '../lib/api'

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
  const [propagateEnabled, setPropagateEnabled] = useState(false)
  const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false)

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
    onSuccess: () => {
      toast.success('Versión restaurada')
      reloadSnippetList()
      queryClient.invalidateQueries({ queryKey: ['snippet-meta', snippet.id] })
    },
    onError: () => toast.error('Error al restaurar versión'),
  })

  const detectMutation = useMutation({
    mutationFn: () => snippetsApi.detectOcr(snippet.id),
    onSuccess: (res) => {
      toast.success(`Detectados ${res.data.detections.length} textos`)
      setDetectedRegions(res.data.detections)
    },
    onError: () => toast.error('Error al detectar texto'),
  })

  const removeTextMutation = useMutation({
    mutationFn: () =>
      snippetsApi.removeText(snippet.id, {
        regions: detectedRegions,
      }),
    onSuccess: () => {
      toast.success('Texto eliminado')
      reloadSnippetList()
      queryClient.invalidateQueries({ queryKey: ['snippet-meta', snippet.id] })
      setDetectedRegions([])
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
  }, [snippet.id, snippet.name])

  const handleSaveName = () => {
    if (name.trim() === snippet.name && queuedOps.length === 0) {
      onClose()
      return
    }
    applyOpsMutation.mutate({ name: name.trim() || snippet.name, ops: queuedOps, comment: 'Manual edit' })
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
                <img src={imageUrl} alt={snippet.name} className="block w-full h-full object-contain" />
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
