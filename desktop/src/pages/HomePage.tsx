import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, FolderOpen, Upload } from 'lucide-react'
import { projectsApi } from '../lib/api'

export default function HomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<'schematic' | 'manual'>('schematic')
  const [pdfRotation, setPdfRotation] = useState(0)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then(res => res.data),
  })

  const createMutation = useMutation({
    mutationFn: ({ name, file, docType, rotation }: { name: string; file: File; docType: 'schematic' | 'manual'; rotation: number }) =>
      projectsApi.create(name, file, docType, rotation),
    onSuccess: (res) => {
      console.log('Project created:', res.data)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setIsCreating(false)
      setNewProjectName('')
      setSelectedFile(null)
      setDocumentType('schematic')
      setPdfRotation(0)
      setShowPreviewModal(false)
      setPreviewUrl(null)
      setPreviewError(null)
      navigate(`/project/${res.data.id}`)
    },
    onError: (error: any) => {
      console.error('Error creating project:', error)
      console.error('Error response:', error?.response?.data)
      console.error('Error message:', error?.message)
      alert(`Error al crear el proyecto: ${error?.response?.data?.detail || error?.message || 'Unknown error'}`)
    },
  })

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    const refreshPreview = async () => {
      if (!selectedFile || !showPreviewModal) return
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const res = await projectsApi.preview(selectedFile, pdfRotation, 150)
        const url = URL.createObjectURL(res.data)
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      } catch (e: any) {
        console.error('Error generating PDF preview:', e)
        if (!e?.response) {
          setPreviewError(
            'No se puede conectar al backend (http://127.0.0.1:8000). Asegúrate de que esté en ejecución.'
          )
        } else {
          setPreviewError(e?.message || 'Error generando previsualización')
        }
      } finally {
        setPreviewLoading(false)
      }
    }

    refreshPreview()
  }, [selectedFile, pdfRotation, showPreviewModal])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (error: any) => {
      console.error('Error deleting project:', error)
      alert(`Error al eliminar el proyecto: ${error?.response?.data?.detail || error?.message || 'Unknown error'}`)
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPdfRotation(0)
      setShowPreviewModal(true)
      if (!newProjectName) {
        setNewProjectName(file.name.replace('.pdf', ''))
      }
    }
  }

  const handleCreate = () => {
    console.log('handleCreate called', { newProjectName, selectedFile, documentType })
    if (newProjectName && selectedFile) {
      console.log('Calling mutation...')
      createMutation.mutate({ name: newProjectName, file: selectedFile, docType: documentType, rotation: pdfRotation })
    } else {
      console.log('Missing name or file')
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">NB7X Translator</h1>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={20} />
            Nuevo Proyecto
          </button>
        </div>

        {/* Create project dialog */}
        {isCreating && (
          <div className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Crear nuevo proyecto</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del proyecto
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Mi proyecto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de documento
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="documentType"
                      value="schematic"
                      checked={documentType === 'schematic'}
                      onChange={(e) => setDocumentType(e.target.value as 'schematic' | 'manual')}
                      className="w-4 h-4 text-primary-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800">Esquema eléctrico</div>
                      <div className="text-xs text-gray-500">Texto disperso, cajas individuales</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="documentType"
                      value="manual"
                      checked={documentType === 'manual'}
                      onChange={(e) => setDocumentType(e.target.value as 'schematic' | 'manual')}
                      className="w-4 h-4 text-primary-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800">Manual técnico</div>
                      <div className="text-xs text-gray-500">Párrafos, texto corrido</div>
                    </div>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Archivo PDF
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Upload size={20} />
                  {selectedFile ? selectedFile.name : 'Seleccionar PDF'}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newProjectName || !selectedFile || createMutation.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear'}
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false)
                    setNewProjectName('')
                    setSelectedFile(null)
                    setPdfRotation(0)
                    setShowPreviewModal(false)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {isCreating && showPreviewModal && selectedFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="font-medium">Previsualización y rotación del PDF</div>
                <button
                  onClick={() => {
                    setShowPreviewModal(false)
                  }}
                  className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-sm text-gray-600 truncate">{selectedFile.name}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPdfRotation((prev) => (prev + 270) % 360)}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                      title="Rotar -90°"
                    >
                      ↺ -90°
                    </button>
                    <button
                      onClick={() => setPdfRotation((prev) => (prev + 90) % 360)}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                      title="Rotar +90°"
                    >
                      ↻ +90°
                    </button>
                    <div className="text-sm font-medium w-16 text-center">{pdfRotation}°</div>
                  </div>
                </div>

                <div className="bg-gray-100 rounded border flex items-center justify-center min-h-[320px]">
                  {previewLoading ? (
                    <div className="text-sm text-gray-500">Generando previsualización...</div>
                  ) : previewError ? (
                    <div className="text-sm text-red-600 px-4">{previewError}</div>
                  ) : previewUrl ? (
                    <img
                      src={previewUrl}
                      className="max-w-full max-h-[70vh] shadow"
                      alt="Previsualización PDF"
                      onError={() => setPreviewError('No se pudo cargar la imagen de previsualización')}
                    />
                  ) : (
                    <div className="text-sm text-gray-500">Sin previsualización</div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setShowPreviewModal(false)
                      setSelectedFile(null)
                      setPdfRotation(0)
                      setPreviewUrl(null)
                      setPreviewError(null)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={createMutation.isPending}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setShowPreviewModal(false)
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    disabled={createMutation.isPending}
                    title="Confirmar rotación y volver al formulario"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projects list */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Cargando proyectos...</div>
        ) : projects?.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No hay proyectos todavía</p>
            <p className="text-sm text-gray-400">Crea uno nuevo para empezar</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects?.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-primary-300 transition-colors cursor-pointer"
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <div>
                  <h3 className="font-medium text-gray-800">{project.name}</h3>
                  <p className="text-sm text-gray-500">
                    {project.page_count} páginas · {project.status}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('¿Eliminar este proyecto?')) {
                      deleteMutation.mutate(project.id)
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
