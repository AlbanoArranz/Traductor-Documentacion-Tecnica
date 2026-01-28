import { useState, useRef } from 'react'
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

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then(res => res.data),
  })

  const createMutation = useMutation({
    mutationFn: ({ name, file }: { name: string; file: File }) =>
      projectsApi.create(name, file),
    onSuccess: (res) => {
      console.log('Project created:', res.data)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setIsCreating(false)
      setNewProjectName('')
      setSelectedFile(null)
      navigate(`/project/${res.data.id}`)
    },
    onError: (error: any) => {
      console.error('Error creating project:', error)
      console.error('Error response:', error?.response?.data)
      console.error('Error message:', error?.message)
      alert(`Error al crear el proyecto: ${error?.response?.data?.detail || error?.message || 'Unknown error'}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      if (!newProjectName) {
        setNewProjectName(file.name.replace('.pdf', ''))
      }
    }
  }

  const handleCreate = () => {
    console.log('handleCreate called', { newProjectName, selectedFile })
    if (newProjectName && selectedFile) {
      console.log('Calling mutation...')
      createMutation.mutate({ name: newProjectName, file: selectedFile })
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
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
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
