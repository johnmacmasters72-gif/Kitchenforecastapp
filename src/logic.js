export const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') }
export const addD = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d) }
export const DW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const dow = s => new Date(s + 'T12:00:00').getDay()
export const today = () => iso(new Date())
export const uid = () => Math.random().toString(36).slice(2, 9)
export const n2 = n => (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })
export const money = n => 'AED ' + n2(n)

// Ingredient cost is entered per kg / litre / piece; recipes use g / ml / pieces.
export const ucost = i => i.cost / (i.unit === 'pc' ? 1 : 1000)
export const ing = (S, id) => S.ings.find(i => i.id === id)
export const icost = (S, m) => m.rec.reduce((a, r) => { const i = ing(S, r.i); return a + (i ? r.q * ucost(i) : 0) }, 0)

// Forecast: blend of average daily sales and same-weekday average, scaled by a clamped 2-week trend.
export function fc(S, m, date) {
  const by = {}; let first = null
  S.sales.forEach(s => { if (s.m === m.id && s.d < date) { by[s.d] = (by[s.d] || 0) + +s.q; if (!first || s.d < first) first = s.d } })
  if (!first) return { p: 0, avg: 0, dw: 0, tr: 1, n: 0 }
  const W = Math.min(56, Math.max(1, Math.round((new Date(date) - new Date(first)) / 864e5))), v = [0]
  for (let k = 1; k <= W; k++) v[k] = by[addD(date, -k)] || 0
  const avg = v.slice(1).reduce((a, b) => a + b, 0) / W, td = dow(date)
  const dv = v.map((x, k) => k && dow(addD(date, -k)) === td ? x : null).filter(x => x !== null)
  const dw = dv.length ? dv.reduce((a, b) => a + b, 0) / dv.length : avg
  const l7 = v.slice(1, 8).reduce((a, b) => a + b, 0), p7 = v.slice(8, 15).reduce((a, b) => a + b, 0)
  const tr = W >= 14 && p7 > 0 ? Math.min(1.25, Math.max(0.8, l7 / p7)) : 1
  return { p: Math.round((dv.length >= 2 ? dw * 0.6 + avg * 0.4 : avg) * tr), avg, dw, tr, n: W }
}
export function plan(S, date) {
  return S.menu.map(m => {
    const f = fc(S, m, date), auto = Math.ceil(f.p * (1 + S.buf / 100)), a = S.adj[date + '|' + m.id]
    return { m, f, auto, prep: a != null ? a : auto, adj: a != null }
  })
}
export function need(S, date) {
  const o = {}
  plan(S, date).forEach(p => p.m.rec.forEach(r => { o[r.i] = (o[r.i] || 0) + r.q * p.prep }))
  return o
}
export const wasteSum = (S, d) => S.waste.filter(w => w.d > addD(today(), -d)).reduce((a, w) => a + +w.v, 0)
export const blankState = name => ({ name, buf: 10, ings: [], menu: [], sales: [], waste: [], adj: {}, done: {} })

function icostS(m, I){return m.rec.reduce((a,r)=>{const i=I.find(x=>x.id===r.i);return a+(i?r.q*ucost(i):0)},0)}
export function sample() {
 const I=[['Chicken breast','g',24,7000,3000],['Beef patty mix','g',38,6000,2500],['Burger buns','pc',.9,90,40],['Lettuce','g',8,2500,1000],['Burger sauce','g',14,1800,800],['Potatoes','g',4,16000,5000],['Cheese slices','g',30,1200,600],['Sandwich bread','pc',.7,70,30],['Cooking oil','ml',9,6000,2000]].map((x,k)=>({id:'i'+k,name:x[0],unit:x[1],cost:x[2],stock:x[3],low:x[4]}));
 const B=[34,22,46,16],M=[['Chicken Burger','Burgers',25,[[0,150],[2,1],[3,20],[4,15]]],['Beef Burger','Burgers',28,[[1,160],[2,1],[6,20],[3,20],[4,15]]],['Fries','Sides',12,[[5,250],[8,30]]],['Chicken Sandwich','Sandwiches',18,[[0,100],[7,2],[3,15],[4,10]]]].map((x,k)=>({id:'m'+k,name:x[0],cat:x[1],price:x[2],rec:x[3].map(r=>({i:'i'+r[0],q:r[1]})),time:[12,12,8,10][k],steps:['Season and grill the chicken breast, 6 minutes per side.\nToast the bun.\nBuild: sauce, lettuce, chicken, top bun.','Form the patty and sear 4 minutes per side.\nMelt the cheese on top in the last minute.\nToast the bun, add sauce and lettuce.','Cut and rinse the potatoes.\nFry at 175°C for 5 to 6 minutes.\nDrain and season straight away.','Grill sliced chicken for 5 minutes.\nLayer bread with sauce, lettuce and chicken.\nPress and toast until golden.'][k]}));
 const F=[1.15,.8,.85,.9,.95,1.25,1.3],sales=[],waste=[];
 M.forEach((m,k)=>{for(let n=1;n<=42;n++){const d=addD(today(),-n),r=Math.abs(Math.sin(k*97+n*13)*1e4)%1;sales.push({id:uid(),m:m.id,q:Math.round(B[k]*F[dow(d)]*(1+(42-n)/350)*(.85+r*.3)),d,n:''})}});
 [[2,'Fries',6,'Over-prepared'],[5,'Chicken Burger',4,'Over-prepared'],[9,'Lettuce',800,'Spoiled'],[12,'Beef Burger',3,'Dropped or spilled'],[17,'Fries',9,'Over-prepared'],[24,'Chicken Sandwich',5,'Expired']].forEach(w=>{const m=M.find(x=>x.name===w[1]),i=I.find(x=>x.name===w[1]);waste.push({id:uid(),d:addD(today(),-w[0]),item:w[1],q:w[2],r:w[3],v:+(m?icostS(m,I)*w[2]:ucost(i)*w[2]).toFixed(2)})});
 return{ings:I,menu:M,sales,waste}}
