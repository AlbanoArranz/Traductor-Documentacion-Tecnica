import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Save, Wand2 } from 'lucide-react'
import { projectsApi, glossaryApi, GlossaryEntry } from '../lib/api'

export default function GlossaryPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const [entries, setEntries] = useState<GlossaryEntry[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!).then(res => res.data),
    enabled: !!projectId,
  })

  const { data: glossaryData, isLoading } = useQuery({
    queryKey: ['glossary', projectId],
    queryFn: () => glossaryApi.get(projectId!).then(res => res.data),
    enabled: !!projectId,
  })

  useEffect(() => {
    if (glossaryData?.entries && !hasChanges) {
      setEntries(glossaryData.entries)
    }
  }, [glossaryData, hasChanges])

  const saveMutation = useMutation({
    mutationFn: () => glossaryApi.update(projectId!, entries),
    onSuccess: () => {
      setHasChanges(false)
      queryClient.invalidateQueries({ queryKey: ['glossary', projectId] })
    },
  })

  const applyMutation = useMutation({
    mutationFn: () => glossaryApi.apply(projectId!),
    onSuccess: (res) => {
      alert(`Se actualizaron ${res.data.updated_count} regiones`)
    },
  })

  const addEntry = () => {
    setEntries([...entries, { src_term: '', tgt_term: '', locked: false }])
    setHasChanges(true)
  }

  const updateEntry = (index: number, field: keyof GlossaryEntry, value: string | boolean) => {
    const newEntries = [...entries]
    newEntries[index] = { ...newEntries[index], [field]: value }
    setEntries(newEntries)
    setHasChanges(true)
  }

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Link to={`/project/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-semibold">Glosario - {project?.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Wand2 size={18} />
            Aplicar a regiones
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Save size={18} />
            Guardar
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Define traducciones consistentes para términos específicos.
              Los términos bloqueados tendrán prioridad sobre la traducción automática.
            </p>
            <button
              onClick={addEntry}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Plus size={18} />
              Añadir
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Cargando glosario...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay entradas en el glosario
            </div>
          ) : (
            <div className="bg-white rounded-lg border divide-y">
              {/* Header */}
              <div className="grid grid-cols-[1fr_1fr_80px_40px] gap-4 px-4 py-2 bg-gray-50 text-sm font-medium text-gray-600">
                <div>Chino (ZH)</div>
                <div>Español (ES)</div>
                <div>Bloquear</div>
                <div></div>
              </div>
              {/* Entries */}
              {entries.map((entry, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_80px_40px] gap-4 px-4 py-2 items-center">
                  <input
                    type="text"
                    value={entry.src_term}
                    onChange={(e) => updateEntry(index, 'src_term', e.target.value)}
                    placeholder="Término chino"
                    className="px-2 py-1 border rounded focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="text"
                    value={entry.tgt_term}
                    onChange={(e) => updateEntry(index, 'tgt_term', e.target.value)}
                    placeholder="Traducción"
                    className="px-2 py-1 border rounded focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={entry.locked}
                      onChange={(e) => updateEntry(index, 'locked', e.target.checked)}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                  </div>
                  <button
                    onClick={() => removeEntry(index)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
