import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import { blankState, sample } from './logic'
import { Dashboard, Forecast, Builder, Sales, Inventory, Waste, Settings } from './pages'

const PAGES = [
  ['dashboard', 'Dashboard'], ['forecast', 'Forecast'], ['builder', 'Menu Builder'],
  ['sales', 'Sales'], ['inventory', 'Inventory'], ['waste', 'Waste Analytics'], ['settings', 'Settings']
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [S, setS] = useState(undefined) // undefined = loading, null = no restaurant yet
  const [page, setPage] = useState('dashboard')
  const [open, setOpen] = useState(false)
  const [toastMsg, setToast] = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const ref = useRef(null)
  const dirty = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setS(undefined); return }
    setS(undefined); setLoadErr(null)
    supabase.from('kf_data').select('data').eq('user_id', session.user.id).maybeSingle().then(({ data, error }) => {
      if (error) { setLoadErr(error.message); setS(null); return }
      dirty.current = false
      ref.current = data?.data ?? null
      setS(data?.data ?? null)
    })
  }, [session?.user?.id])

  const toast = useCallback((m, bad) => { setToast([m, bad]); setTimeout(() => setToast(null), 2600) }, [])

  // Immutable update helper: clone, mutate, store. Not run inside a React updater, so no double invocation.
  const upd = useCallback(fn => {
    const n = structuredClone(ref.current); fn(n)
    ref.current = n; dirty.current = true; setS(n)
  }, [])

  useEffect(() => {
    if (!S || !dirty.current || !session) return
    const t = setTimeout(async () => {
      const { error } = await supabase.from('kf_data').upsert({ user_id: session.user.id, data: S, updated_at: new Date().toISOString() })
      if (error) toast('Couldn’t save your changes: ' + error.message, true)
      else dirty.current = false
    }, 500)
    return () => clearTimeout(t)
  }, [S])

  async function createRestaurant(e) {
    e.preventDefault()
    const F = Object.fromEntries(new FormData(e.target))
    const n = blankState(F.name.trim())
    if (F.demo) Object.assign(n, sample())
    ref.current = n; dirty.current = true; setS(n)
  }

  async function signOut() { await supabase.auth.signOut(); ref.current = null; setPage('dashboard') }
  async function eraseAll() {
    const { error } = await supabase.from('kf_data').delete().eq('user_id', session.user.id)
    if (error) return toast(error.message, true)
    ref.current = null; dirty.current = false; setS(null)
  }

  if (session === undefined || (session && S === undefined)) return <p className="load">Loading Kitchen Forecast…</p>
  if (!session) return <Auth />

  if (!S) {
    return (
      <div className="auth"><div className="card">
        <h1>🍽️ Set up your restaurant</h1>
        {loadErr && <p className="note" style={{ color: 'var(--rd)' }}>Couldn’t load your data: {loadErr}. Did you run supabase.sql?</p>}
        <form onSubmit={createRestaurant}>
          <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <label>Restaurant name<input name="name" required placeholder="e.g. Al Barsha Burger Co." /></label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, fontWeight: 500 }}>
              <input type="checkbox" name="demo" defaultChecked style={{ width: 'auto' }} /> Start with sample demo data
            </label>
            <button className="btn">Create restaurant</button>
            <button type="button" className="btn o" onClick={signOut}>Sign out</button>
          </div>
        </form>
      </div></div>
    )
  }

  const props = { S, upd, toast }
  const title = PAGES.find(p => p[0] === page)[1]
  return (
    <>
      <aside className={open ? 'open' : ''}>
        <div className="logo">🍽️<span>Kitchen Forecast<small>{S.name}</small></span></div>
        <nav>{PAGES.map(([k, l]) => (
          <button key={k} className={k === page ? 'on' : ''} onClick={() => { setPage(k); setOpen(false) }}>{l}</button>
        ))}</nav>
        <button className="btn o sm" style={{ marginTop: 'auto' }} onClick={signOut}>Sign out</button>
      </aside>
      <main>
        <div className="top">
          <button className="burger" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <div><h1>{title}</h1><p>{new Date().toDateString()} · {S.name}</p></div>
        </div>
        {page === 'dashboard' && <Dashboard {...props} />}
        {page === 'forecast' && <Forecast {...props} />}
        {page === 'builder' && <Builder {...props} />}
        {page === 'sales' && <Sales {...props} />}
        {page === 'inventory' && <Inventory {...props} />}
        {page === 'waste' && <Waste {...props} />}
        {page === 'settings' && <Settings {...props} email={session.user.email} onSignOut={signOut} onErase={eraseAll} />}
      </main>
      {toastMsg && <div className={'toast ' + (toastMsg[1] ? 'e' : '')}>{toastMsg[0]}</div>}
    </>
  )
}
