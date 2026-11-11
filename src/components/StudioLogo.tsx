/** The approved artwork, recolored from its original alpha without redrawing. */
export function StudioLogo({ onError }: { onError?: () => void }) {
  return (
    <img
      className="studio-logo"
      src="/branding/chavium-games-gold.png"
      alt="Chavium Games"
      width="1536"
      height="1024"
      fetchPriority="high"
      onError={onError}
    />
  )
}
