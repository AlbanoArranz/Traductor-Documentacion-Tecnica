import { MousePointer2, Minus, Square, Circle, Type, X, Route, ImagePlus, Scissors } from 'lucide-react'
import type { DrawingTool } from './DrawingCanvas'

interface DrawingToolbarProps {
  tool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  strokeColor: string
  onStrokeColorChange: (color: string) => void
  strokeWidth: number
  onStrokeWidthChange: (width: number) => void
  fillColor: string | null
  onFillColorChange: (color: string | null) => void
  onClose: () => void
  imageModeActive: boolean
  onImageModeToggle: () => void
}

export function DrawingToolbar({
  tool,
  onToolChange,
  strokeColor,
  onStrokeColorChange,
  strokeWidth,
  onStrokeWidthChange,
  fillColor,
  onFillColorChange,
  onClose,
  imageModeActive,
  onImageModeToggle,
}: DrawingToolbarProps) {
  const tools: { id: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer2 size={18} />, label: 'Seleccionar' },
    { id: 'line', icon: <Minus size={18} />, label: 'Línea' },
    { id: 'polyline', icon: <Route size={18} />, label: 'Polilínea' },
    { id: 'rect', icon: <Square size={18} />, label: 'Rectángulo' },
    { id: 'circle', icon: <Circle size={18} />, label: 'Círculo' },
    { id: 'add_text_box', icon: <Type size={18} />, label: 'Añadir Caja' },
    { id: 'capture', icon: <Scissors size={18} />, label: 'Capturar zona' },
  ]

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF']
  const widths = [1, 2, 3, 5, 8]

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm">
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => onToolChange(t.id)}
          className={`p-2 rounded hover:bg-gray-100 ${
            tool === t.id ? 'bg-primary-100 text-primary-700' : 'text-gray-600'
          }`}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">Color:</span>
        <div className="relative">
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => onStrokeColorChange(e.target.value)}
            className="w-6 h-6 cursor-pointer border rounded"
            title="Color de trazo"
          />
        </div>
        <div className="flex gap-0.5">
          {colors.slice(0, 4).map((c) => (
            <button
              key={c}
              onClick={() => onStrokeColorChange(c)}
              className={`w-4 h-4 rounded border ${strokeColor === c ? 'ring-2 ring-primary-500' : ''}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">Grosor:</span>
        <select
          value={strokeWidth}
          onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
          className="px-1 py-0.5 text-xs border rounded"
        >
          {widths.map((w) => (
            <option key={w} value={w}>
              {w}px
            </option>
          ))}
        </select>
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">Relleno:</span>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={fillColor !== null}
            onChange={(e) => onFillColorChange(e.target.checked ? '#FFFFFF' : null)}
            className="w-3 h-3"
          />
        </label>
        {fillColor !== null && (
          <input
            type="color"
            value={fillColor}
            onChange={(e) => onFillColorChange(e.target.value)}
            className="w-5 h-5 cursor-pointer border rounded"
            title="Color de relleno"
          />
        )}
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <button
        onClick={onImageModeToggle}
        className={`p-2 rounded hover:bg-gray-100 flex items-center gap-1 text-xs ${
          imageModeActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600'
        }`}
        title="Librería de imágenes"
      >
        <ImagePlus size={18} />
        Imagen
      </button>

      <div className="flex-1" />

      <button
        onClick={onClose}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
        title="Cerrar herramientas de dibujo"
      >
        <X size={18} />
      </button>
    </div>
  )
}
