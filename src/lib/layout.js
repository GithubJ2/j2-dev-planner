// Arrange stages into columns by their position in the flow.
// Connected stages are layered left to right; unconnected ones go in a final column.
export function tidyLayout(nodes, edges, { colGap = 330, rowGap = 175 } = {}) {
  const ids = new Set(nodes.map((n) => n.id))
  const valid = edges.filter((e) => ids.has(e.source_id) && ids.has(e.target_id) && e.source_id !== e.target_id)
  const indeg = new Map(nodes.map((n) => [n.id, 0]))
  const out = new Map(nodes.map((n) => [n.id, []]))
  for (const e of valid) {
    indeg.set(e.target_id, indeg.get(e.target_id) + 1)
    out.get(e.source_id).push(e.target_id)
  }
  const connected = new Set(valid.flatMap((e) => [e.source_id, e.target_id]))
  const level = new Map()
  let queue = nodes.filter((n) => connected.has(n.id) && indeg.get(n.id) === 0).map((n) => n.id)
  queue.forEach((id) => level.set(id, 0))
  const remaining = new Map(indeg)
  while (queue.length) {
    const id = queue.shift()
    for (const t of out.get(id)) {
      level.set(t, Math.max(level.get(t) ?? 0, level.get(id) + 1))
      remaining.set(t, remaining.get(t) - 1)
      if (remaining.get(t) === 0) queue.push(t)
    }
  }
  // Nodes caught in a cycle never reach indegree 0; place them after their deepest known predecessor.
  for (const n of nodes) {
    if (connected.has(n.id) && !level.has(n.id)) level.set(n.id, 1)
  }
  const maxLevel = Math.max(-1, ...level.values())
  for (const n of nodes) if (!connected.has(n.id)) level.set(n.id, maxLevel + 1)

  const columns = new Map()
  const byPos = (a, b) => a.pos_y - b.pos_y || a.pos_x - b.pos_x
  for (const n of [...nodes].sort(byPos)) {
    const l = level.get(n.id)
    if (!columns.has(l)) columns.set(l, [])
    columns.get(l).push(n)
  }
  const positions = []
  for (const [l, col] of columns) {
    const offset = ((col.length - 1) * rowGap) / 2
    col.forEach((n, i) => positions.push({ id: n.id, x: l * colGap, y: i * rowGap - offset }))
  }
  return positions
}
