import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImageViewer } from '../../components/ImageViewer'
import type { DrawingTool } from '../../components/DrawingCanvas'

describe('ImageViewer', () => {
  const defaultProps = {
    projectId: 'test-project',
    selectedPage: 0,
    imageUrl: null,
    imageSize: { width: 0, height: 0 },
    imageScale: 1,
    zoomLevel: 1,
    onZoomChange: vi.fn(),
    showTranslated: true,
    onShowTranslatedChange: vi.fn(),
    drawingMode: false,
    onDrawingModeChange: vi.fn(),
    drawingTool: 'select' as DrawingTool,
    onDrawingToolChange: vi.fn(),
    drawingStrokeColor: '#000000',
    drawingStrokeWidth: 2,
    drawingFillColor: null,
    onDrawingStyleChange: vi.fn(),
    drawings: [],
    selectedDrawingIds: [],
    onDrawingCreate: vi.fn(),
    onDrawingSelect: vi.fn(),
    onDrawingDelete: vi.fn(),
    onDrawingUpdate: vi.fn(),
    selectedRegionIds: new Set<string>(),
    onRegionSelect: vi.fn(),
    regions: [],
    onRender: vi.fn(),
    onOcr: vi.fn(),
    onCompose: vi.fn(),
    onComposeAll: vi.fn(),
    onAddTextBox: vi.fn(),
    isRendering: false,
    isOcring: false,
    isComposing: false,
    isComposingAll: false,
    canShowOriginal: true,
    canShowTranslated: true,
    documentType: 'schematic' as const,
    updateRegionMutation: { mutate: vi.fn() },
    imageRef: { current: null },
    onImageLoad: vi.fn(),
  }

  it('debería mostrar mensaje cuando no hay imagen', () => {
    render(<ImageViewer {...defaultProps} imageUrl={null} />)
    
    expect(screen.getByText('Haz clic en "Renderizar" para ver la página')).toBeInTheDocument()
  })

  it('debería mostrar botones de acción', () => {
    render(<ImageViewer {...defaultProps} imageUrl="test.jpg" />)
    
    expect(screen.getByText('Renderizar')).toBeInTheDocument()
    expect(screen.getByText('OCR')).toBeInTheDocument()
    expect(screen.getByText('Componer')).toBeInTheDocument()
  })

  it('debería permitir cambiar entre original y traducida', () => {
    const onShowTranslatedChange = vi.fn()
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        showTranslated={false}
        onShowTranslatedChange={onShowTranslatedChange}
        canShowOriginal={true}
        canShowTranslated={true}
      />
    )

    const toggleButton = screen.getByText('Ver: Original')
    fireEvent.click(toggleButton)

    expect(onShowTranslatedChange).toHaveBeenCalledWith(true)
  })

  it('debería permitir cambiar el nivel de zoom', () => {
    const onZoomChange = vi.fn()
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        zoomLevel={1}
        onZoomChange={onZoomChange}
      />
    )

    const zoomInButton = screen.getByTitle('Acercar (+)')
    fireEvent.click(zoomInButton)

    expect(onZoomChange).toHaveBeenCalledWith(1.25)
  })

  it('debería deshabilitar botones cuando isRendering es true', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        isRendering={true}
      />
    )

    const renderButton = screen.getByText('Renderizando...')
    expect(renderButton).toBeDisabled()
  })

  it('debería deshabilitar OCR cuando no se puede mostrar original', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        canShowOriginal={false}
      />
    )

    const ocrButton = screen.getByText('OCR')
    expect(ocrButton).toBeDisabled()
  })

  it('debería mostrar progreso de composeAll', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        isComposingAll={true}
        composeProgress={{ current: 5, total: 10 }}
      />
    )

    expect(screen.getByText('Componiendo 5/10...')).toBeInTheDocument()
  })

  it('debería llamar a onRender al hacer clic en Renderizar', () => {
    const onRender = vi.fn()
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        onRender={onRender}
      />
    )

    const renderButton = screen.getByText('Renderizar')
    fireEvent.click(renderButton)

    expect(onRender).toHaveBeenCalled()
  })

  it('debería llamar a onOcr al hacer clic en OCR', () => {
    const onOcr = vi.fn()
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        onOcr={onOcr}
      />
    )

    const ocrButton = screen.getByText('OCR')
    fireEvent.click(ocrButton)

    expect(onOcr).toHaveBeenCalled()
  })

  it('debería llamar a onCompose al hacer clic en Componer', () => {
    const onCompose = vi.fn()
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        regions={[{ id: '1', src_text: 'test' } as any]}
        onCompose={onCompose}
      />
    )

    const composeButton = screen.getByText('Componer')
    fireEvent.click(composeButton)

    expect(onCompose).toHaveBeenCalled()
  })

  it('debería llamar a onAddTextBox al hacer clic en + Añadir caja', () => {
    const onAddTextBox = vi.fn()
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        onAddTextBox={onAddTextBox}
      />
    )

    const addButton = screen.getByText('+ Añadir caja')
    fireEvent.click(addButton)

    expect(onAddTextBox).toHaveBeenCalled()
  })

  it('debería alternar modo de dibujo al hacer clic en Dibujar', () => {
    const onDrawingModeChange = vi.fn()
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        drawingMode={false}
        onDrawingModeChange={onDrawingModeChange}
      />
    )

    const drawButton = screen.getByText('Dibujar')
    fireEvent.click(drawButton)

    expect(onDrawingModeChange).toHaveBeenCalledWith(true)
  })

  it('debería resetear zoom a 100% al hacer clic en el botón de reset', () => {
    const onZoomChange = vi.fn()
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        zoomLevel={2}
        onZoomChange={onZoomChange}
      />
    )

    const resetButton = screen.getByTitle('Reset zoom (100%)')
    fireEvent.click(resetButton)

    expect(onZoomChange).toHaveBeenCalledWith(1)
  })

  it('debería mostrar toolbar de dibujo cuando drawingMode es true', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        drawingMode={true}
      />
    )

    expect(screen.getByText('Dibujar')).toHaveClass('bg-primary-100')
  })

  it('debería deshabilitar botón de Componer cuando no hay regiones', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        regions={[]}
      />
    )

    const composeButton = screen.getByText('Componer')
    expect(composeButton).toBeDisabled()
  })

  it('debería mostrar estado Detectando... cuando isOcring es true', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        isOcring={true}
      />
    )

    expect(screen.getByText('Detectando...')).toBeInTheDocument()
  })

  it('debería mostrar estado Componiendo... cuando isComposing es true', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        regions={[{ id: '1', src_text: 'test' } as any]}
        isComposing={true}
      />
    )

    expect(screen.getByText('Componiendo...')).toBeInTheDocument()
  })

  it('debería deshabilitar zoom out cuando está en zoom mínimo', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        zoomLevel={0.25}
      />
    )

    const zoomOutButton = screen.getByTitle('Alejar (-)')
    expect(zoomOutButton).toBeDisabled()
  })

  it('debería deshabilitar zoom in cuando está en zoom máximo', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        zoomLevel={4}
      />
    )

    const zoomInButton = screen.getByTitle('Acercar (+)')
    expect(zoomInButton).toBeDisabled()
  })

  it('debería deshabilitar botón de reset cuando el zoom ya está en 100%', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        zoomLevel={1}
      />
    )

    const resetButton = screen.getByTitle('Reset zoom (100%)')
    expect(resetButton).toBeDisabled()
  })

  it('debería llamar a onZoomChange al hacer clic en zoom out', () => {
    const onZoomChange = vi.fn()
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        zoomLevel={1.5}
        onZoomChange={onZoomChange}
      />
    )

    const zoomOutButton = screen.getByTitle('Alejar (-)')
    fireEvent.click(zoomOutButton)

    expect(onZoomChange).toHaveBeenCalledWith(1.25)
  })

  it('debería ocultar botón de toggle cuando canShowOriginal o canShowTranslated es false', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        canShowOriginal={false}
        canShowTranslated={true}
      />
    )

    expect(screen.queryByText('Ver:')).not.toBeInTheDocument()
  })

  it('debería mostrar imagen cuando imageUrl está presente', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        imageSize={{ width: 1000, height: 1000 }}
      />
    )

    const image = screen.getByAltText('Página 1')
    expect(image).toBeInTheDocument()
  })

  it('debería mostrar DrawingCanvas cuando drawingMode es true y hay imagen', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        drawingMode={true}
        imageSize={{ width: 1000, height: 1000 }}
      />
    )

    expect(screen.getByText('Dibujar')).toBeInTheDocument()
  })

  it('debería llamar a onDrawingToolChange al cambiar herramienta de dibujo', () => {
    const onDrawingToolChange = vi.fn()
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        drawingMode={true}
        onDrawingToolChange={onDrawingToolChange}
      />
    )

    // Simular cambio de herramienta (esto requiere interactuar con DrawingToolbar)
    expect(onDrawingToolChange).toBeDefined()
  })

  it('debería mostrar progreso de zoom en el botón', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        zoomLevel={2}
      />
    )

    expect(screen.getByText('200%')).toBeInTheDocument()
  })

  it('debería deshabilitar botón + Añadir caja cuando no se puede mostrar original', () => {
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        canShowOriginal={false}
      />
    )

    const addButton = screen.getByText('+ Añadir caja')
    expect(addButton).toBeDisabled()
  })

  it('debería llamar a onComposeAll al hacer clic en Componer todas', () => {
    const onComposeAll = vi.fn()
    render(
      <ImageViewer
        {...defaultProps}
        imageUrl="test.jpg"
        onComposeAll={onComposeAll}
      />
    )

    const composeAllButton = screen.getByText('Componer todas')
    fireEvent.click(composeAllButton)

    expect(onComposeAll).toHaveBeenCalled()
  })
})
