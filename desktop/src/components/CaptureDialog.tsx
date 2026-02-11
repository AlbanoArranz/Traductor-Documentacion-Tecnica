import { useState } from 'react'
import { X } from 'lucide-react'

interface CaptureDialogProps {
  onConfirm: (name: string, removeBg: boolean) => void
  onCancel: () => void
}

export function CaptureDialog({ onConfirm, onCancel }: CaptureDialogProps) {
  const [name, setName] = useState('')
  const [removeBg, setRemoveBg] = useState(false)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-80 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">Guardar recorte</h3>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
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
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={removeBg}
              onChange={(e) => setRemoveBg(e.target.checked)}
            />
            Quitar fondo blanco
          </label>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(name.trim() || 'Sin nombre', removeBg)}
              className="flex-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
