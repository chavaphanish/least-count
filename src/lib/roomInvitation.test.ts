import { afterEach, expect, it, vi } from 'vitest'
import { invitationMessage, shareRoomInvitation } from './roomInvitation'
afterEach(() => vi.unstubAllGlobals())
const code = 'ABC234', url = 'https://game.test/join/ABC234'
it('opens native share synchronously with game, code and direct link, without clipboard work', async () => {
  const copied = vi.fn(), manual = vi.fn(), writeText = vi.fn(), share = vi.fn(() => Promise.resolve())
  vi.stubGlobal('navigator', { share, clipboard: { writeText } })
  shareRoomInvitation(code, url, copied, manual)
  expect(share).toHaveBeenCalledExactlyOnceWith({ title: 'YAYDU — The Game of Sevens', text: expect.stringContaining('Room Code: ABC234'), url })
  expect(writeText).not.toHaveBeenCalled()
  await Promise.resolve(); expect(copied).not.toHaveBeenCalled(); expect(manual).not.toHaveBeenCalled()
})
it('treats native cancellation silently and never claims delivery', async () => {
  const copied = vi.fn(), manual = vi.fn()
  vi.stubGlobal('navigator', { share: () => Promise.reject(new DOMException('Cancelled', 'AbortError')) })
  shareRoomInvitation(code, url, copied, manual); await Promise.resolve()
  expect(copied).not.toHaveBeenCalled(); expect(manual).not.toHaveBeenCalled()
})
it('offers manual sharing after native failure, without claiming clipboard success', async () => {
  const copied = vi.fn(), manual = vi.fn(), writeText = vi.fn()
  vi.stubGlobal('navigator', { share: () => Promise.reject(new Error('Unavailable')), clipboard: { writeText } })
  shareRoomInvitation(code, url, copied, manual); await Promise.resolve()
  expect(manual).toHaveBeenCalledExactlyOnceWith(true)
  expect(copied).not.toHaveBeenCalled(); expect(writeText).not.toHaveBeenCalled()
})
it('handles a synchronous native failure', () => {
  const manual = vi.fn()
  vi.stubGlobal('navigator', { share: () => { throw new Error('No activation') } })
  shareRoomInvitation(code, url, vi.fn(), manual); expect(manual).toHaveBeenCalledWith(true)
})
it('copies the full invitation only when native share is absent and clipboard succeeds', async () => {
  const copied = vi.fn(), manual = vi.fn(), writeText = vi.fn(() => Promise.resolve())
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  shareRoomInvitation(code, url, copied, manual)
  expect(copied).not.toHaveBeenCalled()
  expect(writeText).toHaveBeenCalledWith(invitationMessage(code, url))
  await Promise.resolve(); expect(copied).toHaveBeenCalledOnce(); expect(manual).not.toHaveBeenCalled()
})
it('provides manual text if clipboard is missing or denied', async () => {
  const copied = vi.fn(), manual = vi.fn()
  vi.stubGlobal('navigator', {})
  shareRoomInvitation(code, url, copied, manual)
  expect(manual).toHaveBeenCalledWith(false)
  vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('Denied')) } })
  shareRoomInvitation(code, url, copied, manual); await Promise.resolve()
  expect(manual).toHaveBeenCalledTimes(2); expect(copied).not.toHaveBeenCalled()
})
