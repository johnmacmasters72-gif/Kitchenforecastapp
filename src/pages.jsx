import { useState } from 'react'
import { supabase } from './supabase'
import { Table, Bars, HBars, Kpi, Status } from './ui'
import { today, addD, DW, dow, uid, n2, money, ucost, ing, icost, plan, need, wasteSum, sample } from './logic'

const REASONS = ['Over-prepared', 'Expired', 'Spoiled', 'Dropped or spilled', 'Customer return', 'Other']
const sumQty = (S, id, d) => S.sales.filter(s => s.m === id && s.d === d).reduce((a, s) => a + +s.q, 0)

export function Dashboard({ S }) {
  const t = today(), pl = plan(S, t), nd = need(S, t)
  const dem = pl.reduce((a, p) => a + p.f.p, 0)
  const saved = pl.reduce((a, p) => {
    let mx = 0; for (let k = 1; k <= 14; k++) mx = Math.max(mx, sumQty(S, p.m.id, addD(t, -k)))
    return a + Math.max(0, mx - p.prep) * icost(S, p.m)
  }, 0)
  const low = S.ings.filter(i => i.stock <= i.low || nd[i.id] > i.stock)
  const days = [0, 1, 2, 3, 4, 5, 6].map(k => addD(t, k))
  const wk = days.map(d => plan(S, d).reduce((a, p) => a + p.f.p, 0))
  return (
    <>
      <div className="grid k4" style={{ marginBottom: 16 }}>
        <Kpi title="Predicted demand today" value={dem + ' items'} sub="Estimate, not guaranteed" />
        <Kpi title="Food waste (last 7 days)" value={money(wasteSum(S, 7))} sub={money(wasteSum(S, 30)) + ' in 30 days'} />
        <Kpi title="Estimated money saved" value={money(saved)} sub="vs. prepping for your busiest recent day" />
        <Kpi title="Low-stock ingredients" value={low.length} sub={low.length ? 'Needs attention' : 'All stocked'} />
      </div>
      <div className="grid c2">
        <div className="card"><h3>Today’s preparation</h3>
          <Table head={['Item', 'Predicted', 'Suggested prep']} rows={pl.map(p => [p.m.name, p.f.p, <b>{p.prep}</b>])} empty="Add menu items and sales to see recommendations." />
        </div>
        <div className="card"><h3>Weekly demand overview</h3>
          {S.menu.length ? <Bars values={wk} labels={days.map(d => DW[dow(d)])} /> : <p className="em">No menu items yet.</p>}
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><h3>Low-stock ingredients</h3>
        <Table head={['Ingredient', 'In stock', 'Needed today', 'Status']} empty="Nothing running low. 🎉"
          rows={low.map(i => [i.name, n2(i.stock) + ' ' + i.unit, n2(nd[i.id] || 0) + ' ' + i.unit, <Status i={i} nd={nd} />])} />
      </div>
    </>
  )
}

export function Forecast({ S, upd, toast }) {
  const t = today(), days = [0, 1, 2, 3, 4, 5, 6].map(k => addD(t, k))
  const [date, setDate] = useState(t)
  const pl = plan(S, date)
  const setAdj = (m, v) => upd(n => { n.adj[date + '|' + m] = Math.max(0, Math.round(+v || 0)) })
  const deduct = () => {
    if (S.done?.[t]) return toast('Stock was already deducted today', true)
    const nd = need(S, t)
    upd(n => { n.ings.forEach(i => { i.stock = Math.max(0, +(i.stock - (nd[i.id] || 0)).toFixed(2)) }); n.done = { ...n.done, [t]: 1 } })
    toast('Stock updated from today’s prep')
  }
  return (
    <div className="card">
      <p className="note">Forecasts are <b>estimates, not guaranteed sales</b>. They blend your average daily sales, the same weekday’s history and the last two weeks’ trend, plus a {S.buf}% safety buffer (change it in Settings).</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <label>Forecast day
          <select value={date} onChange={e => setDate(e.target.value)}>
            {days.map(d => <option key={d} value={d}>{(d === t ? 'Today · ' : '') + DW[dow(d)] + ' ' + d}</option>)}
          </select>
        </label>
        <button className="btn o" onClick={() => upd(n => { n.adj = {} })}>Reset my adjustments</button>
        {date === t && <button className="btn" onClick={deduct}>Mark prep as done (deduct stock)</button>}
      </div>
      {S.menu.length && S.sales.length ? (
        <Table head={['Item', 'Avg daily', 'Same weekday', 'Trend', 'Predicted', 'Suggested prep', 'Your prep']}
          rows={pl.map(p => {
            const tr = Math.round((p.f.tr - 1) * 100)
            return [p.m.name, n2(p.f.avg), n2(p.f.dw), <span className={'tag ' + (tr >= 0 ? 'ok' : 'lo')}>{tr >= 0 ? '+' : ''}{tr}%</span>, p.f.p, p.auto,
              <>
                <input className="s" type="number" min="0" value={p.prep} onChange={e => setAdj(p.m.id, e.target.value)} />
                {p.adj && <> <span className="tag lo">adjusted</span></>}
              </>]
          })} empty="" />
      ) : <p className="em">Add menu items and record some sales to generate a forecast.</p>}
      {pl.some(p => p.f.n && p.f.n < 14) && <p className="note" style={{ marginTop: 12 }}>Some items have under two weeks of sales history, so predictions are rough. They improve as you log more days.</p>}
    </div>
  )
}

const blankDish = { name: '', cat: '', price: '', time: '', steps: '', rec: [] }

export function Builder({ S, upd, toast }) {
  const [d, setD] = useState(blankDish)
  const [nw, setNw] = useState({ name: '', unit: 'g', cost: '' })
  const [busy, setBusy] = useState(false)
  const [rv, setRv] = useState(null)
  const [rn, setRn] = useState(null)
  const set = (k, v) => setD(x => ({ ...x, [k]: v }))
  const setRow = (k, f, v) => setD(x => ({ ...x, rec: x.rec.map((r, i) => i === k ? { ...r, [f]: f === 'q' ? +v : v } : r) }))
  const cost = icost(S, d), price = +d.price || 0
  const cats = [...new Set(S.menu.map(m => m.cat).filter(Boolean))]
  const lines = d.rec.map(r => ({ r, i: ing(S, r.i) })).filter(x => x.i && x.r.q > 0)

  function createIngredient() {
    if (!nw.name.trim()) return toast('Name the ingredient', true)
    const id = uid()
    upd(n => { n.ings.push({ id, name: nw.name.trim(), unit: nw.unit, cost: +nw.cost || 0, stock: 0, low: 0 }) })
    setD(x => ({ ...x, rec: [...x.rec, { i: id, q: 0 }] }))
    setNw({ name: '', unit: 'g', cost: '' })
    toast('Ingredient created. Set its stock in Inventory.')
  }

  async function suggest() {
    if (!d.name.trim()) return toast('Type the dish name first', true)
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/suggest-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ dish: d.name, category: d.cat, existing: S.ings.map(i => i.name) })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Request failed')
      const rec = [...d.rec]; let added = 0
      upd(n => {
        j.ingredients.forEach(x => {
          let i = n.ings.find(y => y.name.toLowerCase() === x.name.toLowerCase() && y.unit === x.unit)
          if (!i) { i = { id: uid(), name: x.name, unit: x.unit, cost: Math.max(0, +x.cost || 0), stock: 0, low: 0 }; n.ings.push(i) }
          if (!rec.some(q => q.i === i.id)) { rec.push({ i: i.id, q: +(+x.qty).toFixed(2) }); added++ }
        })
      })
      setD(x => ({ ...x, rec }))
      toast(added + ' ingredients added. Please check quantities and costs.')
    } catch (e) { toast('Couldn’t get suggestions: ' + e.message, true) }
    setBusy(false)
  }

  function save(e) {
    e.preventDefault()
    const rec = d.rec.filter(r => r.i && r.q > 0)
    if (!rec.length) return toast('Add at least one ingredient with a quantity', true)
    const it = { id: d.id || uid(), name: d.name.trim(), cat: (d.cat || '').trim(), price: +d.price || 0, rec, steps: (d.steps || '').trim(), time: +d.time || 0 }
    upd(n => { const x = n.menu.findIndex(m => m.id === it.id); if (x >= 0) n.menu[x] = it; else n.menu.push(it) })
    setD(blankDish); toast('Saved “' + it.name + '” to your menu')
  }

  const rm = rv && S.menu.find(m => m.id === rv)
  const n = rn ?? (rm ? Math.max(1, plan(S, today()).find(p => p.m.id === rm.id)?.prep || 1) : 1)

  return (
    <>
      {rm && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>{rm.name} · recipe</h3><button className="btn o sm" onClick={() => setRv(null)}>Close</button></div>
          <p className="note" style={{ marginTop: 12 }}>Price {money(rm.price)} · Food cost {money(icost(S, rm))} ({rm.price ? Math.round(icost(S, rm) / rm.price * 100) : 0}%) · Margin {money(rm.price - icost(S, rm))}{rm.time ? ' · ' + rm.time + ' min prep' : ''}</p>
          <label style={{ maxWidth: 220, marginBottom: 10 }}>Scale to this many dishes<input type="number" min="1" value={n} onChange={e => setRn(Math.max(1, Math.round(+e.target.value || 1)))} /></label>
          <Table head={['Ingredient', 'Per dish', 'For ' + n, 'Cost']} empty="No ingredients attached."
            rows={rm.rec.map(r => { const i = ing(S, r.i); return i ? [i.name, r.q + ' ' + i.unit, n2(r.q * n) + ' ' + i.unit, money(r.q * n * ucost(i))] : ['Deleted ingredient', '', '', ''] })} />
          <h3 style={{ marginTop: 16 }}>Method</h3>
          {(rm.steps || '').split('\n').filter(x => x.trim()).length
            ? <ol>{rm.steps.split('\n').filter(x => x.trim()).map((x, i) => <li key={i}>{x}</li>)}</ol>
            : <p className="em">No method written yet.</p>}
        </div>
      )}
      <form onSubmit={save}>
        <div className="grid c2" style={{ alignItems: 'start' }}>
          <div>
            <div className="card"><h3>{d.id ? 'Editing: ' + d.name : '1. Dish details'}</h3>
              <div className="row">
                <label>Dish name<input value={d.name} onChange={e => set('name', e.target.value)} required /></label>
                <label>Category<input list="bcats" value={d.cat} onChange={e => set('cat', e.target.value)} placeholder="e.g. Burgers" /></label>
              </div>
              <datalist id="bcats">{cats.map(c => <option key={c} value={c} />)}</datalist>
              <div className="row" style={{ marginTop: 12 }}>
                <label>Selling price (AED)<input type="number" step="0.01" min="0" value={d.price} onChange={e => set('price', e.target.value)} required /></label>
                <label>Prep time (min)<input type="number" min="0" value={d.time} onChange={e => set('time', e.target.value)} /></label>
              </div>
            </div>
            <div className="card"><h3>2. Ingredients and quantities</h3>
              <div className="row" style={{ marginBottom: 12 }}>
                <button type="button" className="btn" disabled={busy} onClick={suggest}>{busy ? 'Thinking…' : '✨ Suggest ingredients with AI'}</button>
                <span style={{ fontSize: 13, color: 'var(--mu)', flex: 1, minWidth: 180 }}>Type the dish name above and the AI fills in ingredients, quantities and estimated costs. Always check them.</span>
              </div>
              {d.rec.map((r, k) => {
                const i = ing(S, r.i)
                return (
                  <div className="row" style={{ marginBottom: 8 }} key={k}>
                    <label>Ingredient<select value={r.i} onChange={e => setRow(k, 'i', e.target.value)}>{S.ings.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                    <label>Quantity{i ? ' (' + i.unit + ')' : ''}<input type="number" step="any" min="0" placeholder="0" value={r.q || ''} onChange={e => setRow(k, 'q', e.target.value)} /></label>
                    <button type="button" className="btn d sm" onClick={() => setD(x => ({ ...x, rec: x.rec.filter((_, j) => j !== k) }))}>Remove</button>
                  </div>
                )
              })}
              {S.ings.length
                ? <button type="button" className="btn o sm" onClick={() => setD(x => ({ ...x, rec: [...x.rec, { i: S.ings[0].id, q: 0 }] }))}>+ Add ingredient</button>
                : <p className="note">You have no ingredients yet. Create your first one below.</p>}
              <div className="note" style={{ marginTop: 14 }}><b>Ingredient not in your list?</b> Create it here and it’s added to this dish.
                <div className="row" style={{ marginTop: 8 }}>
                  <label>Name<input value={nw.name} onChange={e => setNw({ ...nw, name: e.target.value })} /></label>
                  <label>Unit<select value={nw.unit} onChange={e => setNw({ ...nw, unit: e.target.value })}><option value="g">grams</option><option value="ml">millilitres</option><option value="pc">pieces</option></select></label>
                  <label>Cost per kg / L / piece (AED)<input type="number" step="0.01" min="0" value={nw.cost} onChange={e => setNw({ ...nw, cost: e.target.value })} /></label>
                  <button type="button" className="btn sm" onClick={createIngredient}>Create and add</button>
                </div>
              </div>
            </div>
            <div className="card"><h3>3. Method (optional)</h3>
              <label>One step per line<textarea rows="4" value={d.steps} onChange={e => set('steps', e.target.value)} /></label>
            </div>
          </div>
          <div className="card" style={{ position: 'sticky', top: 12 }}><h3>Cost preview</h3>
            <Table head={['Ingredient', 'Qty', 'Cost']} empty="Add ingredients with quantities to see the cost."
              rows={lines.map(({ r, i }) => [i.name, n2(r.q) + ' ' + i.unit, money(r.q * ucost(i))])} />
            <p className="note" style={{ marginTop: 12 }}>Food cost per dish: <b>{money(cost)}</b>{price > 0 && <> · Margin: <b>{money(price - cost)}</b> · Food cost: <b>{Math.round(cost / price * 100)}%</b></>}</p>
            {cost > 0 && <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--mu)' }}>Price for a 30% food cost: <b>{money(cost / 0.3)}</b> <button type="button" className="btn o sm" onClick={() => set('price', (Math.round(cost / 0.3 * 100) / 100).toString())}>Use it</button></p>}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn">{d.id ? 'Save changes' : 'Save to menu'}</button>
              <button type="button" className="btn o" onClick={() => setD(blankDish)}>{d.id ? 'Cancel' : 'Clear'}</button>
            </div>
          </div>
        </div>
      </form>
      <div className="card" style={{ marginTop: 16 }}><h3>Your menu ({S.menu.length})</h3>
        <Table head={['Dish', 'Category', 'Price', 'Food cost', 'Margin', '']} empty="Nothing here yet. Build your first dish above."
          rows={S.menu.map(m => [<b>{m.name}</b>, m.cat || '—', money(m.price), money(icost(S, m)), money(m.price - icost(S, m)),
            <>
              <button className="btn sm" onClick={() => { setRv(m.id); setRn(null) }}>Recipe</button>{' '}
              <button className="btn o sm" onClick={() => { setD(structuredClone(m)); window.scrollTo(0, 0) }}>Edit</button>{' '}
              <button className="btn d sm" onClick={() => upd(x => { x.menu = x.menu.filter(y => y.id !== m.id) })}>Delete</button>
            </>])} />
      </div>
    </>
  )
}

export function Sales({ S, upd, toast }) {
  const t = today(), rows = [...S.sales].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 60)
  const F = e => Object.fromEntries(new FormData(e.target))
  const add = e => {
    e.preventDefault(); const f = F(e)
    if (!(+f.q > 0)) return toast('Enter a quantity', true)
    upd(n => { n.sales.push({ id: uid(), m: f.m, q: Math.round(+f.q), d: f.d, n: f.n }) })
    e.target.reset(); toast('Sale recorded')
  }
  const day = e => {
    e.preventDefault(); const f = F(e); let c = 0
    upd(n => S.menu.forEach(m => { const q = Math.round(+f['q_' + m.id] || 0); if (q > 0) { n.sales.push({ id: uid(), m: m.id, q, d: f.d, n: '' }); c++ } }))
    if (!c) return toast('Enter at least one quantity', true)
    e.target.reset(); toast(c + ' sales recorded')
  }
  return (
    <>
      <div className="card"><h3>Record sales</h3>
        {S.menu.length ? (
          <form onSubmit={add}><div className="row">
            <label>Menu item<select name="m">{S.menu.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <label>Quantity sold<input name="q" type="number" min="1" required /></label>
            <label>Date<input name="d" type="date" defaultValue={t} max={t} required /></label>
            <label>Notes (optional)<input name="n" /></label>
            <button className="btn">Add sale</button>
          </div></form>
        ) : <p className="em">Add menu items first so you can record sales against them.</p>}
      </div>
      {S.menu.length > 0 && (
        <div className="card"><h3>Quick entry: a whole day at once</h3>
          <form onSubmit={day}><div className="row">
            <label>Date<input name="d" type="date" defaultValue={t} max={t} required /></label>
            {S.menu.map(m => <label key={m.id}>{m.name}<input name={'q_' + m.id} type="number" min="0" placeholder="0" /></label>)}
            <button className="btn">Save day</button>
          </div></form>
        </div>
      )}
      <div className="card"><h3>Sales history {S.sales.length > 60 && <small style={{ color: 'var(--mu)', fontWeight: 400 }}>(latest 60 of {S.sales.length})</small>}</h3>
        <Table head={['Date', 'Item', 'Qty', 'Notes', '']} empty="No sales recorded yet."
          rows={rows.map(s => [s.d, S.menu.find(m => m.id === s.m)?.name || 'Deleted item', s.q, s.n || '—',
            <button className="btn d sm" onClick={() => upd(n => { n.sales = n.sales.filter(x => x.id !== s.id) })}>Delete</button>])} />
      </div>
    </>
  )
}

export function Inventory({ S, upd, toast }) {
  const [ed, setEd] = useState(null)
  const d = ed && (ed === 'new' ? { name: '', unit: 'g', cost: '', stock: '', low: '' } : ing(S, ed))
  const nd = need(S, today())
  const short = S.ings.map(i => [i, Math.max(0, (nd[i.id] || 0) - i.stock)]).filter(x => x[1] > 0)
  const submit = e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target))
    const it = { id: ed && ed !== 'new' ? ed : uid(), name: f.name.trim(), unit: f.unit, cost: +f.cost, stock: +f.stock, low: +f.low || 0 }
    upd(n => { const x = n.ings.findIndex(i => i.id === it.id); if (x >= 0) n.ings[x] = it; else n.ings.push(it) })
    setEd(null); e.target.reset(); toast('Ingredient saved')
  }
  return (
    <>
      <div className="card"><h3>{ed && ed !== 'new' ? 'Edit' : 'Add'} ingredient</h3>
        <form key={ed || 'x'} onSubmit={submit}><div className="row">
          <label>Name<input name="name" defaultValue={d?.name} required /></label>
          <label>Unit<select name="unit" defaultValue={d?.unit || 'g'}><option value="g">grams (g)</option><option value="ml">millilitres (ml)</option><option value="pc">pieces</option></select></label>
          <label>Cost (AED per kg / litre / piece)<input name="cost" type="number" step="0.01" min="0" defaultValue={d?.cost} required /></label>
          <label>Current stock<input name="stock" type="number" step="any" min="0" defaultValue={d?.stock} required /></label>
          <label>Low-stock level<input name="low" type="number" step="any" min="0" defaultValue={d?.low} /></label>
          <button className="btn">{ed && ed !== 'new' ? 'Save' : 'Add'}</button>
          {ed && <button type="button" className="btn o" onClick={() => setEd(null)}>Cancel</button>}
        </div></form>
      </div>
      <div className="card"><h3>Ingredient inventory <small style={{ color: 'var(--mu)', fontWeight: 400 }}>· needs based on today’s prep</small></h3>
        <Table head={['Ingredient', 'Current stock', 'Needed today', 'Shortage', 'Status', '']} empty="No ingredients yet. Add one above."
          rows={S.ings.map(i => {
            const s = Math.max(0, (nd[i.id] || 0) - i.stock)
            return [<b>{i.name}</b>,
              <><input className="s" type="number" step="any" min="0" value={i.stock} onChange={e => upd(n => { ing(n, i.id).stock = Math.max(0, +e.target.value || 0) })} /> {i.unit}</>,
              n2(nd[i.id] || 0) + ' ' + i.unit, s ? <b style={{ color: 'var(--rd)' }}>{n2(s)} {i.unit}</b> : '—', <Status i={i} nd={nd} />,
              <>
                <button className="btn o sm" onClick={() => setEd(i.id)}>Edit</button>{' '}
                <button className="btn d sm" onClick={() => upd(n => { n.ings = n.ings.filter(x => x.id !== i.id); n.menu.forEach(m => { m.rec = m.rec.filter(r => r.i !== i.id) }) })}>Delete</button>
              </>]
          })} />
      </div>
      <div className="card"><h3>Shopping list for today’s prep</h3>
        <Table head={['Ingredient', 'Buy at least', 'Est. cost']} empty="Nothing to buy: stock covers today’s prep."
          rows={short.map(([i, q]) => [i.name, n2(q) + ' ' + i.unit, money(q * ucost(i))])} />
        {short.length > 0 && <p className="note" style={{ marginTop: 12 }}>Estimated total: <b>{money(short.reduce((a, [i, q]) => a + q * ucost(i), 0))}</b></p>}
      </div>
    </>
  )
}

export function Waste({ S, upd, toast }) {
  const t = today(), w = [...S.waste].sort((a, b) => b.d.localeCompare(a.d))
  const m30 = w.filter(x => x.d > addD(t, -30)), by = {}
  m30.forEach(x => { by[x.r] = (by[x.r] || 0) + +x.v })
  const wk = [3, 2, 1, 0].map(k => S.waste.filter(x => x.d > addD(t, -7 * k - 7) && x.d <= addD(t, -7 * k)).reduce((a, x) => a + +x.v, 0))
  const add = e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), nm = f.item.trim().toLowerCase()
    const m = S.menu.find(x => x.name.toLowerCase() === nm), i = S.ings.find(x => x.name.toLowerCase() === nm)
    const v = f.v === '' ? (m ? icost(S, m) * f.q : i ? ucost(i) * f.q : 0) : +f.v
    upd(n => { n.waste.push({ id: uid(), item: f.item.trim(), q: +f.q, r: f.r, v: +(+v).toFixed(2), d: f.d }) })
    e.target.reset(); toast(f.v === '' && !m && !i ? 'Saved with AED 0 value (item not matched)' : 'Waste recorded')
  }
  return (
    <>
      <div className="grid k4" style={{ marginBottom: 16 }}>
        <Kpi title="Last 7 days" value={money(wasteSum(S, 7))} sub="" />
        <Kpi title="Last 30 days" value={money(wasteSum(S, 30))} sub={m30.length + ' entries'} />
      </div>
      <div className="grid c2">
        <div className="card"><h3>Weekly waste value</h3>{S.waste.length ? <Bars values={wk} labels={['3 wks ago', '2 wks ago', 'Last wk', 'This wk']} /> : <p className="em">No waste recorded yet.</p>}</div>
        <div className="card"><h3>Reasons (30 days)</h3>{Object.keys(by).length ? <HBars pairs={Object.entries(by).sort((a, b) => b[1] - a[1])} /> : <p className="em">Nothing in the last 30 days.</p>}</div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><h3>Record waste</h3>
        <form onSubmit={add}><div className="row">
          <label>Food item<input name="item" list="wl" required /></label>
          <datalist id="wl">{S.menu.map(m => <option key={m.id} value={m.name} />)}{S.ings.map(i => <option key={i.id} value={i.name} />)}</datalist>
          <label>Quantity<input name="q" type="number" step="any" min="0" required /></label>
          <label>Reason<select name="r">{REASONS.map(r => <option key={r}>{r}</option>)}</select></label>
          <label>Value (AED, blank = estimate)<input name="v" type="number" step="0.01" min="0" /></label>
          <label>Date<input name="d" type="date" defaultValue={t} max={t} required /></label>
          <button className="btn">Add</button>
        </div></form>
      </div>
      <div className="card"><h3>Waste log</h3>
        <Table head={['Date', 'Item', 'Qty', 'Reason', 'Value', '']} empty="No waste recorded yet."
          rows={w.slice(0, 60).map(x => [x.d, x.item, x.q, x.r, money(x.v), <button className="btn d sm" onClick={() => upd(n => { n.waste = n.waste.filter(y => y.id !== x.id) })}>Delete</button>])} />
      </div>
    </>
  )
}

export function Settings({ S, upd, toast, email, onSignOut, onErase }) {
  const [conf, setConf] = useState(false)
  const save = e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target))
    upd(n => { n.name = f.name.trim(); n.buf = Math.min(50, Math.max(0, +f.buf || 0)) }); toast('Settings saved')
  }
  const exportData = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }))
    a.download = 'kitchen-forecast-data.json'; a.click(); URL.revokeObjectURL(a.href)
  }
  return (
    <>
      <div className="card"><h3>Restaurant</h3>
        <form onSubmit={save}><div className="row">
          <label>Restaurant name<input name="name" defaultValue={S.name} required /></label>
          <label>Safety buffer on prep (%)<input name="buf" type="number" min="0" max="50" defaultValue={S.buf} /></label>
          <button className="btn">Save settings</button>
        </div></form>
      </div>
      <div className="card"><h3>Account & data</h3>
        <p className="note">Signed in as {email}. Your data is private to your account.</p>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <button className="btn o" onClick={exportData}>Export data (JSON)</button>
          <button className="btn o" onClick={() => { upd(n => { Object.assign(n, sample(), { adj: {} }) }); toast('Sample data loaded') }}>Load sample data</button>
          <button className="btn o" onClick={onSignOut}>Sign out</button>
          <button className="btn d" onClick={() => { if (!conf) { setConf(true); setTimeout(() => setConf(false), 4000) } else onErase() }}>{conf ? 'Click again to erase everything' : 'Erase all data'}</button>
        </div>
      </div>
    </>
  )
}
