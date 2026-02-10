import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ProjectHeader } from '../../components/ProjectHeader'

describe('ProjectHeader', () => {
  it('debería renderizar el nombre del proyecto', () => {
    render(
      <BrowserRouter>
        <ProjectHeader
          projectId="test-project"
          projectName="Mi Proyecto"
          documentType="schematic"
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          canUndo={true}
          canRedo={false}
          onProcessAll={vi.fn()}
          isProcessing={false}
          onExport={vi.fn()}
          isExporting={false}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('Mi Proyecto')).toBeInTheDocument()
  })

  it('debería mostrar el tipo de documento', () => {
    render(
      <BrowserRouter>
        <ProjectHeader
          projectId="test-project"
          projectName="Mi Proyecto"
          documentType="manual"
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          canUndo={true}
          canRedo={false}
          onProcessAll={vi.fn()}
          isProcessing={false}
          onExport={vi.fn()}
          isExporting={false}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('📄 Manual')).toBeInTheDocument()
  })

  it('debería deshabilitar botones cuando canUndo/canRedo es false', () => {
    render(
      <BrowserRouter>
        <ProjectHeader
          projectId="test-project"
          projectName="Mi Proyecto"
          documentType="schematic"
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          canUndo={false}
          canRedo={false}
          onProcessAll={vi.fn()}
          isProcessing={false}
          onExport={vi.fn()}
          isExporting={false}
        />
      </BrowserRouter>
    )

    const undoButton = screen.getByTitle('Deshacer (Ctrl+Z)')
    const redoButton = screen.getByTitle('Rehacer (Ctrl+Y)')
    
    expect(undoButton).toBeDisabled()
    expect(redoButton).toBeDisabled()
  })

  it('debería mostrar estado de procesamiento', () => {
    render(
      <BrowserRouter>
        <ProjectHeader
          projectId="test-project"
          projectName="Mi Proyecto"
          documentType="schematic"
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          canUndo={true}
          canRedo={false}
          onProcessAll={vi.fn()}
          isProcessing={true}
          onExport={vi.fn()}
          isExporting={false}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('Procesar Todo')).toBeDisabled()
  })
})
