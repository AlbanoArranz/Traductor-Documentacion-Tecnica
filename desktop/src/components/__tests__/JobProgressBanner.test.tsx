import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JobProgressBanner } from '../../components/JobProgressBanner'

describe('JobProgressBanner', () => {
  it('debería renderizarse cuando hay un jobId activo', () => {
    render(
      <JobProgressBanner
        jobId="test-job-123"
        progress={0.5}
        step="Procesando página..."
      />
    )

    expect(screen.getByText('Procesando página...')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('no debería renderizarse cuando no hay jobId', () => {
    const { container } = render(
      <JobProgressBanner
        jobId={null}
        progress={0}
        step=""
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('debería mostrar el porcentaje correcto', () => {
    render(
      <JobProgressBanner
        jobId="test-job-123"
        progress={0.75}
        step="Componiendo..."
      />
    )

    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})
