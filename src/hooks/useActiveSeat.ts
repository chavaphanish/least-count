import { useEffect } from 'react'

/** Keep the active opponent visible in narrow tables without moving the page. */
export function useActiveSeat(current: string | number | undefined) {
  useEffect(() => {
    const row = document.querySelector<HTMLElement>('.opponent-row')
    if (!row) return
    const centerSeat = () => {
      const seat = row.querySelector<HTMLElement>('.active-seat')
      if (!seat || row.scrollWidth <= row.clientWidth) return
      const rowBox = row.getBoundingClientRect()
      const seatBox = seat.getBoundingClientRect()
      row.scrollLeft += seatBox.left - rowBox.left - (row.clientWidth - seatBox.width) / 2
    }
    centerSeat()
    const observer = new ResizeObserver(centerSeat)
    observer.observe(row)
    return () => observer.disconnect()
  }, [current])
}
