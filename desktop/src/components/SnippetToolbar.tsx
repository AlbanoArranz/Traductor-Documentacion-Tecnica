import { MousePointer2, Minus, Square, Circle, Route, Type, Scissors, Eraser } from 'lucide-react'
import type { DrawingTool } from './DrawingCanvas'

interface SnippetToolbarProps {
  tool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  strokeColor: string
  onStrokeColorChange: (color: string) => void
  strokeWidth: number
  onStrokeWidthChange: (width: number) => void
  fillColor: string | null
  onFillColorChange: (color: string | null) => void
  onCropModeToggle: () => void
  isCropMode: boolean
  eraserRadius?: number
  onEraserRadiusChange?: (radius: number) => void
}

const TOOL_OPTIONS: Array<{ id: DrawingTool; label: string; icon: JSX.Element }> = [
  { id: 'select', label: 'Seleccionar', icon: <MousePointer2 size={14} /> },
  { id: 'line', label: 'Línea', icon: <Minus size={14} /> },
  { id: 'polyline', label: 'Polilínea', icon: <Route size={14} /> },
  { id: 'rect', label: 'Rectángulo', icon: <Square size={14} /> },
  { id: 'circle', label: 'Círculo', icon: <Circle size={14} /> },
  { id: 'add_text_box', label: 'Texto', icon: <Type size={14} /> },
  { id: 'eraser', label: 'Borrador', icon: <Eraser size={14} /> },
]

export function SnippetToolbar({
  tool,
  onToolChange,
  strokeColor,
  onStrokeColorChange,
  strokeWidth,
  onStrokeWidthChange,
  fillColor,
  onFillColorChange,
  onCropModeToggle,
  isCropMode,
  eraserRadius = 20,
  onEraserRadiusChange,
}: SnippetToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 border-b text-xs">
      {TOOL_OPTIONS.map((t) => (
        <button
          key={String(t.id)}
          type="button"
          onClick={() => onToolChange(t.id)}
          className={`px-2 py-1 border rounded flex items-center gap-1 ${
            tool === t.id && !isCropMode
              ? 'bg-primary-100 text-primary-700 border-primary-300'
              : 'hover:bg-gray-100'
          }`}
          title={t.label}
        >
          {t.icon}
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
      <div className="w-px h-6 bg-gray-300 mx-1" />
      <button
        type="button"
        onClick={onCropModeToggle}
        className={`px-2 py-1 border rounded flex items-center gap-1 ${
          isCropMode ? 'bg-orange-100 text-orange-700 border-orange-300' : 'hover:bg-gray-100'
        }`}
        title="Recortar y copiar zona"
      >
        <Scissors size={14} />
        <span className="hidden sm:inline">Recortar</span>
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1" />
      {/* Eraser radius control - only visible when eraser tool is selected */}
      {tool === 'eraser' && onEraserRadiusChange && (
        <label className="flex items-center gap-1" title="Radio del borrador">
          <span className="text-gray-600">Radio</span>
          <input
            type="range"
            min="5"
            max="100"
            value={eraserRadius}
            onChange={(e) => onEraserRadiusChange(Number(e.target.value))}
            className="w-16 cursor-pointer"
          />
          <span className="text-gray-500 w-8">{eraserRadius}px</span>
        </label>
      )}
      {tool !== 'eraser' && (
        <>
          <label className="flex items-center gap-1" title="Color de trazo">
            <span className="text-gray-600">Trazo</span>
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => onStrokeColorChange(e.target.value)}
              className="w-6 h-6 border rounded cursor-pointer"
            />
          </label>
          <label className="flex items-center gap-1" title="Grosor">
            <span className="text-gray-600">Grosor</span>
            <select
              className="border rounded px-1 py-0.5"
              value={strokeWidth}
              onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            >
              {[1, 2, 3, 5, 8].map((w) => (
                <option key={w} value={w}>
                  {w}px
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1" title="Relleno">
            <input
              type="checkbox"
              checked={fillColor !== null}
              onChange={(e) => onFillColorChange(e.target.checked ? '#ffffff' : null)}
              className="cursor-pointer"
            />
            <span className="text-gray-600">Relleno</span>
          </label>
          {fillColor !== null && (
            <input
              type="color"
              value={fillColor}
              onChange={(e) => onFillColorChange(e.target.value)}
              className="w-6 h-6 border rounded cursor-pointer"
            />
          )}
        </>
      )}
    </div>
  )
}
