import type { DrawingElement } from '../lib/api'

interface DrawingOverlayProps {
  imageSize: { width: number; height: number }
  scale: number
  drawings: DrawingElement[]
}

export function DrawingOverlay({ imageSize, scale, drawings }: DrawingOverlayProps) {
  if (!drawings || drawings.length === 0) return null

  const renderDrawing = (d: DrawingElement) => {
    if (d.element_type === 'line') {
      const [x1, y1, x2, y2] = d.points
      return (
        <line
          key={d.id}
          x1={x1 * scale}
          y1={y1 * scale}
          x2={x2 * scale}
          y2={y2 * scale}
          stroke={d.stroke_color}
          strokeWidth={d.stroke_width}
          style={{ pointerEvents: 'none' }}
        />
      )
    }

    if (d.element_type === 'polyline') {
      if (d.points.length >= 4 && d.points.length % 2 === 0) {
        const points = d.points
          .map((p, i) => (i % 2 === 0 ? `${p * scale},${d.points[i + 1] * scale}` : null))
          .filter(Boolean)
          .join(' ')
        return (
          <polyline
            key={d.id}
            points={points}
            fill="none"
            stroke={d.stroke_color}
            strokeWidth={d.stroke_width}
            style={{ pointerEvents: 'none' }}
          />
        )
      }
      return null
    }

    if (d.element_type === 'rect') {
      const [x1, y1, x2, y2] = d.points
      const x = Math.min(x1, x2) * scale
      const y = Math.min(y1, y2) * scale
      const width = Math.abs(x2 - x1) * scale
      const height = Math.abs(y2 - y1) * scale
      return (
        <rect
          key={d.id}
          x={x}
          y={y}
          width={width}
          height={height}
          fill={d.fill_color || 'none'}
          stroke={d.stroke_color}
          strokeWidth={d.stroke_width}
          style={{ pointerEvents: 'none' }}
        />
      )
    }

    if (d.element_type === 'circle') {
      const [x1, y1, x2, y2] = d.points
      const cx = ((x1 + x2) / 2) * scale
      const cy = ((y1 + y2) / 2) * scale
      const rx = (Math.abs(x2 - x1) / 2) * scale
      const ry = (Math.abs(y2 - y1) / 2) * scale
      return (
        <ellipse
          key={d.id}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill={d.fill_color || 'none'}
          stroke={d.stroke_color}
          strokeWidth={d.stroke_width}
          style={{ pointerEvents: 'none' }}
        />
      )
    }

    if (d.element_type === 'text' && d.text) {
      const [x, y] = d.points
      return (
        <text
          key={d.id}
          x={x * scale}
          y={y * scale}
          fill={d.text_color}
          fontSize={d.font_size}
          fontFamily={d.font_family}
          style={{ pointerEvents: 'none' }}
        >
          {d.text}
        </text>
      )
    }

    return null
  }

  return (
    <svg
      width={imageSize.width * scale}
      height={imageSize.height * scale}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {drawings.map(renderDrawing)}
    </svg>
  )
}
