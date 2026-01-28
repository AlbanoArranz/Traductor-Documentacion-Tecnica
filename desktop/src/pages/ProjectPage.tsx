import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, Download, Book, RefreshCw, Lock, Unlock, Trash2 } from 'lucide-react'
import { projectsApi, pagesApi, jobsApi, exportApi, glossaryApi, globalGlossaryApi, TextRegion } from '../lib/api'

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const [selectedPage, setSelectedPage] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState<TextRegion | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState(0)
  const [jobStep, setJobStep] = useState('')
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [imageTimestamp, setImageTimestamp] = useState(Date.now())
  const [showTranslated, setShowTranslated] = useState(true)
  const [regionFilterField, setRegionFilterField] = useState<'src' | 'tgt'>('src')
  const [regionFilterMode, setRegionFilterMode] = useState<'contains' | 'starts' | 'ends' | 'regex'>('contains')
  const [regionFilterText, setRegionFilterText] = useState('')
  const [regionFilterCaseSensitive, setRegionFilterCaseSensitive] = useState(false)
  const [showOnlyFiltered, setShowOnlyFiltered] = useState(false)
  const [deleteScope, setDeleteScope] = useState<'page' | 'all'>('page')
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmDeleteFiltered, setConfirmDeleteFiltered] = useState(false)
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ current: number; total: number } | null>(null)
  const [addGlossaryScope, setAddGlossaryScope] = useState<'global' | 'local'>('global')

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!).then(res => res.data),
    enabled: !!projectId,
  })

  const { data: pages } = useQuery({
    queryKey: ['pages', projectId],
    queryFn: () => pagesApi.list(projectId!).then(res => res.data),
    enabled: !!projectId,
  })

  const { data: regions, refetch: refetchRegions } = useQuery({
    queryKey: ['regions', projectId, selectedPage],
    queryFn: () => pagesApi.getTextRegions(projectId!, selectedPage).then(res => res.data),
    enabled: !!projectId,
  })

  const renderMutation = useMutation({
    mutationFn: () => pagesApi.renderOriginal(projectId!, selectedPage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', projectId] })
      setImageTimestamp(Date.now())
    },
  })

  const ocrMutation = useMutation({
    mutationFn: () => pagesApi.runOcr(projectId!, selectedPage),
    onSuccess: () => {
      refetchRegions()
    },
  })

  const composeMutation = useMutation({
    mutationFn: () => pagesApi.renderTranslated(projectId!, selectedPage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', projectId] })
      setImageTimestamp(Date.now())
    },
  })

  const updateRegionMutation = useMutation({
    mutationFn: (data: { regionId: string; updates: Partial<TextRegion> }) =>
      pagesApi.updateTextRegion(projectId!, data.regionId, data.updates),
    onSuccess: () => {
      refetchRegions()
    },
    onError: (err) => {
      console.error('Error updating region:', err)
      alert('Error al actualizar la región')
    },
  })

  const deleteRegionMutation = useMutation({
    mutationFn: (regionId: string) => {
      console.log('Deleting region:', regionId)
      return pagesApi.deleteTextRegion(projectId!, regionId)
    },
    onSuccess: () => {
      console.log('Region deleted successfully')
      refetchRegions()
      setSelectedRegion(null)
    },
    onError: (err) => {
      console.error('Error deleting region:', err)
      alert('Error al eliminar la región')
    },
  })

  const processAllMutation = useMutation({
    mutationFn: () => jobsApi.startRenderAll(projectId!),
    onSuccess: (res) => {
      setJobId(res.data.id)
    },
  })

  const exportMutation = useMutation({
    mutationFn: () => exportApi.generate(projectId!),
  })

  const normalizedFilterText = regionFilterCaseSensitive
    ? regionFilterText
    : regionFilterText.toLowerCase()

  const matchesRegionFilter = (region: TextRegion) => {
    if (!normalizedFilterText.trim()) return true

    const rawValue =
      regionFilterField === 'src' ? region.src_text : (region.tgt_text || '')
    const value = regionFilterCaseSensitive ? rawValue : rawValue.toLowerCase()

    try {
      if (regionFilterMode === 'contains') return value.includes(normalizedFilterText)
      if (regionFilterMode === 'starts') return value.startsWith(normalizedFilterText)
      if (regionFilterMode === 'ends') return value.endsWith(normalizedFilterText)
      if (regionFilterMode === 'regex') {
        const re = new RegExp(regionFilterText, regionFilterCaseSensitive ? '' : 'i')
        return re.test(rawValue)
      }
      return true
    } catch {
      // Regex inválido: no filtrar nada (mostrar todo) para evitar bloquear UX
      return true
    }
  }

  const filteredRegions = (regions || []).filter(matchesRegionFilter)
  const displayedRegions = showOnlyFiltered && regionFilterText.trim() ? filteredRegions : (regions || [])

  const bulkDeleteFiltered = async () => {
    if (!projectId) return
    if (!regionFilterText.trim()) return

    setBulkDeleting(true)
    setBulkDeleteProgress(null)
    try {
      if (deleteScope === 'page') {
        const idsToDelete = filteredRegions.map((r) => r.id)
        setBulkDeleteProgress({ current: 0, total: idsToDelete.length })
        for (let i = 0; i < idsToDelete.length; i++) {
          await pagesApi.deleteTextRegion(projectId, idsToDelete[i])
          setBulkDeleteProgress({ current: i + 1, total: idsToDelete.length })
        }
        await refetchRegions()
        if (selectedRegion && idsToDelete.includes(selectedRegion.id)) {
          setSelectedRegion(null)
        }
        return
      }

      const pageNumbers = (pages || []).map((p) => p.page_number)
      setBulkDeleteProgress({ current: 0, total: pageNumbers.length })

      for (let i = 0; i < pageNumbers.length; i++) {
        const pageNum = pageNumbers[i]
        const res = await pagesApi.getTextRegions(projectId, pageNum)
        const pageRegions = res.data
        const toDelete = pageRegions.filter(matchesRegionFilter).map((r) => r.id)

        for (const id of toDelete) {
          await pagesApi.deleteTextRegion(projectId, id)
        }

        setBulkDeleteProgress({ current: i + 1, total: pageNumbers.length })
      }

      await refetchRegions()
      // Si la región seleccionada ya no existe, cerrar modal
      if (selectedRegion) {
        const stillExists = (await pagesApi.getTextRegions(projectId, selectedPage)).data.some(
          (r) => r.id === selectedRegion.id
        )
        if (!stillExists) setSelectedRegion(null)
      }
    } catch (e) {
      console.error('Error bulk deleting regions:', e)
      alert('Error al eliminar regiones filtradas')
    } finally {
      setBulkDeleting(false)
      setConfirmDeleteFiltered(false)
      setBulkDeleteProgress(null)
    }
  }

  // Poll job status
  useEffect(() => {
    if (!jobId || !projectId) return

    const interval = setInterval(async () => {
      try {
        const res = await jobsApi.getStatus(projectId, jobId)
        setJobProgress(res.data.progress)
        setJobStep(res.data.current_step || '')

        if (res.data.status === 'completed' || res.data.status === 'error') {
          setJobId(null)
          queryClient.invalidateQueries({ queryKey: ['pages', projectId] })
          if (res.data.status === 'error') {
            alert(`Error: ${res.data.error}`)
          }
        }
      } catch (e) {
        console.error('Error polling job:', e)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [jobId, projectId, queryClient])

  // Update image size when loaded
  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      })
    }
  }

  const currentPage = pages?.find(p => p.page_number === selectedPage)
  const canShowTranslated = currentPage?.has_translated
  const canShowOriginal = currentPage?.has_original
  const imageKind = (showTranslated && canShowTranslated) ? 'translated' : 'original'
  const imageUrl = (canShowOriginal || canShowTranslated)
    ? `${pagesApi.getImageUrl(projectId!, selectedPage, imageKind as 'original' | 'translated')}&t=${imageTimestamp}`
    : null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-semibold">{project?.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/project/${projectId}/glossary`}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Book size={18} />
            Glosario
          </Link>
          <button
            onClick={() => processAllMutation.mutate()}
            disabled={processAllMutation.isPending || !!jobId}
            className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Play size={18} />
            Procesar Todo
          </button>
          <button
            onClick={async () => {
              await exportMutation.mutateAsync()
              const res = await exportApi.downloadPdf(projectId!)
              const blobUrl = URL.createObjectURL(res.data)
              const a = document.createElement('a')
              a.href = blobUrl
              a.download = `${project?.name || 'export'}_translated.pdf`
              document.body.appendChild(a)
              a.click()
              a.remove()
              URL.revokeObjectURL(blobUrl)
            }}
            disabled={exportMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Download size={18} />
            Exportar PDF
          </button>
        </div>
      </header>

      {/* Job progress */}
      {jobId && (
        <div className="px-6 py-3 bg-primary-50 border-b">
          <div className="flex items-center gap-4">
            <RefreshCw size={18} className="animate-spin text-primary-600" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span>{jobStep}</span>
                <span>{Math.round(jobProgress * 100)}%</span>
              </div>
              <div className="h-2 bg-primary-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all"
                  style={{ width: `${jobProgress * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Page thumbnails */}
        <aside className="w-32 border-r bg-gray-50 overflow-y-auto p-2">
          {Array.from({ length: project?.page_count || 0 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setSelectedPage(i)}
              className={`w-full mb-2 p-1 rounded border-2 transition-colors ${
                selectedPage === i ? 'border-primary-500' : 'border-transparent hover:border-gray-300'
              }`}
            >
              <div className="aspect-[3/4] bg-gray-200 rounded flex items-center justify-center text-sm text-gray-500">
                {i + 1}
              </div>
            </button>
          ))}
        </aside>

        {/* Image viewer */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => renderMutation.mutate()}
              disabled={renderMutation.isPending}
              className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
            >
              {renderMutation.isPending ? 'Renderizando...' : 'Renderizar'}
            </button>
            <button
              onClick={() => ocrMutation.mutate()}
              disabled={ocrMutation.isPending || !currentPage?.has_original}
              className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
            >
              {ocrMutation.isPending ? 'Detectando...' : 'OCR'}
            </button>
            <button
              onClick={() => composeMutation.mutate()}
              disabled={composeMutation.isPending || !regions?.length}
              className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
            >
              {composeMutation.isPending ? 'Componiendo...' : 'Componer'}
            </button>
            {canShowOriginal && canShowTranslated && (
              <button
                onClick={() => setShowTranslated(!showTranslated)}
                className="px-3 py-1 text-sm border rounded hover:bg-white ml-4 bg-gray-100"
              >
                Ver: {showTranslated ? 'Traducida' : 'Original'}
              </button>
            )}
          </div>

          {imageUrl ? (
            <div className="relative inline-block">
              <img
                ref={imageRef}
                src={imageUrl}
                alt={`Página ${selectedPage + 1}`}
                className="max-w-full shadow-lg"
                onLoad={handleImageLoad}
              />
              {/* Overlay para regiones de texto - clickeable */}
              {regions && regions.length > 0 && imageSize.width > 0 && (
                <svg
                  className="absolute top-0 left-0"
                  style={{ width: '100%', height: '100%' }}
                  viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                  preserveAspectRatio="none"
                >
                  {regions.map((region) => {
                    const isSelected = selectedRegion?.id === region.id
                    const isHovered = hoveredRegion === region.id
                    const [x1, y1, x2, y2] = region.bbox
                    return (
                      <rect
                        key={region.id}
                        x={x1}
                        y={y1}
                        width={x2 - x1}
                        height={y2 - y1}
                        fill={isSelected ? 'rgba(59, 130, 246, 0.3)' : isHovered ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0,0,0,0.01)'}
                        stroke={isSelected ? '#2563eb' : isHovered ? '#3b82f6' : '#9ca3af'}
                        strokeWidth={isSelected ? 3 : 1}
                        className="cursor-pointer"
                        onClick={() => setSelectedRegion(region)}
                        onMouseEnter={() => setHoveredRegion(region.id)}
                        onMouseLeave={() => setHoveredRegion(null)}
                      />
                    )
                  })}
                </svg>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              Haz clic en "Renderizar" para ver la página
            </div>
          )}
        </div>

        {/* Text regions panel */}
        <aside className="w-80 border-l bg-white overflow-y-auto">
          <div className="p-4 border-b">
            <h2 className="font-medium">Regiones de texto ({regions?.length || 0})</h2>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <select
                  value={regionFilterField}
                  onChange={(e) => setRegionFilterField(e.target.value as 'src' | 'tgt')}
                  className="flex-1 px-2 py-1 border rounded"
                >
                  <option value="src">Texto ZH</option>
                  <option value="tgt">Texto ES</option>
                </select>
                <select
                  value={regionFilterMode}
                  onChange={(e) => setRegionFilterMode(e.target.value as 'contains' | 'starts' | 'ends' | 'regex')}
                  className="flex-1 px-2 py-1 border rounded"
                >
                  <option value="contains">Contiene</option>
                  <option value="starts">Empieza</option>
                  <option value="ends">Termina</option>
                  <option value="regex">Regex</option>
                </select>
              </div>
              <input
                type="text"
                value={regionFilterText}
                onChange={(e) => {
                  setRegionFilterText(e.target.value)
                  setConfirmDeleteFiltered(false)
                }}
                placeholder="Filtrar..."
                className="w-full px-2 py-1 border rounded"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={regionFilterCaseSensitive}
                    onChange={(e) => {
                      setRegionFilterCaseSensitive(e.target.checked)
                      setConfirmDeleteFiltered(false)
                    }}
                  />
                  Mayúsculas
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={showOnlyFiltered}
                    onChange={(e) => setShowOnlyFiltered(e.target.checked)}
                    disabled={!regionFilterText.trim()}
                  />
                  Ver solo filtradas
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={deleteScope === 'all'}
                  onChange={(e) => {
                    setDeleteScope(e.target.checked ? 'all' : 'page')
                    setConfirmDeleteFiltered(false)
                  }}
                />
                Aplicar a todas las páginas
              </label>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  Filtradas: {regionFilterText.trim() ? filteredRegions.length : (regions?.length || 0)}
                </span>
                <button
                  onClick={async () => {
                    if (!projectId) return
                    if (!regionFilterText.trim()) return
                    if (bulkDeleting) return

                    if (!confirmDeleteFiltered) {
                      setConfirmDeleteFiltered(true)
                      window.setTimeout(() => setConfirmDeleteFiltered(false), 5000)
                      return
                    }

                    await bulkDeleteFiltered()
                  }}
                  disabled={!regionFilterText.trim() || filteredRegions.length === 0 || bulkDeleting}
                  className={`px-2 py-1 rounded border text-xs ${
                    confirmDeleteFiltered
                      ? 'border-red-600 text-red-700 bg-red-50'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50`}
                  title={
                    confirmDeleteFiltered
                      ? 'Confirmar eliminación (5s)'
                      : 'Eliminar todas las regiones que cumplan el filtro'
                  }
                >
                  {bulkDeleting
                    ? 'Eliminando...'
                    : confirmDeleteFiltered
                      ? 'Confirmar eliminar'
                      : 'Eliminar filtradas'}
                </button>
              </div>

              {bulkDeleting && bulkDeleteProgress && (
                <div className="text-xs text-gray-500">
                  Progreso: {bulkDeleteProgress.current}/{bulkDeleteProgress.total}{' '}
                  {deleteScope === 'all' ? 'páginas' : 'regiones'}
                </div>
              )}
            </div>
          </div>
          <div className="divide-y">
            {displayedRegions?.map((region) => (
              <div
                key={region.id}
                className={`p-3 cursor-pointer hover:bg-gray-50 ${
                  selectedRegion?.id === region.id ? 'bg-primary-50' : ''
                }`}
                onClick={() => setSelectedRegion(region)}
                onMouseEnter={() => setHoveredRegion(region.id)}
                onMouseLeave={() => setHoveredRegion(null)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600 truncate">{region.src_text}</p>
                    <p className="text-sm font-medium truncate">
                      {region.tgt_text || '(sin traducir)'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      updateRegionMutation.mutate({
                        regionId: region.id,
                        updates: { locked: !region.locked },
                      })
                    }}
                    className={`p-1 rounded ${region.locked ? 'text-primary-600' : 'text-gray-400'}`}
                    title={region.locked ? 'Desbloquear' : 'Bloquear'}
                  >
                    {region.locked ? <Lock size={16} /> : <Unlock size={16} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteRegionMutation.mutate(region.id)
                    }}
                    className="p-1 rounded text-gray-400 hover:text-red-600"
                    title="Eliminar región"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Region edit modal */}
      {selectedRegion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-medium">Editar región</h3>
              <button
                onClick={() => {
                  deleteRegionMutation.mutate(selectedRegion.id)
                }}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Eliminar región"
              >
                <Trash2 size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Texto original (ZH)
                </label>
                <p className="text-gray-600 bg-gray-50 p-2 rounded">{selectedRegion.src_text}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Traducción (ES)
                </label>
                <input
                  type="text"
                  value={selectedRegion.tgt_text || ''}
                  onChange={(e) =>
                    setSelectedRegion({ ...selectedRegion, tgt_text: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tamaño de fuente (px)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="8"
                    max="72"
                    placeholder="Auto"
                    value={selectedRegion.font_size || ''}
                    onChange={(e) =>
                      setSelectedRegion({
                        ...selectedRegion,
                        font_size: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-500">Dejar vacío para auto-ajustar</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Orden de renderizado
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={selectedRegion.render_order || 0}
                    onChange={(e) =>
                      setSelectedRegion({
                        ...selectedRegion,
                        render_order: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-500">Menor = debajo, Mayor = encima</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Añadir al glosario en
                </label>
                <select
                  value={addGlossaryScope}
                  onChange={(e) => setAddGlossaryScope(e.target.value as 'global' | 'local')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="global">General (todos los documentos)</option>
                  <option value="local">Este documento</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t flex justify-between">
              <button
                onClick={async () => {
                  if (selectedRegion.src_text && selectedRegion.tgt_text) {
                    try {
                      const global = await globalGlossaryApi.get()
                      const globalEntries = global.data.entries || []
                      const existsInGlobal = globalEntries.some(e => e.src_term === selectedRegion.src_text)

                      if (addGlossaryScope === 'local' && existsInGlobal) {
                        alert('Este término ya existe en el glosario general')
                        return
                      }

                      if (addGlossaryScope === 'global') {
                        const exists = globalEntries.some(e => e.src_term === selectedRegion.src_text)
                        if (exists) {
                          alert('Este término ya existe en el glosario general')
                          return
                        }
                        globalEntries.push({
                          src_term: selectedRegion.src_text,
                          tgt_term: selectedRegion.tgt_text,
                          locked: true,
                        })
                        await globalGlossaryApi.update(globalEntries)
                        alert('✓ Añadido al glosario general')
                        return
                      }

                      const glossary = await glossaryApi.get(projectId!)
                      const entries = glossary.data.entries || []
                      const exists = entries.some(e => e.src_term === selectedRegion.src_text)
                      if (exists) {
                        alert('Este término ya existe en el glosario del documento')
                        return
                      }
                      entries.push({
                        src_term: selectedRegion.src_text,
                        tgt_term: selectedRegion.tgt_text,
                        locked: true,
                      })
                      await glossaryApi.update(projectId!, entries)
                      alert('✓ Añadido al glosario del documento')
                    } catch (err) {
                      console.error('Error al añadir al glosario:', err)
                      alert('Error al añadir al glosario')
                    }
                  }
                }}
                disabled={!selectedRegion.tgt_text}
                className="px-4 py-2 text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 disabled:opacity-50"
              >
                + Añadir al glosario
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRegion(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await updateRegionMutation.mutateAsync({
                      regionId: selectedRegion.id,
                      updates: {
                        tgt_text: selectedRegion.tgt_text,
                        font_size: selectedRegion.font_size,
                        render_order: selectedRegion.render_order,
                      },
                    })
                    setSelectedRegion(null)
                  }}
                  disabled={updateRegionMutation.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateRegionMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
