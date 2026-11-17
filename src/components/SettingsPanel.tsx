import { useId, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { SoundSettings } from '../feedback/SoundSettings'
import { ProfilePage } from '../pages/ProfilePage'
import './settings-panel.css'

const tabs = ['Account', 'Sounds', 'Profile'] as const

export function SettingsPanel({ busy, logout }: { busy: boolean; logout: () => Promise<void> }) {
  const { user } = useAuth()
  const id = useId()
  const [selected, setSelected] = useState(0)
  const [profileOpened, setProfileOpened] = useState(false)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const select = (index: number) => {
    if (index === 2) setProfileOpened(true)
    setSelected(index)
  }
  return <section className="settings-panel" aria-label="Settings">
    <h2>Settings</h2>
    <div className="settings-layout">
      <div className="career-tabs" role="tablist" aria-label="Settings sections" aria-orientation="vertical">
        {tabs.map((tab, index) => <button key={tab} type="button" role="tab"
          id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`}
          aria-selected={selected === index} aria-pressed={selected === index}
          tabIndex={selected === index ? 0 : -1}
          ref={element => { buttons.current[index] = element }}
          onClick={() => select(index)}
          onKeyDown={event => {
            const next = event.key === 'ArrowDown' ? (index + 1) % tabs.length
              : event.key === 'ArrowUp' ? (index + tabs.length - 1) % tabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
            if (next === null) return
            event.preventDefault(); select(next); buttons.current[next]?.focus()
          }}>{tab}</button>)}
      </div>
      <div className="settings-content">
        <div role="tabpanel" id={`${id}-panel-0`} aria-labelledby={`${id}-tab-0`} hidden={selected !== 0}>
          <button className="button button-primary" disabled={busy} onClick={() => void logout()}>
            {user?.player.accountType === 'guest' ? 'Leave Guest Session' : 'Sign Out'}
          </button>
        </div>
        <div role="tabpanel" id={`${id}-panel-1`} aria-labelledby={`${id}-tab-1`} hidden={selected !== 1}>
          <SoundSettings />
        </div>
        <div role="tabpanel" id={`${id}-panel-2`} aria-labelledby={`${id}-tab-2`} hidden={selected !== 2}>
          {profileOpened && <ProfilePage editingOnly />}
        </div>
      </div>
    </div>
  </section>
}
