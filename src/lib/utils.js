export function isFilled(v) {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}

export function summarize(fields = []) {
  const total = fields.length
  const decided = fields.filter((f) => f.status === 'decided').length
  const to_confirm = fields.filter((f) => f.status === 'to_confirm').length
  const filled = fields.filter((f) => isFilled(f.value)).length
  return {
    total,
    decided,
    to_confirm,
    open: total - decided - to_confirm,
    filled,
    pct: total ? Math.round((decided / total) * 100) : 0,
  }
}

export function timeAgo(ts) {
  if (!ts) return ''
  const s = (Date.now() - new Date(ts).getTime()) / 1000
  if (s < 60) return 'just now'
  const m = s / 60
  if (m < 60) return `${Math.floor(m)} min ago`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)} h ago`
  const d = h / 24
  if (d < 7) return `${Math.floor(d)} d ago`
  return new Date(ts).toLocaleDateString()
}

export function upsertById(list, row) {
  const i = list.findIndex((x) => x.id === row.id)
  if (i === -1) return [...list, row]
  const copy = list.slice()
  copy[i] = { ...copy[i], ...row }
  return copy
}

export function removeById(list, id) {
  return list.filter((x) => x.id !== id)
}

export function personName(people, id) {
  const p = people?.[id]
  return p ? p.full_name || p.email : 'Someone'
}

// Order stages along the flow (topological), falling back to left-to-right position.
export function flowOrder(nodes, edges) {
  const byPos = (a, b) => a.pos_x - b.pos_x || a.pos_y - b.pos_y
  const indeg = new Map(nodes.map((n) => [n.id, 0]))
  const out = new Map(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    if (!indeg.has(e.source_id) || !indeg.has(e.target_id)) continue
    indeg.set(e.target_id, indeg.get(e.target_id) + 1)
    out.get(e.source_id).push(e.target_id)
  }
  const lookup = new Map(nodes.map((n) => [n.id, n]))
  let ready = nodes.filter((n) => indeg.get(n.id) === 0).sort(byPos)
  const result = []
  const seen = new Set()
  while (ready.length) {
    const n = ready.shift()
    if (seen.has(n.id)) continue
    seen.add(n.id)
    result.push(n.id)
    for (const t of out.get(n.id)) {
      indeg.set(t, indeg.get(t) - 1)
      if (indeg.get(t) === 0) ready.push(lookup.get(t))
    }
    ready.sort(byPos)
  }
  nodes.filter((n) => !seen.has(n.id)).sort(byPos).forEach((n) => result.push(n.id))
  return result
}
