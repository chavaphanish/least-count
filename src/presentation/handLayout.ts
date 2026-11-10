export const MAX_HAND_BOUND = 104 // Conservative two-deck supply, less indicator and opening Drop.
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
  compact: boolean
  items: { x: number; y: number; hitWidth: number; hitHeight: number }[]
}
/** One fixed row. Small exposed strips are reported honestly, never replaced by extra rows. */
export function layoutHand(
  count: number,
  width: number,
  height: number,
): HandLayout {
  const w = Math.max(1, width),
    h = Math.max(1, height)
  if (!count)
    return {
      width: w,
      height: h,
      cardWidth: 0,
      cardHeight: 0,
      rows: 0,
      columns: 0,
      stepX: 0,
      stepY: 0,
      lift: 0,
      compact: false,
      items: [],
    }
  const desired = Math.max(52, 80 - Math.max(0, count - 7) * 1.2)
  let reserve = Math.min(8, h * 0.1)
  let cw = Math.min(desired, w, (h - reserve) / 1.4)
  let step = count === 1 ? 0 : Math.min(cw * 0.72, (w - cw) / (count - 1))
  const compact = count > 1 && step < 18
  if (compact) {
    reserve = Math.min(34, h * 0.3)
    cw = Math.min(desired, w, (h - reserve) / 1.4)
    step = Math.min(cw * 0.72, (w - cw) / (count - 1))
  }
  const ch = cw * 1.4,
    left = (w - cw - (count - 1) * step) / 2,
    top = reserve + (h - reserve - ch) / 2
  return {
    width: w,
    height: h,
    cardWidth: cw,
    cardHeight: ch,
    rows: 1,
    columns: count,
    stepX: step,
    stepY: 0,
    lift: Math.min(8, reserve),
    compact,
    items: Array.from({ length: count }, (_, i) => ({
      x: left + i * step,
      y: top,
      hitWidth: i === count - 1 ? cw : step,
      hitHeight: ch,
    })),
  }
}
