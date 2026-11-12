import { money, n2 } from './logic'

export const Table = ({ head, rows, empty }) =>
  rows.length ? (
    <div className="tw">
      <table>
        <thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  ) : <p className="em">{empty}</p>

export const Bars = ({ values, labels }) => {
  const mx = Math.max(1, ...values)
  return (
    <div className="bars">
      {values.map((v, i) => (
        <div className="b" key={i}>
          <span>{n2(v)}</span>
          <div className="bw"><i style={{ height: (v / mx * 100) + '%' }} /></div>
          <em>{labels[i]}</em>
        </div>
      ))}
    </div>
  )
}

export const HBars = ({ pairs }) => {
  const mx = Math.max(1, ...pairs.map(p => p[1]))
  return pairs.map(p => (
    <div className="hb" key={p[0]}>
      <span>{p[0]}</span><div><i style={{ width: (p[1] / mx * 100) + '%' }} /></div><b>{money(p[1])}</b>
    </div>
  ))
}

export const Kpi = ({ title, value, sub }) => (
  <div className="card kpi"><small>{title}</small><b>{value}</b><span>{sub}</span></div>
)

export const Status = ({ i, nd }) =>
  nd[i.id] > i.stock ? <span className="tag sh">Shortage</span>
    : i.stock <= i.low ? <span className="tag lo">Low</span>
    : <span className="tag ok">OK</span>

export const Field = ({ label, children }) => <label>{label}{children}</label>
