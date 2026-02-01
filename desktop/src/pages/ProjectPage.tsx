import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Book,
  Play,
  Download,
  Lock,
  Unlock,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import {
  projectsApi,
  pagesApi,
  glossaryApi,
  globalGlossaryApi,
  jobsApi,
  exportApi,
  settingsApi,
} from '../lib/api'
import type { TextRegion, OcrRegionFilter } from '../lib/api'
import { EditableTextBox } from '../components/EditableTextBox'
import { RegionPropertiesPanel } from '../components/RegionPropertiesPanel'
import { HelpMenu } from '../components/HelpMenu'

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
  const [composeAllRunning, setComposeAllRunning] = useState(false)
  const [confirmComposeAll, setConfirmComposeAll] = useState(false)
  const [composeAllProgress, setComposeAllProgress] = useState<{ current: number; total: number } | null>(null)
  
  // Estado para filtros OCR del proyecto
  const [projectOcrFilters, setProjectOcrFilters] = useState<OcrRegionFilter[]>([])
  const [showOcrFiltersPanel, setShowOcrFiltersPanel] = useState(false)

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

  // Query para filtros OCR del proyecto
  const { data: projectOcrFiltersData, refetch: refetchProjectOcrFilters } = useQuery({
    queryKey: ['project-ocr-filters', projectId],
    queryFn: () => projectsApi.getOcrFilters(projectId!).then(res => res.data),
    enabled: !!projectId,
  })

  // Mutation para actualizar filtros OCR del proyecto
  const updateProjectOcrFiltersMutation = useMutation({
    mutationFn: (filters: OcrRegionFilter[]) =>
      projectsApi.updateOcrFilters(projectId!, filters),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-ocr-filters', projectId] })
      alert('Filtros OCR guardados')
    },
    onError: (err) => {
      console.error('Error updating project OCR filters:', err)
      alert('Error al guardar filtros OCR')
    },
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
    mutationFn: () => jobsApi.startRenderAll(projectId!, 450),
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

  const composeAllPages = async () => {
    if (!projectId) return
    const total = project?.page_count || 0
    if (!total) return

    setComposeAllRunning(true)
    setComposeAllProgress({ current: 0, total })
    try {
      for (let i = 0; i < total; i++) {
        await pagesApi.renderTranslated(projectId, i)
        setComposeAllProgress({ current: i + 1, total })
      }
      queryClient.invalidateQueries({ queryKey: ['pages', projectId] })
      setImageTimestamp(Date.now())
    } catch (e) {
      console.error('Error composing all pages:', e)
      alert('Error al componer todas las páginas')
    } finally {
      setComposeAllRunning(false)
      setConfirmComposeAll(false)
      setComposeAllProgress(null)
    }
  }

  const filteredRegions = (regions || []).filter(matchesRegionFilter)
  const displayedRegions = showOnlyFiltered && regionFilterText.trim() ? filteredRegions : (regions || [])

  const persistOcrFilterFromRegionFilter = async () => {
    if (!projectId) return
    if (deleteScope !== 'all') return
    if (regionFilterField !== 'src') return
    const pattern = regionFilterText.trim()
    if (!pattern) return

    const nextFilter: OcrRegionFilter = {
      mode: regionFilterMode,
      pattern,
      case_sensitive: regionFilterCaseSensitive,
    }

    const current = await settingsApi.get()
    const currentFilters = (current.data.ocr_region_filters || []) as OcrRegionFilter[]

    const alreadyExists = currentFilters.some(
      (f) =>
        f.mode === nextFilter.mode &&
        f.pattern === nextFilter.pattern &&
        !!f.case_sensitive === !!nextFilter.case_sensitive
    )
    if (alreadyExists) return

    await settingsApi.update({ ocr_region_filters: [...currentFilters, nextFilter] })
  }

  const bulkDeleteFiltered = async () => {
    if (!projectId) return
    if (!regionFilterText.trim()) return

    setBulkDeleting(true)
    setBulkDeleteProgress(null)
    try {
      try {
        await persistOcrFilterFromRegionFilter()
      } catch (e) {
        console.warn('Could not persist OCR filter from region filter:', e)
        alert('No se pudo guardar el filtro OCR persistente. Se continuará con la eliminación.')
      }

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
          setImageTimestamp(Date.now())
          if (res.data.status === 'error') {
            alert(`Error: ${res.data.error}`)
          }
        }
      } catch (e) {
        console.error('Error polling job status:', e)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [jobId, projectId, queryClient])

  // Update image size when loaded
  const [imageScale, setImageScale] = useState(1)
  const handleImageLoad = () => {
    if (imageRef.current) {
      const naturalWidth = imageRef.current.naturalWidth
      const naturalHeight = imageRef.current.naturalHeight
      const displayWidth = imageRef.current.clientWidth
      const displayHeight = imageRef.current.clientHeight
      
      setImageSize({
        width: displayWidth,
        height: displayHeight,
      })
      setImageScale(displayWidth / naturalWidth)
    }
  }

  // Ref para evitar stale closure en keyboard handler - usar function updated para obtener estado actual
  const handleKeyDownRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  
  // Actualizar el handler cuando cambie selectedRegion o la mutación
  useEffect(() => {
    handleKeyDownRef.current = (e: KeyboardEvent) => {
      // ESC to deselect all
      if (e.key === 'Escape') {
        setSelectedRegion(null)
        return
      }

      // Delete to remove selected region
      if (e.key === 'Delete' && selectedRegion) {
        e.preventDefault()
        deleteRegionMutation.mutate(selectedRegion.id)
        setSelectedRegion(null)
        return
      }

      // Arrow keys to move selected region
      if (!selectedRegion) return
      
      const step = e.shiftKey ? 10 : 1 // Shift = move 10px, normal = 1px
      let dx = 0
      let dy = 0
      
      switch (e.key) {
        case 'ArrowUp':
          dy = -step
          break
        case 'ArrowDown':
          dy = step
          break
        case 'ArrowLeft':
          dx = -step
          break
        case 'ArrowRight':
          dx = step
          break
        default:
          return
      }
      
      e.preventDefault()
      
      const [x1, y1, x2, y2] = selectedRegion.bbox
      const newBbox = [x1 + dx, y1 + dy, x2 + dx, y2 + dy]
      
      // Actualizar UI inmediatamente (optimistic update)
      setSelectedRegion({ ...selectedRegion, bbox: newBbox })
      
      // Enviar al backend
      updateRegionMutation.mutate({
        regionId: selectedRegion.id,
        updates: { bbox: newBbox },
      })
    }
  }, [selectedRegion, updateRegionMutation, deleteRegionMutation])

  // Keyboard shortcuts: arrow keys to move selected region, ESC to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleKeyDownRef.current?.(e)
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
          <HelpMenu />
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
              onClick={() => {
                // Crear caja manual en el centro de la imagen
                // Usar tamaño fijo en coordenadas del PDF (aprox 450 DPI)
                console.log('Create box clicked - creating at center with fixed size')
                // Tamaño típico de página a 450 DPI: ~3500-5000px de ancho
                // Usar coordenadas centrales con caja de ~200x60 píxeles (tamaño razonable)
                const centerX = 2500  // Aproximadamente centro de página típica
                const centerY = 1800
                const bbox = [centerX - 100, centerY - 30, centerX + 100, centerY + 30]
                console.log('Creating text region with bbox:', bbox)
                pagesApi.createTextRegion(projectId!, selectedPage, {
                  bbox,
                  src_text: '',
                  tgt_text: 'Nuevo texto',
                }).then((res) => {
                  console.log('Text region created:', res.data)
                  refetchRegions()
                }).catch((err) => {
                  console.error('Error creating text region:', err)
                  alert('Error al crear caja: ' + (err.response?.data?.detail || err.message))
                })
              }}
              disabled={!currentPage?.has_original}
              className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
              title="Añadir caja de texto manual"
            >
              + Añadir caja
            </button>
            <button
              onClick={() => composeMutation.mutate()}
              disabled={composeMutation.isPending || !regions?.length}
              className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
            >
              {composeMutation.isPending ? 'Componiendo...' : 'Componer'}
            </button>
            <button
              onClick={async () => {
                if (composeAllRunning) return
                if (!project?.page_count) return

                if (!confirmComposeAll) {
                  setConfirmComposeAll(true)
                  window.setTimeout(() => setConfirmComposeAll(false), 5000)
                  return
                }

                await composeAllPages()
              }}
              disabled={composeAllRunning || !project?.page_count}
              className={`px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50 ${
                confirmComposeAll ? 'border-primary-600 bg-primary-50' : ''
              }`}
              title={confirmComposeAll ? 'Confirmar (5s)' : 'Componer la imagen traducida de todas las páginas'}
            >
              {composeAllRunning
                ? `Componiendo ${composeAllProgress?.current || 0}/${composeAllProgress?.total || 0}...`
                : confirmComposeAll
                  ? 'Confirmar componer todas'
                  : 'Componer todas'}
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
              {/* Overlay interactivo para regiones de texto */}
              {regions && regions.length > 0 && imageSize.width > 0 && (
                <div
                  className="absolute top-0 left-0"
                  style={{
                    width: imageSize.width,
                    height: imageSize.height,
                  }}
                >
                  {regions.map((region, index) => (
                    <EditableTextBox
                      key={region.id}
                      region={region}
                      imageSize={imageSize}
                      scale={imageScale}
                      isSelected={selectedRegion?.id === region.id}
                      index={index}
                      onSelect={() => setSelectedRegion(region)}
                      onUpdate={(updates) =>
                        updateRegionMutation.mutate({
                          regionId: region.id,
                          updates,
                        })
                      }
                      onDelete={() => deleteRegionMutation.mutate(region.id)}
                    />
                  ))}
                </div>
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
          {/* Filtros OCR del proyecto */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-sm">Filtros OCR de este proyecto</h2>
              <button
                onClick={() => setShowOcrFiltersPanel(!showOcrFiltersPanel)}
                className="text-xs text-primary-600 hover:underline"
              >
                {showOcrFiltersPanel ? 'Ocultar' : 'Editar'}
              </button>
            </div>
            {!showOcrFiltersPanel && (
              <p className="text-xs text-gray-500 mt-1">
                {projectOcrFiltersData?.ocr_region_filters?.length || 0} filtros definidos
              </p>
            )}
            {showOcrFiltersPanel && (
              <div className="mt-3 space-y-2">
                {(projectOcrFiltersData?.ocr_region_filters || []).map((f, idx) => (
                  <div key={idx} className="grid grid-cols-[90px_1fr_70px_30px] gap-1 items-center text-xs">
                    <select
                      value={f.mode}
                      onChange={(e) => {
                        const next = [...(projectOcrFiltersData?.ocr_region_filters || [])]
                        next[idx] = { ...next[idx], mode: e.target.value as OcrRegionFilter['mode'] }
                        setProjectOcrFilters(next)
                      }}
                      className="px-1 py-1 border rounded"
                    >
                      <option value="contains">Contiene</option>
                      <option value="starts">Empieza</option>
                      <option value="ends">Termina</option>
                      <option value="regex">Regex</option>
                    </select>
                    <input
                      type="text"
                      value={f.pattern}
                      onChange={(e) => {
                        const next = [...(projectOcrFiltersData?.ocr_region_filters || [])]
                        next[idx] = { ...next[idx], pattern: e.target.value }
                        setProjectOcrFilters(next)
                      }}
                      className="px-1 py-1 border rounded"
                      placeholder="Patrón"
                    />
                    <label className="flex items-center gap-1 text-gray-600">
                      <input
                        type="checkbox"
                        checked={!!f.case_sensitive}
                        onChange={(e) => {
                          const next = [...(projectOcrFiltersData?.ocr_region_filters || [])]
                          next[idx] = { ...next[idx], case_sensitive: e.target.checked }
                          setProjectOcrFilters(next)
                        }}
                      />
                      Mayús.
                    </label>
                    <button
                      onClick={() => {
                        const next = (projectOcrFiltersData?.ocr_region_filters || []).filter((_, i) => i !== idx)
                        setProjectOcrFilters(next)
                      }}
                      className="text-red-600 hover:bg-red-50 rounded"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      const next = [...(projectOcrFiltersData?.ocr_region_filters || []), { mode: 'contains' as const, pattern: '', case_sensitive: false }]
                      setProjectOcrFilters(next)
                    }}
                    className="flex-1 px-2 py-1 text-xs border rounded hover:bg-gray-100"
                  >
                    + Añadir filtro
                  </button>
                  <button
                    onClick={() => updateProjectOcrFiltersMutation.mutate(projectOcrFiltersData?.ocr_region_filters || [])}
                    disabled={updateProjectOcrFiltersMutation.isPending}
                    className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                  >
                    {updateProjectOcrFiltersMutation.isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>

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

      {/* Region edit panel - reemplaza el modal */}
      {selectedRegion && (
        <div className="fixed right-4 top-20 w-80 z-50">
          <RegionPropertiesPanel
            region={selectedRegion}
            onUpdate={(updates) => {
              updateRegionMutation.mutate({
                regionId: selectedRegion.id,
                updates,
              })
              // Actualizar estado local para reflejar cambios inmediatamente
              setSelectedRegion({ ...selectedRegion, ...updates })
            }}
            onDelete={() => {
              deleteRegionMutation.mutate(selectedRegion.id)
              setSelectedRegion(null)
            }}
            onClose={() => setSelectedRegion(null)}
            onDuplicate={() => {
              // Crear duplicado con offset
              const [x1, y1, x2, y2] = selectedRegion.bbox
              pagesApi.createTextRegion(projectId!, selectedPage, {
                bbox: [x1 + 20, y1 + 20, x2 + 20, y2 + 20],
                src_text: selectedRegion.src_text,
                tgt_text: selectedRegion.tgt_text || undefined,
              }).then(() => {
                refetchRegions()
              })
            }}
          />
        </div>
      )}
    </div>
  )
}
