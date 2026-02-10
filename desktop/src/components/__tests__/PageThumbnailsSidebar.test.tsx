import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PageThumbnailsSidebar } from '../../components/PageThumbnailsSidebar'

describe('PageThumbnailsSidebar', () => {
  it('debería renderizar miniaturas de páginas', () => {
    render(
      <PageThumbnailsSidebar
        projectId="test-project"
        pageCount={5}
        selectedPage={2}
        onPageSelect={vi.fn()}
      />
    )

    const thumbnails = screen.getAllByRole('button')
    expect(thumbnails).toHaveLength(5)
  })

  it('debería resaltar la página seleccionada', () => {
    render(
      <PageThumbnailsSidebar
        projectId="test-project"
        pageCount={5}
        selectedPage={2}
        onPageSelect={vi.fn()}
      />
    )

    const selectedThumbnail = screen.getAllByRole('button')[2]
    expect(selectedThumbnail).toHaveClass('border-primary-500')
  })

  it('debería llamar a onPageSelect al hacer clic en una miniatura', () => {
    const onPageSelect = vi.fn()
    render(
      <PageThumbnailsSidebar
        projectId="test-project"
        pageCount={5}
        selectedPage={2}
        onPageSelect={onPageSelect}
      />
    )

    const thumbnail = screen.getAllByRole('button')[3]
    thumbnail.click()

    expect(onPageSelect).toHaveBeenCalledWith(3)
  })

  it('debería mostrar fallback cuando la imagen falla al cargar', () => {
    render(
      <PageThumbnailsSidebar
        projectId="test-project"
        pageCount={5}
        selectedPage={2}
        onPageSelect={vi.fn()}
      />
    )

    const images = screen.getAllByAltText(/Página \d+/)
    const firstImage = images[0] as HTMLImageElement
    
    // Simular error de carga
    fireEvent.error(firstImage)
    
    // Verificar que el elemento img esté oculto
    expect(firstImage.style.display).toBe('none')
  })
})
