import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TextRegionsPanel } from '../../components/TextRegionsPanel'
import type { TextRegion } from '../../lib/api'

describe('TextRegionsPanel', () => {
  const defaultProps = {
    projectId: 'test-project',
    selectedPage: 0,
    regions: [] as TextRegion[],
    selectedRegionIds: new Set<string>(),
    onRegionSelect: vi.fn(),
    onRegionUpdate: vi.fn(),
    onRegionDelete: vi.fn(),
    onBulkDelete: vi.fn(),
    projectOcrFilters: [],
    onProjectOcrFiltersChange: vi.fn(),
    onSaveProjectOcrFilters: vi.fn(),
    regionFilterText: '',
    onRegionFilterTextChange: vi.fn(),
    regionFilterMode: 'contains' as const,
    onRegionFilterModeChange: vi.fn(),
    regionFilterField: 'src' as const,
    onRegionFilterFieldChange: vi.fn(),
    regionFilterCaseSensitive: false,
    onRegionFilterCaseSensitiveChange: vi.fn(),
    showOnlyFiltered: false,
    onShowOnlyFilteredChange: vi.fn(),
    deleteScope: 'page' as const,
    onDeleteScopeChange: vi.fn(),
    isBulkDeleting: false,
    bulkDeleteProgress: undefined,
    confirmDeleteFiltered: false,
    onConfirmDeleteFilteredChange: vi.fn(),
    filteredRegions: [] as TextRegion[],
  }

  it('debería renderizar el panel de regiones', () => {
    render(<TextRegionsPanel {...defaultProps} />)
    
    expect(screen.getByText('Regiones de texto (0)')).toBeInTheDocument()
  })

  it('debería mostrar el contador de regiones', () => {
    const regions: TextRegion[] = [
      { id: '1', page_number: 0, src_text: 'Test 1', tgt_text: 'Prueba 1', locked: false, bbox: [0,0,100,20], bbox_normalized: [0,0,0.1,0.02], confidence: 0.9, needs_review: false, compose_mode: 'patch' as const, font_size: 12, render_order: 0, font_family: 'Arial' } as any,
      { id: '2', page_number: 0, src_text: 'Test 2', tgt_text: 'Prueba 2', locked: false, bbox: [0,20,100,40], bbox_normalized: [0,0.02,0.1,0.04], confidence: 0.9, needs_review: false, compose_mode: 'patch' as const, font_size: 12, render_order: 0, font_family: 'Arial' } as any,
    ]
    render(<TextRegionsPanel {...defaultProps} regions={regions} />)
    
    expect(screen.getByText('Regiones de texto (2)')).toBeInTheDocument()
  })

  it('debería mostrar filtros OCR del proyecto', () => {
    const filters = [
      { mode: 'contains' as const, pattern: 'test', case_sensitive: false },
    ]
    render(<TextRegionsPanel {...defaultProps} projectOcrFilters={filters} />)
    
    expect(screen.getByText('1 filtros definidos')).toBeInTheDocument()
  })

  it('debería mostrar el campo de filtrado de texto', () => {
    render(<TextRegionsPanel {...defaultProps} />)
    
    const filterInput = screen.getByPlaceholderText('Filtrar...')
    expect(filterInput).toBeInTheDocument()
  })

  it('debería llamar a onRegionFilterTextChange al escribir en el filtro', () => {
    const onRegionFilterTextChange = vi.fn()
    render(<TextRegionsPanel {...defaultProps} onRegionFilterTextChange={onRegionFilterTextChange} />)
    
    const filterInput = screen.getByPlaceholderText('Filtrar...')
    fireEvent.change(filterInput, { target: { value: 'test' } })
    
    expect(onRegionFilterTextChange).toHaveBeenCalledWith('test')
  })

  it('debería mostrar regiones filtradas', () => {
    const regions: TextRegion[] = [
      { id: '1', page_number: 0, src_text: 'Test 1', tgt_text: 'Prueba 1', locked: false, bbox: [0,0,100,20], bbox_normalized: [0,0,0.1,0.02], confidence: 0.9, needs_review: false, compose_mode: 'patch' as const, font_size: 12, render_order: 0, font_family: 'Arial' } as any,
      { id: '2', page_number: 0, src_text: 'Other', tgt_text: 'Otro', locked: false, bbox: [0,20,100,40], bbox_normalized: [0,0.02,0.1,0.04], confidence: 0.9, needs_review: false, compose_mode: 'patch' as const, font_size: 12, render_order: 0, font_family: 'Arial' } as any,
    ]
    const filteredRegions: TextRegion[] = [regions[0]]
    render(
      <TextRegionsPanel
        {...defaultProps}
        regions={regions}
        filteredRegions={filteredRegions}
        regionFilterText="Test"
        showOnlyFiltered={true}
      />
    )
    
    expect(screen.getByText('Test 1')).toBeInTheDocument()
    expect(screen.queryByText('Other')).not.toBeInTheDocument()
  })

  it('debería llamar a onRegionFilterCaseSensitiveChange al cambiar el checkbox', () => {
    const onRegionFilterCaseSensitiveChange = vi.fn()
    render(
      <TextRegionsPanel
        {...defaultProps}
        onRegionFilterCaseSensitiveChange={onRegionFilterCaseSensitiveChange}
      />
    )

    const checkbox = screen.getByLabelText('Mayúsculas')
    fireEvent.click(checkbox)

    expect(onRegionFilterCaseSensitiveChange).toHaveBeenCalledWith(true)
  })

  it('debería llamar a onShowOnlyFilteredChange al cambiar el checkbox', () => {
    const onShowOnlyFilteredChange = vi.fn()
    render(
      <TextRegionsPanel
        {...defaultProps}
        regionFilterText="test"
        onShowOnlyFilteredChange={onShowOnlyFilteredChange}
      />
    )

    const checkbox = screen.getByLabelText('Ver solo filtradas')
    fireEvent.click(checkbox)

    expect(onShowOnlyFilteredChange).toHaveBeenCalledWith(true)
  })

  it('debería llamar a onDeleteScopeChange al cambiar el checkbox de todas las páginas', () => {
    const onDeleteScopeChange = vi.fn()
    render(
      <TextRegionsPanel
        {...defaultProps}
        onDeleteScopeChange={onDeleteScopeChange}
      />
    )

    const checkbox = screen.getByLabelText('Aplicar a todas las páginas')
    fireEvent.click(checkbox)

    expect(onDeleteScopeChange).toHaveBeenCalledWith('all')
  })

  it('debería mostrar progreso de eliminación masiva', () => {
    render(
      <TextRegionsPanel
        {...defaultProps}
        isBulkDeleting={true}
        bulkDeleteProgress={{ current: 5, total: 10 }}
        deleteScope="page"
      />
    )

    expect(screen.getByText('Progreso: 5/10 regiones')).toBeInTheDocument()
  })

  it('debería mostrar botón de eliminación deshabilitado cuando no hay texto de filtro', () => {
    render(
      <TextRegionsPanel
        {...defaultProps}
        regionFilterText=""
      />
    )

    const deleteButton = screen.getByText('Eliminar filtradas')
    expect(deleteButton).toBeDisabled()
  })

  it('debería mostrar botón de eliminación habilitado cuando hay texto de filtro y regiones', () => {
    render(
      <TextRegionsPanel
        {...defaultProps}
        regionFilterText="test"
        filteredRegions={[{ id: '1', src_text: 'test' } as any]}
      />
    )

    const deleteButton = screen.getByText('Eliminar filtradas')
    expect(deleteButton).not.toBeDisabled()
  })

  it('debería seleccionar región al hacer clic', () => {
    const onRegionSelect = vi.fn()
    const regions: TextRegion[] = [
      { id: '1', page_number: 0, src_text: 'Test 1', tgt_text: 'Prueba 1', locked: false, bbox: [0,0,100,20], bbox_normalized: [0,0,0.1,0.02], confidence: 0.9, needs_review: false, compose_mode: 'patch' as const, font_size: 12, render_order: 0, font_family: 'Arial' } as any,
    ]
    render(
      <TextRegionsPanel
        {...defaultProps}
        regions={regions}
        onRegionSelect={onRegionSelect}
      />
    )

    const regionElement = screen.getByText('Test 1').closest('div')
    fireEvent.click(regionElement!)

    expect(onRegionSelect).toHaveBeenCalled()
  })

  it('debería alternar selección con Ctrl+click', () => {
    const onRegionSelect = vi.fn()
    const regions: TextRegion[] = [
      { id: '1', page_number: 0, src_text: 'Test 1', tgt_text: 'Prueba 1', locked: false, bbox: [0,0,100,20], bbox_normalized: [0,0,0.1,0.02], confidence: 0.9, needs_review: false, compose_mode: 'patch' as const, font_size: 12, render_order: 0, font_family: 'Arial' } as any,
    ]
    render(
      <TextRegionsPanel
        {...defaultProps}
        regions={regions}
        selectedRegionIds={new Set()}
        onRegionSelect={onRegionSelect}
      />
    )

    const regionElement = screen.getByText('Test 1').closest('div')
    fireEvent.click(regionElement!, { ctrlKey: true })

    expect(onRegionSelect).toHaveBeenCalled()
  })

  it('debería cambiar modo de filtro al seleccionar opción', () => {
    const onRegionFilterModeChange = vi.fn()
    render(
      <TextRegionsPanel
        {...defaultProps}
        onRegionFilterModeChange={onRegionFilterModeChange}
      />
    )

    const select = screen.getByDisplayValue('Contiene')
    fireEvent.change(select, { target: { value: 'starts' } })

    expect(onRegionFilterModeChange).toHaveBeenCalledWith('starts')
  })

  it('debería cambiar campo de filtro al seleccionar opción', () => {
    const onRegionFilterFieldChange = vi.fn()
    render(
      <TextRegionsPanel
        {...defaultProps}
        onRegionFilterFieldChange={onRegionFilterFieldChange}
      />
    )

    const select = screen.getByDisplayValue('Texto ZH')
    fireEvent.change(select, { target: { value: 'tgt' } })

    expect(onRegionFilterFieldChange).toHaveBeenCalledWith('tgt')
  })

  it('debería llamar a onRegionUpdate al hacer clic en botón de bloqueo/desbloqueo', () => {
    const onRegionUpdate = vi.fn()
    const regions: TextRegion[] = [
      { id: '1', page_number: 0, src_text: 'Test 1', tgt_text: 'Prueba 1', locked: false, bbox: [0,0,100,20], bbox_normalized: [0,0,0.1,0.02], confidence: 0.9, needs_review: false, compose_mode: 'patch' as const, font_size: 12, render_order: 0, font_family: 'Arial' } as any,
    ]
    render(
      <TextRegionsPanel
        {...defaultProps}
        regions={regions}
        onRegionUpdate={onRegionUpdate}
      />
    )

    const lockButton = screen.getByTitle('Bloquear')
    fireEvent.click(lockButton)

    expect(onRegionUpdate).toHaveBeenCalledWith('1', { locked: true })
  })

  it('debería llamar a onRegionDelete al hacer clic en botón de eliminar', () => {
    const onRegionDelete = vi.fn()
    const regions: TextRegion[] = [
      { id: '1', page_number: 0, src_text: 'Test 1', tgt_text: 'Prueba 1', locked: false, bbox: [0,0,100,20], bbox_normalized: [0,0,0.1,0.02], confidence: 0.9, needs_review: false, compose_mode: 'patch' as const, font_size: 12, render_order: 0, font_family: 'Arial' } as any,
    ]
    render(
      <TextRegionsPanel
        {...defaultProps}
        regions={regions}
        onRegionDelete={onRegionDelete}
      />
    )

    const deleteButton = screen.getByTitle('Eliminar región')
    fireEvent.click(deleteButton)

    expect(onRegionDelete).toHaveBeenCalledWith('1')
  })
})
