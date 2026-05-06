/**
 * Custom Recharts bar shape that rounds the topmost positive bar's top corners
 * and the bottommost bar's bottom corners. Bars in the middle of a stack
 * render as plain rectangles for clean visual stacking.
 */
export function RoundedBar(props: {
  x: number
  y: number
  width: number
  height: number
  fill?: string
  dataKey: string
  payload?: { topPositiveBar: string | null }
}) {
  const { x, y, width, height, fill, dataKey, payload } = props
  if (!height || height === 0) return null

  const topRadius = 4
  const bottomRadius = 2

  const isTopBar = payload?.topPositiveBar === dataKey
  const isBottomBar = dataKey === 'supplyApyBar'

  const tl = isTopBar ? topRadius : 0
  const tr = isTopBar ? topRadius : 0
  const br = isBottomBar ? bottomRadius : 0
  const bl = isBottomBar ? bottomRadius : 0

  const path = `
    M ${x + tl} ${y}
    L ${x + width - tr} ${y}
    Q ${x + width} ${y} ${x + width} ${y + tr}
    L ${x + width} ${y + height - br}
    Q ${x + width} ${y + height} ${x + width - br} ${y + height}
    L ${x + bl} ${y + height}
    Q ${x} ${y + height} ${x} ${y + height - bl}
    L ${x} ${y + tl}
    Q ${x} ${y} ${x + tl} ${y}
    Z
  `

  return <path d={path} fill={fill ?? "currentColor"} />
}
