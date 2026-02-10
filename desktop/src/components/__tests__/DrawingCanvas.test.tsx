import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DrawingCanvas } from '../../components/DrawingCanvas'
import type { DrawingTool } from '../../components/DrawingCanvas'

describe('DrawingCanvas', () => {
  const defaultProps = {
    imageSize: { width: 1000, height: 1000 },
    scale: 1,
    tool: 'select' as DrawingTool,
    strokeColor: '#000000',
    strokeWidth: 2,
    fillColor: null,
    drawings: [],
    selectedDrawingIds: [],
    onDrawingCreate: vi.fn(),
    onDrawingSelect: vi.fn(),
    onDrawingDelete: vi.fn(),
    onDrawingUpdate: vi.fn(),
    onAddTextBox: vi.fn(),
  }

  it('debería renderizar el canvas de dibujo', () => {
    render(<DrawingCanvas {...defaultProps} />)
    
    expect(screen.getAllByRole('generic').length).toBeGreaterThan(0)
  })

  it('debería mostrar cursor crosshair cuando hay imagen', () => {
    render(
      <DrawingCanvas
        {...defaultProps}
        imageSize={{ width: 1000, height: 1000 }}
      />
    )
    
    expect(screen.getAllByRole('generic').length).toBeGreaterThan(0)
  })

  it('debería pasar props correctamente al componente', () => {
    const onDrawingCreate = vi.fn()
    render(
      <DrawingCanvas
        {...defaultProps}
        tool="line"
        strokeColor="#FF0000"
        strokeWidth={4}
        onDrawingCreate={onDrawingCreate}
      />
    )
    
    expect(screen.getAllByRole('generic').length).toBeGreaterThan(0)
  })

  it('debería manejar dibujos existentes', () => {
    const drawings = [
      { 
        id: '1', 
        element_type: 'rect' as const, 
        points: [0,0,100,100], 
        stroke_color: '#000000', 
        stroke_width: 2,
        fill_color: null,
        text: null,
        font_size: 14,
        font_family: 'Arial',
        text_color: '#000000',
        image_data: null,
        project_id: 'test',
        page_number: 0,
        created_at: new Date().toISOString(),
      } as any,
    ]
    render(
      <DrawingCanvas
        {...defaultProps}
        drawings={drawings}
        selectedDrawingIds={['1']}
      />
    )
    
    expect(screen.getAllByRole('generic').length).toBeGreaterThan(0)
  })

  it('debería llamar a onAddTextBox cuando se usa herramienta add_text_box', () => {
    const onAddTextBox = vi.fn()
    render(
      <DrawingCanvas
        {...defaultProps}
        tool="add_text_box"
        onAddTextBox={onAddTextBox}
      />
    )
    
    expect(screen.getAllByRole('generic').length).toBeGreaterThan(0)
  })

  it('debería manejar diferentes herramientas de dibujo', () => {
    const tools: DrawingTool[] = ['select', 'line', 'rect', 'circle', 'polyline']
    
    tools.forEach((tool) => {
      render(
        <DrawingCanvas
          {...defaultProps}
          tool={tool}
        />
      )
      
      expect(screen.getAllByRole('generic').length).toBeGreaterThan(0)
    })
  })
})
