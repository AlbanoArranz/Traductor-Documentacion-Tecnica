import { useState } from 'react'
import { Eye, Undo2, AlertTriangle, Wand2, Droplet, Type } from 'lucide-react'
import type { SnippetMeta, OcrDetection, SnippetOp } from '../lib/api'

interface OcrTypographySettings {
  fontSize: number // percentage multiplier (100 = normal)
  fontFamily: string
}

interface SnippetInspectorProps {
  snippetName: string
  currentVersion: number
  meta: SnippetMeta | undefined
  metaLoading: boolean
  ocrDraft: OcrDetection[]
  onOcrDraftChange: (draft: OcrDetection[]) => void
  ocrDirty: boolean
  queuedOps: SnippetOp[]
  drawDirty: boolean
  overlayCount: number
  onRemoveBg: () => void
  onDetectOcr: () => void
  onRemoveText: () => void
  onQaValidate: () => void
  onRestoreVersion: (version: number) => void
  onSaveOcr: () => void
  detectPending: boolean
  removeTextPending: boolean
  qaPending: boolean
  restorePending: boolean
  saveOcrPending: boolean
  hasDetectedRegions: boolean
  ocrTypography: OcrTypographySettings
  onOcrTypographyChange: (settings: OcrTypographySettings) => void
}

type TabId = 'actions' | 'ocr' | 'history'

const FONT_FAMILIES = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana']

export function SnippetInspector({
  snippetName,
  currentVersion,
  meta,
  metaLoading,
  ocrDraft,
  onOcrDraftChange,
  ocrDirty,
  queuedOps,
  drawDirty,
  overlayCount,
  onRemoveBg,
  onDetectOcr,
  onRemoveText,
  onQaValidate,
  onRestoreVersion,
  onSaveOcr,
  detectPending,
  removeTextPending,
  qaPending,
  restorePending,
  saveOcrPending,
  hasDetectedRegions,
  ocrTypography,
  onOcrTypographyChange,
}: SnippetInspectorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('actions')
  const [selectedOcrIdx, setSelectedOcrIdx] = useState<number | null>(null)
  const [individualFontSize, setIndividualFontSize] = useState<number | null>(null)

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'actions', label: 'Acciones' },
    { id: 'ocr', label: 'OCR' },
    { id: 'history', label: 'Historial' },
  ]

  const handleIndividualFontSize = (idx: number, size: number) => {
    const next = [...ocrDraft]
    // Use dedicated font_size_ui field for UI typography (not confidence)
    next[idx] = { ...next[idx], font_size_ui: size }
    onOcrDraftChange(next)
    setIndividualFontSize(size)
  }

  const handleIndividualTextColor = (idx: number, color: string) => {
    const next = [...ocrDraft]
    next[idx] = { ...next[idx], text_color: color }
    onOcrDraftChange(next)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b bg-gray-50">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-primary-500 text-primary-700 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            {t.label}
            {t.id === 'ocr' && ocrDirty && (
              <span className="ml-1 w-2 h-2 bg-orange-400 rounded-full inline-block" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'actions' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">
              {snippetName} · v{currentVersion}
            </p>
            <button
              className="w-full px-3 py-2 text-sm border rounded flex items-center gap-2 hover:bg-gray-50"
              onClick={onRemoveBg}
            >
              <Droplet size={16} /> Quitar fondo blanco
            </button>
            <button
              className="w-full px-3 py-2 text-sm border rounded flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
              onClick={onDetectOcr}
              disabled={detectPending}
            >
              <Eye size={16} /> {detectPending ? 'Detectando...' : 'Detectar texto'}
            </button>
            <button
              className="w-full px-3 py-2 text-sm border rounded flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
              onClick={onRemoveText}
              disabled={removeTextPending || !hasDetectedRegions}
            >
              <Wand2 size={16} /> {removeTextPending ? 'Aplicando...' : 'Borrar texto detectado'}
            </button>
            <button
              className="w-full px-3 py-2 text-sm border rounded flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
              onClick={onQaValidate}
              disabled={qaPending}
            >
              <AlertTriangle size={16} /> QA validate
            </button>
          </div>
        )}

        {activeTab === 'ocr' && (
          <div className="space-y-3">
            {/* Global typography controls */}
            <div className="border rounded p-2 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <Type size={12} className="text-gray-600" />
                <span className="text-xs font-medium text-gray-700">Tipografía global</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500">Tamaño</span>
                  <select
                    className="border rounded px-1 py-0.5 text-xs"
                    value={ocrTypography.fontSize}
                    onChange={(e) => onOcrTypographyChange({
                      ...ocrTypography,
                      fontSize: Number(e.target.value),
                    })}
                  >
                    {[50, 75, 100, 125, 150, 200].map((s) => (
                      <option key={s} value={s}>{s}%</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500">Fuente</span>
                  <select
                    className="border rounded px-1 py-0.5 text-xs"
                    value={ocrTypography.fontFamily}
                    onChange={(e) => onOcrTypographyChange({
                      ...ocrTypography,
                      fontFamily: e.target.value,
                    })}
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">
                {ocrDraft.length} detecciones
              </span>
              <button
                className="text-xs border rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                onClick={onSaveOcr}
                disabled={!ocrDirty || saveOcrPending}
              >
                {saveOcrPending ? 'Guardando...' : 'Guardar OCR'}
              </button>
            </div>
            
            {ocrDraft.length === 0 ? (
              <p className="text-xs text-gray-500">Sin detecciones OCR. Usa "Detectar texto".</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {ocrDraft.map((det, idx) => (
                  <div
                    key={idx}
                    className={`border rounded p-2 bg-white cursor-pointer transition-colors ${
                      selectedOcrIdx === idx ? 'border-primary-400 bg-primary-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedOcrIdx(idx)
                      setIndividualFontSize(det.font_size_ui ?? 100)
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-gray-400">
                        [{det.bbox.map((v) => Math.round(v)).join(', ')}]
                      </p>
                      {selectedOcrIdx === idx && (
                        <span className="text-[10px] text-primary-600">Editando</span>
                      )}
                    </div>
                    <input
                      value={det.text}
                      onChange={(e) => {
                        const next = [...ocrDraft]
                        next[idx] = { ...next[idx], text: e.target.value }
                        onOcrDraftChange(next)
                      }}
                      className="w-full border rounded px-2 py-1 text-xs mb-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {selectedOcrIdx === idx && (
                      <div className="mt-1 pt-1 border-t space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500">Tamaño individual:</span>
                          <select
                            className="border rounded px-1 py-0.5 text-[10px]"
                            value={individualFontSize ?? 100}
                            onChange={(e) => handleIndividualFontSize(idx, Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[50, 75, 100, 125, 150, 200].map((s) => (
                              <option key={s} value={s}>{s}%</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500">Color texto:</span>
                          <input
                            type="color"
                            value={det.text_color || '#000000'}
                            onChange={(e) => handleIndividualTextColor(idx, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-5 border rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {metaLoading && <p className="text-xs text-gray-500">Cargando...</p>}
            {meta?.versions?.length ? (
              <div className="space-y-1">
                {meta.versions
                  .slice()
                  .sort((a, b) => b.version - a.version)
                  .map((version) => (
                    <div
                      key={version.version}
                      className={`border rounded px-2 py-1.5 text-xs ${
                        version.version === currentVersion ? 'bg-primary-50 border-primary-200' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">v{version.version}</span>
                        {version.version !== currentVersion && (
                          <button
                            className="text-primary-600 hover:underline"
                            onClick={() => onRestoreVersion(version.version)}
                            disabled={restorePending}
                          >
                            <Undo2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-gray-400 text-[10px]">
                        {new Date(version.created_at).toLocaleString()}
                      </p>
                      {version.comment && (
                        <p className="text-gray-600 truncate">{version.comment}</p>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              !metaLoading && <p className="text-xs text-gray-500">Sin versiones previas.</p>
            )}
          </div>
        )}
      </div>

      {/* Pending ops footer */}
      <div className="border-t p-2 space-y-1">
        {queuedOps.length > 0 && (
          <div className="text-xs text-gray-600 bg-primary-50 border border-primary-100 rounded px-2 py-1">
            {queuedOps.length} operación(es) pendiente(s)
          </div>
        )}
        {drawDirty && (
          <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded px-2 py-1">
            {overlayCount} anotación(es) de dibujo pendiente(s)
          </div>
        )}
        {ocrDirty && (
          <div className="text-xs text-gray-600 bg-orange-50 border border-orange-100 rounded px-2 py-1">
            OCR modificado sin guardar
          </div>
        )}
      </div>
    </div>
  )
}