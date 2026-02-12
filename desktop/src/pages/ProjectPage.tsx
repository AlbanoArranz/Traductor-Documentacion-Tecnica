import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Book, Play, Download, Lock, Unlock, Trash2, RefreshCw, Undo2, Redo2, Pencil } from 'lucide-react'
import {
  projectsApi,
  pagesApi,
  glossaryApi,
  globalGlossaryApi,
  jobsApi,
  exportApi,
  settingsApi,
  drawingsApi,
  snippetsApi,
} from '../lib/api'
import type { TextRegion, OcrRegionFilter, DrawingElement } from '../lib/api'
import { EditableTextBox } from '../components/EditableTextBox'
import { RegionPropertiesPanel } from '../components/RegionPropertiesPanel'
import { HelpMenu } from '../components/HelpMenu'
import { DrawingCanvas, type DrawingTool } from '../components/DrawingCanvas'
import { DrawingToolbar } from '../components/DrawingToolbar'
import { DrawingOverlay } from '../components/DrawingOverlay'
import { SnippetLibraryPanel } from '../components/SnippetLibraryPanel'
import { CaptureDialog } from '../components/CaptureDialog'
import { useUndoRedo } from '../lib/undoRedo'
import toast from 'react-hot-toast'

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const [selectedPage, setSelectedPage] = useState(0)
  const [selectedRegionIds, setSelectedRegionIds] = useState<Set<string>>(new Set())
  const [isDraggingSelection, setIsDraggingSelection] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{x: number, y: number, width: number, height: number} | null>(null)
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null)
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
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ current: number; total: number } | null>(null)
  const [composeAllRunning, setComposeAllRunning] = useState(false)
  const [confirmComposeAll, setConfirmComposeAll] = useState(false)
  const [composeAllProgress, setComposeAllProgress] = useState<{ current: number; total: number } | null>(null)
  const [isMultiDeleting, setIsMultiDeleting] = useState(false)
  
  // Estado para zoom
  const [zoomLevel, setZoomLevel] = useState(1)
  const ZOOM_STEP = 0.25
  const MIN_ZOOM = 0.25
  const MAX_ZOOM = 4
  
  // Estado para filtros OCR del proyecto
  const [projectOcrFilters, setProjectOcrFilters] = useState<OcrRegionFilter[]>([])
  const [showOcrFiltersPanel, setShowOcrFiltersPanel] = useState(false)
  
  // Estado para herramientas de dibujo
  const [drawingMode, setDrawingMode] = useState(false)
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('select')
  const [drawingStrokeColor, setDrawingStrokeColor] = useState('#000000')
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState(2)
  const [drawingFillColor, setDrawingFillColor] = useState<string | null>(null)
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<string[]>([])
  // Estado para librería de imágenes
  const [imageModeActive, setImageModeActive] = useState(false)
  const [captureDialogBbox, setCaptureDialogBbox] = useState<number[] | null>(null)
  const [placingSnippetData, setPlacingSnippetData] = useState<{ base64: string; width: number; height: number } | null>(null)
  const [composeDirtyPages, setComposeDirtyPages] = useState<Record<number, boolean>>({})
  const autoComposeTimerRef = useRef<number | null>(null)
  // Estado para Undo/Redo
  const { execute: executeUndoable, undo, redo, canUndo, canRedo } = useUndoRedo()

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

  const { data: regions } = useQuery({
    queryKey: ['regions', projectId, selectedPage],
    queryFn: () => pagesApi.getTextRegions(projectId!, selectedPage).then(res => res.data),
    enabled: !!projectId,
  })

  const isolatedRegionIds = useMemo(() => {
    const out = new Set<string>()
    if (!regions || regions.length === 0) return out

    const intersects = (a: number[], b: number[]) => {
      const [ax1, ay1, ax2, ay2] = a
      const [bx1, by1, bx2, by2] = b
      return !(ax2 <= bx1 || ax1 >= bx2 || ay2 <= by1 || ay1 >= by2)
    }

    for (let i = 0; i < regions.length; i++) {
      const a = regions[i]
      let isolated = true
      for (let j = 0; j < regions.length; j++) {
        if (i === j) continue
        const b = regions[j]
        if (intersects(a.bbox, b.bbox)) {
          isolated = false
          break
        }
      }
      if (isolated) out.add(a.id)
    }

    return out
  }, [regions])

  // Query para elementos de dibujo de la página actual
  const { data: drawings } = useQuery({
    queryKey: ['drawings', projectId, selectedPage],
    queryFn: () => drawingsApi.list(projectId!, selectedPage).then(res => res.data),
    enabled: !!projectId,
  })

  // Mutations para elementos de dibujo
  const createDrawingMutation = useMutation({
    mutationFn: (data: Omit<DrawingElement, 'id' | 'project_id' | 'page_number' | 'created_at'>) =>
      drawingsApi.create(projectId!, selectedPage, data),
    onSuccess: (res) => {
      const created = res.data as DrawingElement
      queryClient.setQueryData<DrawingElement[]>(['drawings', projectId, selectedPage], (old) => {
        const next = old ? [...old] : []
        next.push(created)
        return next
      })
      setComposeDirtyPages((prev) => ({ ...prev, [selectedPage]: true }))
    },
  })

  const deleteDrawingMutation = useMutation({
    mutationFn: (drawingId: string) => drawingsApi.delete(projectId!, drawingId),
    onSuccess: (_res, drawingId) => {
      queryClient.setQueryData<DrawingElement[]>(['drawings', projectId, selectedPage], (old) => {
        if (!old) return old
        return old.filter((d) => d.id !== drawingId)
      })
      setSelectedDrawingIds((prev) => prev.filter((id) => id !== drawingId))
      setComposeDirtyPages((prev) => ({ ...prev, [selectedPage]: true }))
    },
  })

  const updateDrawingMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<DrawingElement> }) =>
      drawingsApi.update(projectId!, id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['drawings', projectId, selectedPage] })
      const previous = queryClient.getQueryData<DrawingElement[]>(['drawings', projectId, selectedPage])

      queryClient.setQueryData<DrawingElement[]>(['drawings', projectId, selectedPage], (old) => {
        if (!old) return old
        return old.map((d) => (d.id === id ? { ...d, ...updates } : d))
      })

      setComposeDirtyPages((prev) => ({ ...prev, [selectedPage]: true }))

      return { previous }
    },
    onError: (err, _vars, ctx) => {
      console.error('Error updating drawing:', err)
      if (ctx?.previous) {
        queryClient.setQueryData(['drawings', projectId, selectedPage], ctx.previous)
      }
    },
    onSuccess: (res) => {
      // Reconciliar con respuesta del servidor (autoridad)
      const server = res.data as DrawingElement
      queryClient.setQueryData<DrawingElement[]>(['drawings', projectId, selectedPage], (old) => {
        if (!old) return old
        return old.map((d) => (d.id === server.id ? server : d))
      })
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
      queryClient.invalidateQueries({ queryKey: ['regions', projectId, selectedPage] })
      setComposeDirtyPages((prev) => ({ ...prev, [selectedPage]: true }))
    },
  })

  const composeMutation = useMutation({
    mutationFn: () => pagesApi.renderTranslated(projectId!, selectedPage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages', projectId] })
      setImageTimestamp(Date.now())
      setComposeDirtyPages((prev) => ({ ...prev, [selectedPage]: false }))
    },
  })

  const currentPage = pages?.find(p => p.page_number === selectedPage)
  const canShowTranslated = currentPage?.has_translated
  const canShowOriginal = currentPage?.has_original
  const isComposeDirty = !!composeDirtyPages[selectedPage]

  useEffect(() => {
    if (!projectId) return
    if (!isComposeDirty) return
    if (drawingMode) return
    if (!canShowOriginal) return
    if (composeMutation.isPending) return
    if (composeAllRunning) return

    if (autoComposeTimerRef.current) {
      window.clearTimeout(autoComposeTimerRef.current)
      autoComposeTimerRef.current = null
    }

    autoComposeTimerRef.current = window.setTimeout(() => {
      if (drawingMode) return
      if (composeMutation.isPending) return
      composeMutation.mutate()
    }, 1500)

    return () => {
      if (autoComposeTimerRef.current) {
        window.clearTimeout(autoComposeTimerRef.current)
        autoComposeTimerRef.current = null
      }
    }
  }, [projectId, selectedPage, isComposeDirty, drawingMode, canShowOriginal, composeMutation.isPending, composeAllRunning])

  const updateRegionMutation = useMutation({
    mutationFn: (data: { regionId: string; updates: Partial<TextRegion> }) =>
      pagesApi.updateTextRegion(projectId!, data.regionId, data.updates),
    onMutate: async ({ regionId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['regions', projectId, selectedPage] })
      const previous = queryClient.getQueryData<TextRegion[]>(['regions', projectId, selectedPage])

      queryClient.setQueryData<TextRegion[]>(['regions', projectId, selectedPage], (old) => {
        if (!old) return old
        return old.map((r) => (r.id === regionId ? { ...r, ...updates } : r))
      })

      setComposeDirtyPages((prev) => ({ ...prev, [selectedPage]: true }))

      return { previous }
    },
    onError: (err, _vars, ctx) => {
      console.error('Error updating region:', err)
      if (ctx?.previous) {
        queryClient.setQueryData(['regions', projectId, selectedPage], ctx.previous)
      }
      alert('Error al actualizar la región')
    },
    onSuccess: (res) => {
      // Reconciliar con respuesta del servidor (autoridad)
      const server = res.data as TextRegion
      queryClient.setQueryData<TextRegion[]>(['regions', projectId, selectedPage], (old) => {
        if (!old) return old
        return old.map((r) => (r.id === server.id ? server : r))
      })
    },
  })

  const deleteRegionMutation = useMutation({
    mutationFn: async (regionId: string) => {
      console.log('Deleting region:', regionId)
      await pagesApi.deleteTextRegion(projectId!, regionId)
    },
    onSuccess: (_res, regionId) => {
      console.log('Region deleted successfully')
      queryClient.setQueryData<TextRegion[]>(['regions', projectId, selectedPage], (old) => {
        if (!old) return old
        return old.filter((r) => r.id !== regionId)
      })
      setSelectedRegionIds((prev) => {
        const next = new Set(prev)
        next.delete(regionId)
        return next
      })
      setComposeDirtyPages((prev) => ({ ...prev, [selectedPage]: true }))
    },
    onError: (err) => {
      console.error('Error deleting region:', err)
      // Don't show alert during multi-delete to avoid spam
      if (!isMultiDeleting) {
        alert('Error al eliminar la región')
      }
    },
  })

  const undoableUpdate = (regionId: string, updates: Partial<TextRegion>) => {
    const current = (queryClient.getQueryData<TextRegion[]>(['regions', projectId, selectedPage]) || [])
      .find(r => r.id === regionId)
    if (!current) {
      updateRegionMutation.mutate({ regionId, updates })
      return
    }
    const prevValues: Partial<TextRegion> = {}
    for (const key of Object.keys(updates) as (keyof TextRegion)[]) {
      (prevValues as any)[key] = (current as any)[key]
    }
    executeUndoable({
      id: `update-${regionId}-${Date.now()}`,
      type: 'update-region',
      description: `Update region ${regionId}`,
      do: () => updateRegionMutation.mutateAsync({ regionId, updates }),
      undo: async () => {
        await updateRegionMutation.mutateAsync({ regionId, updates: prevValues })
      },
      redo: () => updateRegionMutation.mutateAsync({ regionId, updates }),
    }).catch(() => {})
  }

  const undoableDelete = (regionId: string) => {
    const current = (queryClient.getQueryData<TextRegion[]>(['regions', projectId, selectedPage]) || [])
      .find(r => r.id === regionId)
    if (!current) {
      deleteRegionMutation.mutate(regionId)
      return
    }
    const snapshot = { ...current }
    const page = snapshot.page_number ?? selectedPage
    let currentId = regionId

    executeUndoable({
      id: `delete-${regionId}-${Date.now()}`,
      type: 'delete-region',
      description: `Delete region ${regionId}`,
      do: async () => {
        await pagesApi.deleteTextRegion(projectId!, currentId)
        queryClient.setQueryData<TextRegion[]>(['regions', projectId, selectedPage], (old) =>
          old ? old.filter(r => r.id !== currentId) : old
        )
        setSelectedRegionIds(prev => { const n = new Set(prev); n.delete(currentId); return n })
        setComposeDirtyPages(prev => ({ ...prev, [selectedPage]: true }))
      },
      undo: async () => {
        const res = await pagesApi.createTextRegion(projectId!, page, {
          bbox: snapshot.bbox,
          src_text: snapshot.src_text,
          tgt_text: snapshot.tgt_text ?? undefined,
          font_size: snapshot.font_size ?? undefined,
          font_family: snapshot.font_family ?? undefined,
          text_color: snapshot.text_color ?? undefined,
          bg_color: snapshot.bg_color ?? undefined,
          text_align: snapshot.text_align ?? undefined,
          rotation: snapshot.rotation ?? undefined,
          line_height: snapshot.line_height ?? undefined,
          locked: snapshot.locked ?? undefined,
          compose_mode: snapshot.compose_mode ?? undefined,
          is_manual: snapshot.is_manual ?? undefined,
          confidence: snapshot.confidence ?? undefined,
          render_order: snapshot.render_order ?? undefined,
        })
        const created = res.data as TextRegion
        currentId = created.id
        queryClient.invalidateQueries({ queryKey: ['regions', projectId, selectedPage] })
        setComposeDirtyPages(prev => ({ ...prev, [selectedPage]: true }))
      },
    }).catch(() => {})
  }

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
        queryClient.invalidateQueries({ queryKey: ['regions', projectId, selectedPage] })
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

      queryClient.invalidateQueries({ queryKey: ['regions', projectId, selectedPage] })
      // Si la región seleccionada ya no existe, limpiar selección
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
          if (selectedIds.length === 1) {
            undoableDelete(selectedIds[0])
          } else if (selectedIds.length > 1) {
            setIsMultiDeleting(true)
            setTimeout(() => setIsMultiDeleting(false), 1000)
            selectedIds.forEach(id => {
              deleteRegionMutation.mutate(id)
            })
          }
          return selectedIds.length > 0 ? new Set() : prevIds
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
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{project?.name}</h1>
            {project?.document_type && (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  project.document_type === 'manual'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
                title={
                  project.document_type === 'manual'
                    ? 'Manual técnico: párrafos, texto corrido'
                    : 'Esquema eléctrico: texto disperso, cajas individuales'
                }
              >
                {project.document_type === 'manual' ? '📄 Manual' : '🔌 Esquema'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-2 text-sm border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Deshacer (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-2 text-sm border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Rehacer (Ctrl+Y)"
            >
              <Redo2 size={16} />
            </button>
          </div>
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
              <img
                src={pagesApi.getThumbnailUrl(projectId!, i, 'original')}
                alt={`Página ${i + 1}`}
                className="w-full aspect-[3/4] object-cover rounded bg-gray-200"
                onError={(e) => {
                  // Si la imagen no existe, mostrar placeholder con número
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="aspect-[3/4] bg-gray-200 rounded flex items-center justify-center text-sm text-gray-500">${i + 1}</div>`;
                }}
              />
            </button>
          ))}
        </aside>

        {/* Image viewer */}
        <div ref={imageViewerRef} className="flex-1 overflow-auto p-4 bg-gray-100">
          <div className="flex gap-2 mb-4">
            <button
              data-testid="render-btn"
              onClick={() => renderMutation.mutate()}
              disabled={renderMutation.isPending}
              className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
            >
              {renderMutation.isPending ? 'Renderizando...' : 'Renderizar'}
            </button>
            <button
              data-testid="ocr-btn"
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
                  queryClient.setQueryData<TextRegion[]>(['regions', projectId, selectedPage], (old) => {
                    const next = old ? [...old] : []
                    next.push(res.data)
                    return next
                  })
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
              {composeMutation.isPending ? 'Componiendo...' : `Componer${isComposeDirty ? '*' : ''}`}
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
            {/* Botón de modo dibujo */}
            <button
              data-testid="draw-mode-btn"
              onClick={() => {
                setDrawingMode(!drawingMode)
                if (!drawingMode) {
                  setDrawingTool('select')
                }
              }}
              className={`px-3 py-1 text-sm border rounded hover:bg-white ml-2 flex items-center gap-1 ${
                drawingMode ? 'bg-primary-100 border-primary-500 text-primary-700' : ''
              }`}
              title="Herramientas de dibujo"
            >
              <Pencil size={14} />
              Dibujar
            </button>
            {/* Controles de Zoom */}
            <div className="flex items-center gap-1 ml-4 border rounded bg-white">
              <button
                onClick={() => setZoomLevel(Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP))}
                disabled={zoomLevel <= MIN_ZOOM}
                className="px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Alejar (-)"
              >
                −
              </button>
              <span className="px-2 text-sm font-medium min-w-[3.5rem] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP))}
                disabled={zoomLevel >= MAX_ZOOM}
                className="px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Acercar (+)"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                disabled={zoomLevel === 1}
                className="px-2 py-1 text-sm hover:bg-gray-100 border-l disabled:opacity-30 disabled:cursor-not-allowed"
                title="Reset zoom (100%)"
              >
                ⟲
              </button>
            </div>
          </div>

          {/* Toolbar de dibujo - fixed */}
          {drawingMode && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
              <DrawingToolbar
                tool={drawingTool}
                onToolChange={setDrawingTool}
                strokeColor={drawingStrokeColor}
                onStrokeColorChange={(color) => {
                  setDrawingStrokeColor(color)
                  selectedDrawingIds.forEach(id =>
                    updateDrawingMutation.mutate({ id, updates: { stroke_color: color } })
                  )
                }}
                strokeWidth={drawingStrokeWidth}
                onStrokeWidthChange={(width) => {
                  setDrawingStrokeWidth(width)
                  selectedDrawingIds.forEach(id =>
                    updateDrawingMutation.mutate({ id, updates: { stroke_width: width } })
                  )
                }}
                fillColor={drawingFillColor}
                onFillColorChange={(color) => {
                  setDrawingFillColor(color)
                  selectedDrawingIds.forEach(id =>
                    updateDrawingMutation.mutate({ id, updates: { fill_color: color } })
                  )
                }}
                imageModeActive={imageModeActive}
                onImageModeToggle={() => setImageModeActive(!imageModeActive)}
                onClose={async () => {
                  setDrawingMode(false)
                  setImageModeActive(false)
                  // Componer imagen con dibujos al salir del modo dibujo (preview rápido)
                  try {
                    await pagesApi.renderTranslated(projectId!, selectedPage, 450, true)
                    setImageTimestamp(Date.now())
                    queryClient.invalidateQueries({ queryKey: ['pages', projectId] })
                  } catch (e) {
                    console.error('Error rendering translated with drawings:', e)
                  }
                }}
              />
            </div>
          )}

          {imageUrl ? (
            <div className="relative inline-block">
              <img
                data-testid="page-image"
                ref={imageRef}
                src={imageUrl}
                alt={`Página ${selectedPage + 1}`}
                className="shadow-lg block"
                style={{
                  maxWidth: 'none',
                  maxHeight: 'none',
                  width: imageSize.width > 0 ? imageSize.width * imageScale : undefined,
                  height: imageSize.height > 0 ? imageSize.height * imageScale : undefined,
                }}
                onLoad={handleImageLoad}
              />
              {/* Overlay interactivo para regiones de texto */}
              {regions && regions.length > 0 && imageSize.width > 0 && (
                <div
                  className="absolute top-0 left-0"
                  style={{
                    width: imageSize.width * imageScale,
                    height: imageSize.height * imageScale,
                    cursor: isDraggingSelection ? 'crosshair' : 'default',
                  }}
                  onMouseDown={(e) => {
                    // Solo iniciar drag si no se hizo click en una caja
                    if (e.target === e.currentTarget) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = (e.clientX - rect.left)
                      const y = (e.clientY - rect.top)
                      setDragStart({ x, y })
                      setSelectionRect({ x, y, width: 0, height: 0 })
                      setIsDraggingSelection(true)
                      if (!e.ctrlKey && !e.metaKey) {
                        setSelectedRegionIds(new Set())
                      }
                    }
                  }}
                  onMouseMove={(e) => {
                    if (!isDraggingSelection || !dragStart) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const x = (e.clientX - rect.left)
                    const y = (e.clientY - rect.top)
                    const newRect = {
                      x: Math.min(dragStart.x, x),
                      y: Math.min(dragStart.y, y),
                      width: Math.abs(x - dragStart.x),
                      height: Math.abs(y - dragStart.y),
                    }
                    setSelectionRect(newRect)
                  }}
                  onMouseUp={() => {
                    if (!isDraggingSelection || !selectionRect) {
                      setIsDraggingSelection(false)
                      setDragStart(null)
                      return
                    }
                    // Detectar cajas dentro del rectángulo de selección
                    const selectedIds = new Set(selectedRegionIds)
                    regions.forEach((region) => {
                      const [x1, y1, x2, y2] = region.bbox
                      const sx1 = x1 * imageScale
                      const sy1 = y1 * imageScale
                      const sx2 = x2 * imageScale
                      const sy2 = y2 * imageScale
                      // Verificar si la caja intersecta con el rectángulo de selección
                      const intersects = !(
                        sx2 < selectionRect.x ||
                        sx1 > selectionRect.x + selectionRect.width ||
                        sy2 < selectionRect.y ||
                        sy1 > selectionRect.y + selectionRect.height
                      )
                      if (intersects) {
                        selectedIds.add(region.id)
                      }
                    })
                    setSelectedRegionIds(selectedIds)
                    setIsDraggingSelection(false)
                    setDragStart(null)
                    setSelectionRect(null)
                  }}
                >
                  {/* Rectángulo de selección */}
                  {selectionRect && (
                    <div
                      style={{
                        position: 'absolute',
                        left: selectionRect.x,
                        top: selectionRect.y,
                        width: selectionRect.width,
                        height: selectionRect.height,
                        backgroundColor: 'rgba(37, 99, 235, 0.2)',
                        border: '2px dashed #2563eb',
                        pointerEvents: 'none',
                        zIndex: 1000,
                      }}
                    />
                  )}
                  {regions.map((region, index) => (
                    <EditableTextBox
                      key={region.id}
                      region={region}
                      scale={imageScale}
                      isSelected={selectedRegionIds.has(region.id)}
                      isIsolated={isolatedRegionIds.has(region.id)}
                      index={index}
                      onSelect={(e) => {
                        if (e?.ctrlKey || e?.metaKey) {
                          const newIds = new Set(selectedRegionIds)
                          if (newIds.has(region.id)) newIds.delete(region.id)
                          else newIds.add(region.id)
                          setSelectedRegionIds(newIds)
                        } else {
                          setSelectedRegionIds(new Set([region.id]))
                        }
                      }}
                      onUpdate={(updates) => {
                        if ('tgt_text' in updates || 'locked' in updates || 'bbox' in updates) {
                          undoableUpdate(region.id, updates)
                        } else {
                          updateRegionMutation.mutate({ regionId: region.id, updates })
                        }
                      }}
                      documentType={project?.document_type}
                    />
                  ))}
                </div>
              )}
              {/* Canvas de dibujo */}
              {drawingMode && imageSize.width > 0 && (
                <DrawingCanvas
                  imageSize={imageSize}
                  scale={imageScale}
                  tool={drawingTool}
                  strokeColor={drawingStrokeColor}
                  strokeWidth={drawingStrokeWidth}
                  fillColor={drawingFillColor}
                  drawings={drawings || []}
                  selectedDrawingIds={selectedDrawingIds}
                  onDrawingCreate={(data) => createDrawingMutation.mutate(data)}
                  onDrawingSelect={setSelectedDrawingIds}
                  onDrawingDelete={(id) => deleteDrawingMutation.mutate(id)}
                  onDrawingUpdate={(id, updates) => updateDrawingMutation.mutate({ id, updates })}
                  onAddTextBox={(position) => {
                    // Crear una región de texto en la posición clicada
                    const defaultWidth = 150
                    const defaultHeight = 30
                    const bbox = [
                      position.x,
                      position.y,
                      position.x + defaultWidth,
                      position.y + defaultHeight
                    ]
                    pagesApi.createTextRegion(projectId!, selectedPage, {
                      bbox,
                      src_text: '',
                      tgt_text: '',
                    }).then((res) => {
                      queryClient.setQueryData<TextRegion[]>(['regions', projectId, selectedPage], (old) => {
                        const next = old ? [...old] : []
                        next.push(res.data)
                        return next
                      })
                    })
                  }}
                  onCaptureArea={(bbox) => {
                    setCaptureDialogBbox(bbox)
                  }}
                  onPlaceSnippet={async (position) => {
                    if (!placingSnippetData || !projectId) return
                    createDrawingMutation.mutate({
                      element_type: 'image',
                      points: [position.x, position.y, position.x + placingSnippetData.width, position.y + placingSnippetData.height],
                      stroke_color: '#000000',
                      stroke_width: 0,
                      fill_color: null,
                      text: null,
                      font_size: 14,
                      font_family: 'Arial',
                      text_color: '#000000',
                      image_data: placingSnippetData.base64,
                    })
                    setPlacingSnippetData(null)
                    setDrawingTool('select')
                  }}
                />
              )}
              {/* Overlay read-only de dibujos cuando no está en modo dibujo */}
              {!drawingMode && imageSize.width > 0 && (
                <DrawingOverlay
                  drawings={drawings || []}
                  scale={imageScale}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              Haz clic en "Renderizar" para ver la página
            </div>
          )}
        </div>

        {/* Text regions panel / Snippet library panel */}
        <aside className="w-80 border-l bg-white overflow-y-auto">
          {drawingMode && imageModeActive ? (
            <SnippetLibraryPanel
              onSnippetSelect={async (snippetId, transparent) => {
                try {
                  const res = await snippetsApi.getBase64(snippetId, transparent)
                  setPlacingSnippetData(res.data)
                  setDrawingTool('place_snippet')
                  toast.success('Haz clic en la página para colocar la imagen')
                } catch (e) {
                  console.error('Error loading snippet:', e)
                  toast.error('Error al cargar la imagen')
                }
              }}
              onCaptureStart={() => {
                setDrawingTool('capture')
              }}
            />
          ) : (
          <>
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
                        const next = [...projectOcrFilters]
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
                        const next = [...projectOcrFilters]
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
                          const next = [...projectOcrFilters]
                          next[idx] = { ...next[idx], case_sensitive: e.target.checked }
                          setProjectOcrFilters(next)
                        }}
                      />
                      Mayús.
                    </label>
                    <button
                      onClick={() => {
                        const next = projectOcrFilters.filter((_, i) => i !== idx)
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
                      const next = [...projectOcrFilters, { mode: 'contains' as const, pattern: '', case_sensitive: false }]
                      setProjectOcrFilters(next)
                    }}
                    className="flex-1 px-2 py-1 text-xs border rounded hover:bg-gray-100"
                  >
                    + Añadir filtro
                  </button>
                  <button
                    onClick={() => updateProjectOcrFiltersMutation.mutate(projectOcrFilters)}
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
                  selectedRegionIds.has(region.id) ? 'bg-primary-50' : ''
                }`}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    const newIds = new Set(selectedRegionIds)
                    if (newIds.has(region.id)) newIds.delete(region.id)
                    else newIds.add(region.id)
                    setSelectedRegionIds(newIds)
                  } else {
                    setSelectedRegionIds(new Set([region.id]))
                  }
                }}
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
                      undoableUpdate(region.id, { locked: !region.locked })
                    }}
                    className={`p-1 rounded ${region.locked ? 'text-primary-600' : 'text-gray-400'}`}
                    title={region.locked ? 'Desbloquear' : 'Bloquear'}
                  >
                    {region.locked ? <Lock size={16} /> : <Unlock size={16} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      undoableDelete(region.id)
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
          </>
          )}
        </aside>
      </div>

      {/* CaptureDialog */}
      {captureDialogBbox && (
        <CaptureDialog
          onConfirm={async (name, removeBg) => {
            if (!projectId) return
            try {
              await snippetsApi.capture({
                project_id: projectId,
                page_number: selectedPage,
                bbox: captureDialogBbox,
                name,
                remove_bg: removeBg,
              })
              queryClient.invalidateQueries({ queryKey: ['snippets'] })
              toast.success('Imagen guardada en la librería')
            } catch (e) {
              const detail = (e as any)?.response?.data?.detail || (e as any)?.message || String(e)
              console.error('Error capturing snippet:', detail, e)
              toast.error(`Error al capturar: ${detail}`)
            }
            setCaptureDialogBbox(null)
            setDrawingTool('select')
          }}
          onCancel={() => {
            setCaptureDialogBbox(null)
            setDrawingTool('select')
          }}
        />
      )}

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
              }).then((res) => {
                queryClient.setQueryData<TextRegion[]>(['regions', projectId, selectedPage], (old) => {
                  const next = old ? [...old] : []
                  next.push(res.data)
                  return next
                })
              })
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
