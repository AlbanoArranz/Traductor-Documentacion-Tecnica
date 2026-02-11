import type { DrawingElement } from '../lib/api'

interface DrawingOverlayProps {
  drawings: DrawingElement[]
  scale?: number
}

export function DrawingOverlay({ drawings, scale = 1 }: DrawingOverlayProps) {
  if (!drawings || drawings.length === 0) {
    return null
  }

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      {drawings.map((drawing) => {
        const strokeColor = drawing.stroke_color || '#000000'
        const strokeWidth = (drawing.stroke_width || 2) * scale
        const fillColor = drawing.fill_color || null

        switch (drawing.element_type) {
          case 'line': {
            if (drawing.points && drawing.points.length >= 4) {
              const [x1, y1, x2, y2] = drawing.points
              return (
                <line
                  key={drawing.id}
                  x1={x1 * scale}
                  y1={y1 * scale}
                  x2={x2 * scale}
                  y2={y2 * scale}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
              )
            }
            return null
          }

          case 'polyline': {
            if (drawing.points && drawing.points.length >= 4 && drawing.points.length % 2 === 0) {
              const points = drawing.points.map((coord, i) => {
                if (i % 2 === 0) {
                  return coord * scale
                }
                return coord * scale
              })
              const pointsStr = points.map((coord, i) => {
                if (i % 2 === 0) {
                  return coord
                }
                return coord
              }).join(',')
              return (
                <polyline
                  key={drawing.id}
                  points={pointsStr}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )
            }
            return null
          }

          case 'rect': {
            if (drawing.points && drawing.points.length >= 4) {
              const [x1, y1, x2, y2] = drawing.points
              const width = (x2 - x1) * scale
              const height = (y2 - y1) * scale
              return (
                <rect
                  key={drawing.id}
                  x={x1 * scale}
                  y={y1 * scale}
                  width={width}
                  height={height}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill={fillColor || 'none'}
                />
              )
            }
            return null
          }

          case 'circle': {
            if (drawing.points && drawing.points.length >= 4) {
              const [x1, y1, x2, y2] = drawing.points
              const cx = ((x1 + x2) / 2) * scale
              const cy = ((y1 + y2) / 2) * scale
              const rx = Math.abs((x2 - x1) / 2) * scale
              const ry = Math.abs((y2 - y1) / 2) * scale
              return (
                <ellipse
                  key={drawing.id}
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill={fillColor || 'none'}
                />
              )
            }
            return null
          }

          case 'image': {
            if (drawing.image_data && drawing.points && drawing.points.length >= 4) {
              const [x1, y1, x2, y2] = drawing.points
              const width = (x2 - x1) * scale
              const height = (y2 - y1) * scale
              return (
                <image
                  key={drawing.id}
                  x={x1 * scale}
                  y={y1 * scale}
                  width={width}
                  height={height}
                  href={`data:image/png;base64,${drawing.image_data}`}
                  preserveAspectRatio="none"
                />
              )
            }
            return null
          }

          case 'text': {
            if (drawing.text && drawing.points && drawing.points.length >= 2) {
              const [x, y] = drawing.points
              const fontSize = (drawing.font_size || 14) * scale
              return (
                <text
                  key={drawing.id}
                  x={x * scale}
                  y={y * scale}
                  fontSize={fontSize}
                  fill={drawing.text_color || '#000000'}
                  fontFamily={drawing.font_family || 'Arial'}
                >
                  {drawing.text}
                </text>
              )
            }
            return null
          }

          default:
            return null
        }
      })}
    </svg>
  )
}
