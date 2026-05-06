import { formatCompact, getNumericValue } from "./format-utils"

interface NegativeLabelProps {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: number | string
}

/**
 * Renders the negative-total label below a bar's bottom edge.
 */
export function NegativeLabel(props: NegativeLabelProps) {
  const { x, y, width, height, value } = props
  const valueAmount = getNumericValue(value)
  if (valueAmount === null || valueAmount >= 0) return null

  const xValue = getNumericValue(x)
  const yValue = getNumericValue(y)
  const widthValue = getNumericValue(width)
  const heightValue = getNumericValue(height)
  if (xValue === null || yValue === null || widthValue === null || heightValue === null) return null

  // For negative bars, height can be negative (bar extends upward from y).
  // Get the visual bottom of the bar (largest Y value).
  const barBottom = heightValue >= 0 ? yValue + heightValue : yValue
  const labelY = barBottom + 6
  const labelX = xValue + widthValue / 2

  return (
    <text
      x={labelX}
      y={labelY}
      textAnchor="middle"
      dominantBaseline="hanging"
      style={{ fontSize: 9, fill: "white", fontWeight: 500 }}
    >
      {formatCompact(valueAmount)}
    </text>
  )
}

/**
 * Factory: produces a positive-total label renderer that has access to the
 * chart data array (so it can read the per-row `isLive` flag by index).
 */
export function createPositiveLabelRenderer(chartData: Array<{ isLive: boolean }>) {
  return function PositiveLabel(props: {
    x?: number | string
    y?: number | string
    width?: number | string
    value?: number | string
    index?: number
  }) {
    const { x, y, width, value, index } = props
    const valueAmount = getNumericValue(value)
    if (valueAmount === null || valueAmount <= 0) return null

    const xValue = getNumericValue(x)
    const yValue = getNumericValue(y)
    const widthValue = getNumericValue(width)
    if (xValue === null || yValue === null || widthValue === null) return null

    const isLive = typeof index === "number" ? chartData[index]?.isLive : false

    const labelX = xValue + widthValue / 2
    const labelY = yValue - 6

    return (
      <g>
        {isLive && (
          <g>
            <rect
              x={labelX - 16}
              y={labelY - 26}
              width={32}
              height={13}
              rx={3}
              fill="rgba(16, 185, 129, 0.15)"
            />
            <text
              x={labelX}
              y={labelY - 19}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: 9, fill: "#10b981", fontWeight: 600 }}
            >
              Live
            </text>
          </g>
        )}
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="auto"
          style={{ fontSize: 9, fill: "white", fontWeight: 500 }}
        >
          {formatCompact(valueAmount)}
        </text>
      </g>
    )
  }
}
