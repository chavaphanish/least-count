/** The supplied spade-and-7 artwork, recolored and square-padded without redrawing. */
export function StudioLogo({ onError }: { onError?: () => void }) {
  return (
    <img
      className="studio-logo"
      src="/branding/yaydu-gold.png"
      alt="YAYDU"
      width="1024"
      height="1024"
      fetchPriority="high"
      onError={onError}
    />
  )
}
