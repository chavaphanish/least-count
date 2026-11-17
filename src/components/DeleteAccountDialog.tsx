import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

export function DeleteAccountDialog({ close }: { close: () => void }) {
  const auth=useAuth(),dialog=useRef<HTMLDialogElement>(null),id=useId()
  const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('')
  const [pending,setPending]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retrying,setRetrying]=useState(false)
  useEffect(()=>{dialog.current?.showModal()},[])
  useEffect(()=>{
    if(!pending)return
    let stopped=false,timer:number|undefined
    const controller=new AbortController()
    const poll=async()=>{
      try {
        const result=await auth.services.api<{complete?:boolean;blocked?:boolean;retrying?:boolean}>('/account/deletion-status',{method:'POST'},controller.signal)
        if(stopped)return
        if(result.complete){await auth.completeAccountDeletion();location.hash='#/';return}
        if(result.blocked){setPending(false);setError('Finish your active game before deleting your account. Nothing has been deleted.');return}
        setRetrying(result.retrying===true);setError('')
      }catch{if(!stopped)setError('Could not check progress. Cleanup continues on the server; retrying…')}
      if(!stopped)timer=window.setTimeout(()=>void poll(),2000)
    }
    void poll()
    return()=>{stopped=true;controller.abort();if(timer)clearTimeout(timer)}
  },[pending,auth.services,auth.completeAccountDeletion])
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy||confirmation!=='DELETE'||!password)return
    setBusy(true);setError('')
    try {
      await auth.services.api('/account',{method:'DELETE',body:JSON.stringify({confirmation,password})})
      setPassword('');setPending(true)
    }catch(reason){setError(reason instanceof Error?reason.message:'Deletion could not start. Please retry.')}
    finally{setBusy(false)}
  }
  return <dialog ref={dialog} className="table-overlay delete-account-dialog" aria-labelledby={id} onCancel={event=>{if(pending||busy)event.preventDefault()}} onClose={()=>{if(!pending&&!busy)close()}}>
    <div className="table-overlay-shell">
      <header><h2 id={id}>Delete Account</h2></header>
      <div className="table-overlay-body">
        <p><strong>This action is permanent and cannot be undone.</strong></p>
        {!pending ? <>
          <p>Your account, profile, photos, XP, statistics and buddy connections will be deleted. Shared game results will be anonymized. Finish active games first.</p>
          <form onSubmit={submit}>
            <label>Current password<input type="password" autoComplete="current-password" required maxLength={128} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)} /></label>
            <label>Type DELETE to confirm<input autoComplete="off" autoCapitalize="characters" required pattern="DELETE" value={confirmation} disabled={busy} onChange={event=>setConfirmation(event.target.value)} /></label>
            <div className="auth-actions">
              <button type="button" className="button button-secondary" disabled={busy} autoFocus onClick={()=>dialog.current?.close()}>Cancel</button>
              <button className="button button-danger" disabled={busy||confirmation!=='DELETE'||!password}>{busy?'Verifying…':'Permanently Delete Account'}</button>
            </div>
          </form>
        </> : <p role="status">{retrying?'Cleanup is retrying automatically.':'Deleting your account and personal data…'} You can close this browser window; cleanup will continue securely.</p>}
        {error&&<p className="game-alert" role="alert">{error}</p>}
      </div>
    </div>
  </dialog>
}
