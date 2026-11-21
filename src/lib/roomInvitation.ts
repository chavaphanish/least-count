export function invitationData(code: string, url: string): ShareData {
  return {
    title: 'YAYDU — The Game of Sevens',
    text: `Join me for a game of YAYDU, The Game of Sevens! 🃏\n\nRoom Code: ${code}`,
    url,
  }
}
export const invitationMessage = (code: string, url: string) =>
  `${invitationData(code, url).text}\n\nJoin here: ${url}`

/** Invoke native sharing in the click's activation stack; never wait on network/state first. */
export function shareRoomInvitation(code: string, url: string, copied: () => void, manual: (failed: boolean) => void) {
  if (navigator.share) {
    try {
      void navigator.share(invitationData(code, url)).catch(error => {
        if (error?.name !== 'AbortError') manual(true)
      })
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') manual(true)
    }
    return
  }
  if (!navigator.clipboard?.writeText) { manual(false); return }
  try { void navigator.clipboard.writeText(invitationMessage(code, url)).then(copied, () => manual(false)) }
  catch { manual(false) }
}
