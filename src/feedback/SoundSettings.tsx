import { useFeedback, useFeedbackPreferences } from './FeedbackProvider'
export function SoundSettings(){
  const manager=useFeedback(),preferences=useFeedbackPreferences(),supported=manager.supported()
  return <fieldset className="sound-haptics">
    <legend>Sound &amp; Haptics</legend>
    <div className="feedback-options">
      <label className="checkbox-label"><input type="checkbox" checked={preferences.sound} onChange={e=>manager.set('sound',e.target.checked)} />Sound Effects</label>
      <label className="checkbox-label"><input type="checkbox" checked={supported&&preferences.vibration} disabled={!supported} aria-describedby={!supported?'vibration-support':undefined} onChange={e=>manager.set('vibration',e.target.checked)} />Vibration</label>
      <label className="checkbox-label"><input type="checkbox" checked={preferences.turnNotifications} onChange={e=>manager.set('turnNotifications',e.target.checked)} />Turn Notifications</label>
    </div>
    {!supported&&<small id="vibration-support">Vibration is unavailable on this device or browser.</small>}
  </fieldset>
}
