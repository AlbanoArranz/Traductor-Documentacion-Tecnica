import { Link } from 'react-router-dom'
import { ArrowLeft, Book, Play, Download, Undo2, Redo2 } from 'lucide-react'

interface ProjectHeaderProps {
  projectId: string
  projectName: string
  documentType?: 'schematic' | 'manual'
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onProcessAll: () => void
  isProcessing: boolean
  onExport: () => void
  isExporting: boolean
}

export function ProjectHeader({
  projectId,
  projectName,
  documentType,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onProcessAll,
  isProcessing,
  onExport,
  isExporting,
}: ProjectHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{projectName}</h1>
          {documentType && (
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                documentType === 'manual'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
              title={
                documentType === 'manual'
                  ? 'Manual técnico: párrafos, texto corrido'
                  : 'Esquema eléctrico: texto disperso, cajas individuales'
              }
            >
              {documentType === 'manual' ? '📄 Manual' : '🔌 Esquema'}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 text-sm border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Deshacer (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={onRedo}
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
          onClick={onProcessAll}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Play size={18} />
          Procesar Todo
        </button>
        <button
          onClick={onExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
        >
          <Download size={18} />
          Exportar PDF
        </button>
      </div>
    </header>
  )
}
