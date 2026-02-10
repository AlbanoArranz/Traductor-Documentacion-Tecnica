import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  projectsApi,
  pagesApi,
  glossaryApi,
  globalGlossaryApi,
  jobsApi,
  exportApi,
  drawingsApi,
} from '../lib/api'
import type { TextRegion, OcrRegionFilter, DrawingElement } from '../lib/api'
import { RegionPropertiesPanel } from '../components/RegionPropertiesPanel'
import { ProjectHeader } from '../components/ProjectHeader'
import { JobProgressBanner } from '../components/JobProgressBanner'
import { PageThumbnailsSidebar } from '../components/PageThumbnailsSidebar'
import { ImageViewer } from '../components/ImageViewer'
import { TextRegionsPanel } from '../components/TextRegionsPanel'
import { useUndoRedo } from '../lib/undoRedo'

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const [selectedPage, setSelectedPage] = useState(0)
  const [selectedRegionIds, setSelectedRegionIds] = useState<Set<string>>(new Set())
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState(0)
  const [jobStep, setJobStep] = useState('')
  const imageViewerRef = useRef<HTMLDivElement>(null)
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
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ current: number; total: number } | undefined>(undefined)
  const [composeAllRunning, setComposeAllRunning] = useState(false)
  const [confirmComposeAll, setConfirmComposeAll] = useState(false)
  const [composeAllProgress, setComposeAllProgress] = useState<{ current: number; total: number } | undefined>(undefined)
  const [isMultiDeleting, setIsMultiDeleting] = useState(false)
  
  const [zoomLevel, setZoomLevel] = useState(1)
  const ZOOM_STEP = 0.25
  const MIN_ZOOM = 0.25
  const MAX_ZOOM = 4
  
  const [projectOcrFilters, setProjectOcrFilters] = useState<OcrRegionFilter[]>([])
  
  const [drawingMode, setDrawingMode] = useState(false)
  const [drawingTool, setDrawingTool] = useState<'select' | 'line' | 'rect' | 'circle' | 'polyline' | 'add_text_box' | null>('select')
  const [drawingStrokeColor, setDrawingStrokeColor] = useState('#000000')
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState(2)
  const [drawingFillColor, setDrawingFillColor] = useState<string | null>(null)
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<string[]>([])
  const { undo, redo, canUndo, canRedo } = useUndoRedo()

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

  // Query para elementos de dibujo de la página actual
  const { data: drawings, refetch: refetchDrawings } = useQuery({
    queryKey: ['drawings', projectId, selectedPage],
    queryFn: () => drawingsApi.list(projectId!, selectedPage).then(res => res.data),
    enabled: !!projectId,
  })

  // Mutations para elementos de dibujo
  const createDrawingMutation = useMutation({
    mutationFn: (data: Omit<DrawingElement, 'id' | 'project_id' | 'page_number' | 'created_at'>) =>
      drawingsApi.create(projectId!, selectedPage, data),
    onSuccess: () => {
      refetchDrawings()
    },
  })

  const deleteDrawingMutation = useMutation({
    mutationFn: (drawingId: string) => drawingsApi.delete(projectId!, drawingId),
    onSuccess: async () => {
      refetchDrawings()
      setSelectedDrawingIds([])
      // Re-renderizar para eliminar la silueta del canvas
      try {
        await pagesApi.renderTranslated(projectId!, selectedPage)
        setImageTimestamp(Date.now())
      } catch (e) {
        console.error('Error re-rendering after delete:', e)
      }
    },
  })

  const updateDrawingMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<DrawingElement> }) =>
      drawingsApi.update(projectId!, id, updates),
    onSuccess: () => {
      refetchDrawings()
    },
  })

  // Query para filtros OCR del proyecto
  const { data: projectOcrFiltersData } = useQuery({
    queryKey: ['project-ocr-filters', projectId],
    queryFn: () => projectsApi.getOcrFilters(projectId!).then(res => res.data),
    enabled: !!projectId,
  })

  useEffect(() => {
    setProjectOcrFilters(projectOcrFiltersData?.ocr_region_filters || [])
  }, [projectOcrFiltersData?.ocr_region_filters])

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
    mutationFn: async (regionId: string) => {
      console.log('Deleting region:', regionId)
      await pagesApi.deleteTextRegion(projectId!, regionId)
    },
    onSuccess: async () => {
      console.log('Region deleted successfully')
      refetchRegions()
      setSelectedRegionIds(new Set())
      // Re-renderizar la página traducida para reflejar el borrado
      try {
        await pagesApi.renderTranslated(projectId!, selectedPage)
        setImageTimestamp(Date.now())
      } catch (e) {
        console.error('Error re-rendering after delete:', e)
      }
    },
    onError: (err) => {
      console.error('Error deleting region:', err)
      // Don't show alert during multi-delete to avoid spam
      if (!isMultiDeleting) {
        alert('Error al eliminar la región')
      }
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
      setComposeAllProgress(undefined)
    }
  }

  const filteredRegions = (regions || []).filter(matchesRegionFilter)

  const bulkDeleteFiltered = async () => {
    if (!projectId) return
    if (!regionFilterText.trim()) return

    setBulkDeleting(true)
    setBulkDeleteProgress(undefined)
    try {
      if (deleteScope === 'page') {
        const idsToDelete = filteredRegions.map((r) => r.id)
        setBulkDeleteProgress({ current: 0, total: idsToDelete.length })
        for (let i = 0; i < idsToDelete.length; i++) {
          await pagesApi.deleteTextRegion(projectId, idsToDelete[i])
          setBulkDeleteProgress({ current: i + 1, total: idsToDelete.length })
        }
        await refetchRegions()
        if (selectedRegionIds.size > 0) {
          const idsToDelete = filteredRegions.map((r) => r.id)
          const hasSelection = idsToDelete.some(id => selectedRegionIds.has(id))
          if (hasSelection) setSelectedRegionIds(new Set())
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
      const stillExists = (await pagesApi.getTextRegions(projectId, selectedPage)).data.some(
        (r) => selectedRegionIds.has(r.id)
      )
      if (!stillExists) setSelectedRegionIds(new Set())
    } catch (e) {
      console.error('Error bulk deleting regions:', e)
      alert('Error al eliminar regiones filtradas')
    } finally {
      setBulkDeleting(false)
      setConfirmDeleteFiltered(false)
      setBulkDeleteProgress(undefined)
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
  const [baseImageScale, setBaseImageScale] = useState(1)

  const recomputeBaseImageScale = () => {
    const viewer = imageViewerRef.current
    if (!viewer) return
    if (imageSize.width <= 0 || imageSize.height <= 0) return

    // p-4 => 16px padding por lado (aprox). Restamos para evitar que se corte.
    const availableWidth = Math.max(1, viewer.clientWidth - 32)
    const fitScale = Math.min(1, availableWidth / imageSize.width)
    setBaseImageScale(fitScale)
  }

  const handleImageLoad = () => {
    if (imageRef.current) {
      const naturalWidth = imageRef.current.naturalWidth
      const naturalHeight = imageRef.current.naturalHeight
      
      // Usar dimensiones naturales para el overlay
      setImageSize({
        width: naturalWidth,
        height: naturalHeight,
      })
    }
  }

  useEffect(() => {
    // Recalcular cuando ya tenemos tamaño de imagen o cambia el tamaño del visor
    recomputeBaseImageScale()
  }, [imageSize.width, imageSize.height])

  useEffect(() => {
    const onResize = () => recomputeBaseImageScale()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [imageSize.width, imageSize.height])
  
  // Scale combinado: base (ajuste a pantalla) * zoom del usuario
  const imageScale = baseImageScale * zoomLevel

  // Ref para evitar stale closure en keyboard handler - usar function updated para obtener estado actual
  const handleKeyDownRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  
  // Actualizar el handler cuando cambie selectedRegion o la mutación
  useEffect(() => {
    handleKeyDownRef.current = (e: KeyboardEvent) => {
      // ESC to deselect all
      if (e.key === 'Escape') {
        setSelectedRegionIds(new Set())
      }

      // Delete to remove selected regions
      if (e.key === 'Delete') {
        e.preventDefault()
        
        // Use functional state update to get fresh selectedRegionIds
        setSelectedRegionIds(prevIds => {
          const selectedIds = Array.from(prevIds)
          if (selectedIds.length > 0) {
            // Set flag for multi-delete to suppress individual error alerts
            if (selectedIds.length > 1) {
              setIsMultiDeleting(true)
              // Clear flag after all deletions complete
              setTimeout(() => setIsMultiDeleting(false), 1000)
            }
            
            selectedIds.forEach(id => {
              deleteRegionMutation.mutate(id)
            })
            return new Set()
          }
          return prevIds
        })
        return
      }

      // Arrow keys to move selected regions
      if (selectedRegionIds.size === 0) return
      
      const step = e.shiftKey ? 10 : 1
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
      
      // Move all selected regions
      const selectedRegions = (regions || []).filter(r => selectedRegionIds.has(r.id))
      selectedRegions.forEach(region => {
        const [x1, y1, x2, y2] = region.bbox
        const newBbox = [x1 + dx, y1 + dy, x2 + dx, y2 + dy]
        
        updateRegionMutation.mutate({
          regionId: region.id,
          updates: { bbox: newBbox },
        })
      })
    }
  }, [selectedRegionIds, updateRegionMutation, deleteRegionMutation])

  // Keyboard shortcuts: arrow keys to move selected region, ESC to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleKeyDownRef.current?.(e)
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Zoom con Ctrl/Cmd + rueda del ratón y gestos de trackpad
  useEffect(() => {
    const imageViewer = document.querySelector('.overflow-auto.p-4.bg-gray-100')
    if (!imageViewer) return

    const handleWheel = (e: Event) => {
      const wheelEvent = e as WheelEvent
      // Ctrl/Cmd + wheel para zoom (ratón tradicional)
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        e.preventDefault()
        const delta = wheelEvent.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        setZoomLevel(prev => {
          const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta))
          return newZoom
        })
        return
      }

      // Detectar gesto de pinch en trackpad (deltaY con ctrlKey false pero comportamiento de pinch)
      // Los trackpads suelen enviar deltaY con valor grande y e.ctrlKey false durante pinch
      if (Math.abs(wheelEvent.deltaY) > 50 && wheelEvent.deltaMode === 0) {
        // Posible gesto de pinch en trackpad
        const delta = wheelEvent.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        setZoomLevel(prev => {
          const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta))
          return newZoom
        })
      }
    }

    // Prevenir zoom del navegador con Ctrl+wheel y atajos undo/redo
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '0')) {
        e.preventDefault()
        if (e.key === '+') {
          setZoomLevel(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP))
        } else if (e.key === '-') {
          setZoomLevel(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP))
        } else if (e.key === '0') {
          setZoomLevel(1)
        }
      }
      // Undo/Redo shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    imageViewer.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      imageViewer.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
    }
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
      <ProjectHeader
        projectId={projectId!}
        projectName={project?.name || ''}
        documentType={project?.document_type}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onProcessAll={() => processAllMutation.mutate()}
        isProcessing={processAllMutation.isPending || !!jobId}
        onExport={async () => {
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
        isExporting={exportMutation.isPending}
      />

      {/* Job progress */}
      <JobProgressBanner
        jobId={jobId}
        progress={jobProgress}
        step={jobStep}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Page thumbnails */}
        <PageThumbnailsSidebar
          projectId={projectId!}
          pageCount={project?.page_count || 0}
          selectedPage={selectedPage}
          onPageSelect={setSelectedPage}
        />

        {/* Image viewer - center content */}
        <ImageViewer
          projectId={projectId!}
          selectedPage={selectedPage}
          imageUrl={imageUrl}
          imageSize={imageSize}
          imageScale={imageScale}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          showTranslated={showTranslated}
          onShowTranslatedChange={setShowTranslated}
          drawingMode={drawingMode}
          onDrawingModeChange={setDrawingMode}
          drawingTool={drawingTool}
          onDrawingToolChange={setDrawingTool}
          drawingStrokeColor={drawingStrokeColor}
          drawingStrokeWidth={drawingStrokeWidth}
          drawingFillColor={drawingFillColor}
          onDrawingStyleChange={(style) => {
            setDrawingStrokeColor(style.strokeColor)
            setDrawingStrokeWidth(style.strokeWidth)
            setDrawingFillColor(style.fillColor)
          }}
          drawings={drawings || []}
          selectedDrawingIds={selectedDrawingIds}
          onDrawingCreate={(data) => createDrawingMutation.mutate(data)}
          onDrawingSelect={setSelectedDrawingIds}
          onDrawingDelete={(id) => deleteDrawingMutation.mutate(id)}
          onDrawingUpdate={(id, updates) => updateDrawingMutation.mutate({ id, updates })}
          selectedRegionIds={selectedRegionIds}
          onRegionSelect={setSelectedRegionIds}
          regions={regions || []}
          onRender={() => renderMutation.mutate()}
          onOcr={() => ocrMutation.mutate()}
          onCompose={() => composeMutation.mutate()}
          onComposeAll={() => {
            if (composeAllRunning) return
            if (!project?.page_count) return
            if (!confirmComposeAll) {
              setConfirmComposeAll(true)
              window.setTimeout(() => setConfirmComposeAll(false), 5000)
              return
            }
            composeAllPages()
          }}
          onAddTextBox={() => {
            const centerX = 2500
            const centerY = 1800
            const bbox = [centerX - 100, centerY - 30, centerX + 100, centerY + 30]
            pagesApi.createTextRegion(projectId!, selectedPage, {
              bbox,
              src_text: '',
              tgt_text: 'Nuevo texto',
            }).then(() => refetchRegions())
          }}
          isRendering={renderMutation.isPending}
          isOcring={ocrMutation.isPending}
          isComposing={composeMutation.isPending}
          isComposingAll={composeAllRunning}
          composeProgress={composeAllProgress}
          canShowOriginal={currentPage?.has_original ?? false}
          canShowTranslated={currentPage?.has_translated ?? false}
          documentType={project?.document_type}
          updateRegionMutation={updateRegionMutation}
          imageViewerRef={imageViewerRef}
          imageRef={imageRef}
          onImageLoad={handleImageLoad}
        />

        {/* Text regions panel - right sidebar */}
        <TextRegionsPanel
          projectId={projectId!}
          selectedPage={selectedPage}
          regions={regions || []}
          selectedRegionIds={selectedRegionIds}
          onRegionSelect={setSelectedRegionIds}
          onRegionUpdate={(id, updates) => updateRegionMutation.mutate({ regionId: id, updates })}
          onRegionDelete={(id) => deleteRegionMutation.mutate(id)}
          onBulkDelete={bulkDeleteFiltered}
          projectOcrFilters={projectOcrFilters}
          onProjectOcrFiltersChange={setProjectOcrFilters}
          onSaveProjectOcrFilters={() => updateProjectOcrFiltersMutation.mutate(projectOcrFilters)}
          regionFilterText={regionFilterText}
          onRegionFilterTextChange={setRegionFilterText}
          regionFilterMode={regionFilterMode}
          onRegionFilterModeChange={setRegionFilterMode}
          regionFilterField={regionFilterField}
          onRegionFilterFieldChange={setRegionFilterField}
          regionFilterCaseSensitive={regionFilterCaseSensitive}
          onRegionFilterCaseSensitiveChange={setRegionFilterCaseSensitive}
          showOnlyFiltered={showOnlyFiltered}
          onShowOnlyFilteredChange={setShowOnlyFiltered}
          deleteScope={deleteScope}
          onDeleteScopeChange={setDeleteScope}
          isBulkDeleting={bulkDeleting}
          bulkDeleteProgress={bulkDeleteProgress}
          confirmDeleteFiltered={confirmDeleteFiltered}
          onConfirmDeleteFilteredChange={setConfirmDeleteFiltered}
          filteredRegions={filteredRegions}
        />
      </div>

      {/* Region edit panel - solo muestra cuando hay exactamente 1 seleccionada */}
      {selectedRegionIds.size === 1 && (() => {
        const selectedRegion = regions?.find(r => selectedRegionIds.has(r.id))
        if (!selectedRegion) return null
        return (
        <div className="fixed right-4 top-20 w-80 z-50">
          <RegionPropertiesPanel
            region={selectedRegion}
            onUpdate={(updates) => {
              updateRegionMutation.mutate({
                regionId: selectedRegion.id,
                updates,
              })
            }}
            onDelete={() => {
              deleteRegionMutation.mutate(selectedRegion.id)
              setSelectedRegionIds(new Set())
            }}
            onClose={() => setSelectedRegionIds(new Set())}
            onDuplicate={() => {
              const [x1, y1, x2, y2] = selectedRegion.bbox
              pagesApi.createTextRegion(projectId!, selectedPage, {
                bbox: [x1 + 20, y1 + 20, x2 + 20, y2 + 20],
                src_text: selectedRegion.src_text,
                tgt_text: selectedRegion.tgt_text || undefined,
              }).then(() => refetchRegions())
            }}
            onAddToGlossary={async (srcTerm, tgtTerm, scope) => {
              try {
                if (scope === 'global') {
                  const res = await globalGlossaryApi.get()
                  const currentEntries = res.data.entries || []
                  if (currentEntries.some(e => e.src_term === srcTerm)) {
                    alert('Este término ya existe en el glosario global')
                    return
                  }
                  await globalGlossaryApi.update([...currentEntries, { src_term: srcTerm, tgt_term: tgtTerm, locked: false }])
                  alert(`"${srcTerm}" añadido al glosario global`)
                } else {
                  const res = await glossaryApi.get(projectId!)
                  const currentEntries = res.data.entries || []
                  if (currentEntries.some(e => e.src_term === srcTerm)) {
                    alert('Este término ya existe en el glosario local')
                    return
                  }
                  await glossaryApi.update(projectId!, [...currentEntries, { src_term: srcTerm, tgt_term: tgtTerm, locked: false }])
                  alert(`"${srcTerm}" añadido al glosario local`)
                }
              } catch (err) {
                console.error('Error adding to glossary:', err)
                alert('Error al añadir al glosario')
              }
            }}
          />
        </div>
        )
      })()}
    </div>
  )
}
