import { useState } from 'react'
import { X } from 'lucide-react'

interface CaptureDialogProps {
  onConfirm: (name: string, removeBg: boolean, runOcr: boolean, eraseOcrText: boolean) => Promise<void> | void
  onCancel: () => void
}

export function CaptureDialog({ onConfirm, onCancel }: CaptureDialogProps) {
  const [name, setName] = useState('')
  const [removeBg, setRemoveBg] = useState(false)
  const [runOcr, setRunOcr] = useState(false)
  const [eraseOcrText, setEraseOcrText] = useState(false)
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-80 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">Guardar recorte</h3>
          <button onClick={onCancel} disabled={saving} className="p-1 hover:bg-gray-100 rounded disabled:opacity-50">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Circuito motor"
              className="w-full px-2 py-1.5 border rounded text-sm"
              autoFocus
              disabled={saving}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={removeBg}
              onChange={(e) => setRemoveBg(e.target.checked)}
              disabled={saving}
            />
            Quitar fondo blanco
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={runOcr}
              onChange={(e) => setRunOcr(e.target.checked)}
              disabled={saving}
            />
            Detectar texto (OCR)
          </label>
          {runOcr && (
            <p className="ml-6 text-xs text-gray-500">
              El texto detectado se mostrará sobre la imagen en la librería.
            </p>
          )}
          {runOcr && (
            <label className="flex items-center gap-2 text-sm text-gray-700 ml-6">
              <input
                type="checkbox"
                checked={eraseOcrText}
                onChange={(e) => setEraseOcrText(e.target.checked)}
                disabled={saving}
              />
              Borrar textos detectados
            </label>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              disabled={saving}
              className="flex-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                try {
                  await onConfirm(name.trim() || 'Sin nombre', removeBg, runOcr, eraseOcrText && runOcr)
                } finally {
                  setSaving(false)
                }
              }}
              className="flex-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
