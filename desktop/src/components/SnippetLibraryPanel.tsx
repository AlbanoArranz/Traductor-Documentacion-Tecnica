import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Upload, Scissors, ImageIcon } from 'lucide-react'
import { snippetsApi } from '../lib/api'
import type { Snippet } from '../lib/api'
import toast from 'react-hot-toast'

interface SnippetLibraryPanelProps {
  onSnippetSelect: (snippetId: string, transparent: boolean) => void
  onCaptureStart: () => void
  onSnippetEdit: (snippet: Snippet) => void
}

export function SnippetLibraryPanel({ onSnippetSelect, onCaptureStart, onSnippetEdit }: SnippetLibraryPanelProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadRemoveBg, setUploadRemoveBg] = useState(false)

  const { data: snippets, isLoading } = useQuery({
    queryKey: ['snippets'],
    queryFn: () => snippetsApi.list().then(res => res.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => snippetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snippets'] })
      toast.success('Snippet eliminado')
    },
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, name, removeBg }: { file: File; name: string; removeBg: boolean }) =>
      snippetsApi.upload(file, name, removeBg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snippets'] })
      toast.success('Imagen añadida a la librería')
    },
    onError: () => {
      toast.error('Error al subir imagen')
    },
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const name = file.name.replace(/\.[^.]+$/, '')
    uploadMutation.mutate({ file, name, removeBg: uploadRemoveBg })
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon size={16} className="text-primary-600" />
          <h2 className="font-medium text-sm">Librería de imágenes</h2>
        </div>
        <p className="text-xs text-gray-500">
          {snippets?.length || 0} imágenes guardadas
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading && (
          <div className="text-center text-xs text-gray-400 py-8">Cargando...</div>
        )}
        {!isLoading && (!snippets || snippets.length === 0) && (
          <div className="text-center text-xs text-gray-400 py-8">
            No hay imágenes guardadas.<br />
            Captura una zona o sube una imagen.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {snippets?.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              onSelect={onSnippetSelect}
              onDelete={(id) => deleteMutation.mutate(id)}
              onEdit={onSnippetEdit}
            />
          ))}
        </div>
      </div>

      <div className="p-3 border-t bg-gray-50 space-y-2">
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={uploadRemoveBg}
            onChange={(e) => setUploadRemoveBg(e.target.checked)}
          />
          Quitar fondo blanco al subir
        </label>
        <div className="flex gap-2">
          <button
            onClick={onCaptureStart}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border rounded hover:bg-gray-100"
          >
            <Scissors size={14} />
            Capturar
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            <Upload size={14} />
            {uploadMutation.isPending ? 'Subiendo...' : 'Subir imagen'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
    </div>
  )
}

function SnippetCard({
  snippet,
  onSelect,
  onDelete,
  onEdit,
}: {
  snippet: Snippet
  onSelect: (id: string, transparent: boolean) => void
  onDelete: (id: string) => void
  onEdit: (snippet: Snippet) => void
}) {
  const [useTransparent, setUseTransparent] = useState(false)
  const imageUrl = snippetsApi.getImageUrl(snippet.id, useTransparent)
  const detections = snippet.ocr_detections || []

  return (
    <div className="group relative border rounded overflow-hidden bg-white hover:border-primary-400 transition-colors">
      <div
        className="aspect-square bg-gray-50 flex items-center justify-center cursor-pointer overflow-hidden"
        onClick={() => onSelect(snippet.id, useTransparent)}
        onDoubleClick={(e) => {
          e.preventDefault()
          onEdit(snippet)
        }}
        title={`Clic para insertar: ${snippet.name}`}
        style={useTransparent ? { backgroundImage: 'linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%), linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0, 4px 4px' } : undefined}
      >
        <div className="relative inline-block max-w-full max-h-full">
          <img
            src={imageUrl}
            alt={snippet.name}
            className="block max-w-full max-h-full"
            draggable={false}
          />
        </div>
      </div>
      <div className="px-1.5 py-1 text-[10px] text-gray-600 truncate">
        {snippet.name}
        {detections.length > 0 && (
          <span className="ml-1 text-blue-500" title={`${detections.length} textos detectados`}>
            ({detections.length})
          </span>
        )}
      </div>
      {snippet.has_transparent && (
        <label
          className="absolute top-1 left-1 flex items-center gap-0.5 bg-white/80 rounded px-1 py-0.5 text-[9px] text-gray-600"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={useTransparent}
            onChange={(e) => setUseTransparent(e.target.checked)}
            className="w-3 h-3"
          />
          Sin fondo
        </label>
      )}
      {snippet.text_erased && (
        <span className="absolute bottom-7 left-1 bg-orange-100/90 text-orange-700 rounded px-1 py-0.5 text-[9px] font-medium">
          Sin texto
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onEdit(snippet)
        }}
        className="absolute bottom-1 left-1 px-1 py-0.5 text-[9px] border rounded bg-white/80 hover:bg-white text-primary-600"
      >
        Editar
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(snippet.id)
        }}
        className="absolute top-1 right-1 p-0.5 bg-white/80 rounded opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
        title="Eliminar"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
