export const MAX_HAND_BOUND = 104 // 2×52 + 2 Printed Jokers, less indicator and open drop.
export type HandLayout = {
  width: number
  height: number
  cardWidth: number
  cardHeight: number
  rows: number
  columns: number
  stepX: number
  stepY: number
  lift: number
  items: { x: number; y: number; hitWidth: number; hitHeight: number }[]
}
/** Pure geometry: all identities and all disjoint hit regions remain represented. */
export function layoutHand(
  count: number,
  width: number,
  height: number,
): HandLayout {
  const w = Math.max(1, width),
    h = Math.max(1, height),
    padding = Math.min(8, h * 0.1)
  const empty = {
    width: w,
    height: h,
    cardWidth: 0,
    cardHeight: 0,
    rows: 0,
    columns: 0,
    stepX: 0,
    stepY: 0,
    lift: 0,
    items: [],
  }
  if (!count) return empty
  const desired = Math.max(60, 80 - Math.max(0, count - 7) * 1.3)
  let best: HandLayout | undefined
  for (let rows = 1; rows <= count; rows++) {
    const columns = Math.ceil(count / rows)
    const cw = Math.min(
      desired,
      w - Math.max(0, columns - 1) * 20,
      (h - padding - Math.max(0, rows - 1) * 28) / 1.4,
    )
    if (cw < 24) continue
    const ch = cw * 1.4
    const sx = columns === 1 ? 0 : Math.min(cw * 0.7, (w - cw) / (columns - 1))
    const sy =
      rows === 1 ? 0 : Math.min(ch * 0.75, (h - padding - ch) / (rows - 1))
    if ((columns > 1 && sx < 20) || (rows > 1 && sy < 28)) continue
    const usedW = cw + (columns - 1) * sx,
      usedH = ch + (rows - 1) * sy
    const left = (w - usedW) / 2,
      top = padding + (h - padding - usedH) / 2
    const items = Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / columns),
        col = i % columns
      const inRow = Math.min(columns, count - row * columns)
      const rowLeft = left + ((columns - inRow) * sx) / 2
      return {
        x: rowLeft + col * sx,
        y: top + row * sy,
        hitWidth: col === inRow - 1 ? cw : sx,
        hitHeight: row === rows - 1 ? ch : sy,
      }
    })
    const candidate = {
      width: w,
      height: h,
      cardWidth: cw,
      cardHeight: ch,
      rows,
      columns,
      stepX: sx,
      stepY: sy,
      lift: rows > 1 ? 3 : 8,
      items,
    }
    if (
      !best ||
      cw > best.cardWidth + 0.1 ||
      (Math.abs(cw - best.cardWidth) <= 0.1 && rows < best.rows)
    )
      best = candidate
  }
  // Very small keyboard/split windows still get every identity, never hidden cards.
  if (!best) {
    const columns = Math.max(1, Math.ceil(Math.sqrt((count * w) / h)))
    const rows = Math.ceil(count / columns),
      cw = Math.min(w / columns, (h - padding) / rows / 1.4)
    const ch = cw * 1.4
    return {
      width: w,
      height: h,
      cardWidth: cw,
      cardHeight: ch,
      rows,
      columns,
      stepX: cw,
      stepY: ch,
      lift: 0,
      items: Array.from({ length: count }, (_, i) => ({
        x: (i % columns) * cw,
        y: padding + Math.floor(i / columns) * ch,
        hitWidth: cw,
        hitHeight: ch,
      })),
    }
  }
  return best
}
