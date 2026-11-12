import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [mode, setMode] = useState('in')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const up = mode === 'up'

  async function submit(e) {
    e.preventDefault()
    const F = Object.fromEntries(new FormData(e.target))
    setBusy(true); setMsg(null)
    const { data, error } = up
      ? await supabase.auth.signUp({ email: F.email, password: F.password, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email: F.email, password: F.password })
    setBusy(false)
    if (error) return setMsg({ bad: true, t: error.message })
    if (up && !data.session) setMsg({ t: 'Check your email and click the confirmation link, then sign in.' })
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setMsg({ bad: true, t: error.message })
  }

  return (
    <div className="auth">
      <div className="card">
        <h1>🍽️ Kitchen Forecast</h1>
        <p style={{ color: 'var(--mu)' }}>Prep smarter. Waste less. Earn more.</p>
        <div className="row" style={{ marginBottom: 14 }}>
          <button className={'btn ' + (up ? 'o' : '')} onClick={() => setMode('in')}>Sign in</button>
          <button className={'btn ' + (up ? '' : 'o')} onClick={() => setMode('up')}>Create account</button>
        </div>
        <button className="btn o" style={{ width: '100%' }} onClick={google}>Continue with Google</button>
        <p className="em" style={{ padding: '12px 0 6px' }}>or use email</p>
        <form onSubmit={submit}>
          <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <label>Email<input name="email" type="email" required autoComplete="email" /></label>
            <label>Password{up && ' (8+ characters)'}
              <input name="password" type="password" required minLength={up ? 8 : 1} autoComplete={up ? 'new-password' : 'current-password'} />
            </label>
            <button className="btn" disabled={busy}>{busy ? 'Please wait…' : up ? 'Create account' : 'Sign in'}</button>
          </div>
        </form>
        {msg && <p className="note" style={{ marginTop: 14, color: msg.bad ? 'var(--rd)' : undefined }}>{msg.t}</p>}
      </div>
    </div>
  )
}
