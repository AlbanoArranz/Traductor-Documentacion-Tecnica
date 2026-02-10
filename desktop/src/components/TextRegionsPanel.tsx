import { Lock, Unlock, Trash2 } from 'lucide-react'
import type { TextRegion, OcrRegionFilter } from '../lib/api'

interface TextRegionsPanelProps {
  projectId: string
  selectedPage: number
  regions: TextRegion[]
  selectedRegionIds: Set<string>
  onRegionSelect: (ids: Set<string>) => void
  onRegionUpdate: (id: string, updates: Partial<TextRegion>) => void
  onRegionDelete: (id: string) => void
  onBulkDelete: () => void
  projectOcrFilters: OcrRegionFilter[]
  onProjectOcrFiltersChange: (filters: OcrRegionFilter[]) => void
  onSaveProjectOcrFilters: () => void
  regionFilterText: string
  onRegionFilterTextChange: (text: string) => void
  regionFilterMode: 'contains' | 'starts' | 'ends' | 'regex'
  onRegionFilterModeChange: (mode: 'contains' | 'starts' | 'ends' | 'regex') => void
  regionFilterField: 'src' | 'tgt'
  onRegionFilterFieldChange: (field: 'src' | 'tgt') => void
  regionFilterCaseSensitive: boolean
  onRegionFilterCaseSensitiveChange: (sensitive: boolean) => void
  showOnlyFiltered: boolean
  onShowOnlyFilteredChange: (show: boolean) => void
  deleteScope: 'page' | 'all'
  onDeleteScopeChange: (scope: 'page' | 'all') => void
  isBulkDeleting: boolean
  bulkDeleteProgress?: { current: number; total: number }
  confirmDeleteFiltered: boolean
  onConfirmDeleteFilteredChange: (confirm: boolean) => void
  filteredRegions: TextRegion[]
}

export function TextRegionsPanel({
  projectId: _projectId,
  selectedPage: _selectedPage,
  regions,
  selectedRegionIds,
  onRegionSelect,
  onRegionUpdate,
  onRegionDelete,
  onBulkDelete,
  projectOcrFilters: _projectOcrFilters,
  onProjectOcrFiltersChange: _onProjectOcrFiltersChange,
  onSaveProjectOcrFilters: _onSaveProjectOcrFilters,
  regionFilterText,
  onRegionFilterTextChange,
  regionFilterMode,
  onRegionFilterModeChange,
  regionFilterField,
  onRegionFilterFieldChange,
  regionFilterCaseSensitive,
  onRegionFilterCaseSensitiveChange,
  showOnlyFiltered,
  onShowOnlyFilteredChange,
  deleteScope,
  onDeleteScopeChange,
  isBulkDeleting,
  bulkDeleteProgress,
  confirmDeleteFiltered,
  onConfirmDeleteFilteredChange,
  filteredRegions,
}: TextRegionsPanelProps) {
  const displayedRegions = showOnlyFiltered && regionFilterText.trim() ? filteredRegions : regions

  return (
    <aside className="w-80 border-l bg-white overflow-y-auto">
      {/* OCR filters section - simplified for now */}
      <div className="p-4 border-b bg-gray-50">
        <h2 className="font-medium text-sm">Filtros OCR de este proyecto</h2>
        <p className="text-xs text-gray-500 mt-1">{_projectOcrFilters.length} filtros definidos</p>
      </div>

      <div className="p-4 border-b">
        <h2 className="font-medium">Regiones de texto ({regions.length})</h2>
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <select
              value={regionFilterField}
              onChange={(e) => onRegionFilterFieldChange(e.target.value as 'src' | 'tgt')}
              className="flex-1 px-2 py-1 border rounded"
            >
              <option value="src">Texto ZH</option>
              <option value="tgt">Texto ES</option>
            </select>
            <select
              value={regionFilterMode}
              onChange={(e) => onRegionFilterModeChange(e.target.value as 'contains' | 'starts' | 'ends' | 'regex')}
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
              onRegionFilterTextChange(e.target.value)
              onConfirmDeleteFilteredChange(false)
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
                  onRegionFilterCaseSensitiveChange(e.target.checked)
                  onConfirmDeleteFilteredChange(false)
                }}
              />
              Mayúsculas
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showOnlyFiltered}
                onChange={(e) => onShowOnlyFilteredChange(e.target.checked)}
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
                onDeleteScopeChange(e.target.checked ? 'all' : 'page')
                onConfirmDeleteFilteredChange(false)
              }}
            />
            Aplicar a todas las páginas
          </label>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Filtradas: {regionFilterText.trim() ? filteredRegions.length : regions.length}
            </span>
            <button
              onClick={async () => {
                if (!regionFilterText.trim()) return
                if (isBulkDeleting) return

                if (!confirmDeleteFiltered) {
                  onConfirmDeleteFilteredChange(true)
                  window.setTimeout(() => onConfirmDeleteFilteredChange(false), 5000)
                  return
                }

                onBulkDelete()
              }}
              disabled={!regionFilterText.trim() || filteredRegions.length === 0 || isBulkDeleting}
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
              {isBulkDeleting
                ? 'Eliminando...'
                : confirmDeleteFiltered
                  ? 'Confirmar eliminar'
                  : 'Eliminar filtradas'}
            </button>
          </div>

          {isBulkDeleting && bulkDeleteProgress && (
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
                onRegionSelect(newIds)
              } else {
                onRegionSelect(new Set([region.id]))
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
                  onRegionUpdate(region.id, { locked: !region.locked })
                }}
                className={`p-1 rounded ${region.locked ? 'text-primary-600' : 'text-gray-400'}`}
                title={region.locked ? 'Desbloquear' : 'Bloquear'}
              >
                {region.locked ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRegionDelete(region.id)
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
  )
}
