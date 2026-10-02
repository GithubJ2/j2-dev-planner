import { CATEGORIES, FIELD_STATUSES, PLAN_STATUSES } from './constants'
import { flowOrder, isFilled, summarize } from './utils'

function formatValue(field) {
  const v = field.value
  if (!isFilled(v)) return '_Not answered_'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v).replace(/\n/g, '  \n')
}

export function planToMarkdown({ plan, nodes, edges, fields, comments = [], people = {}, department }) {
  const order = flowOrder(nodes, edges)
  const byNode = new Map()
  for (const f of [...fields].sort((a, b) => a.sort_order - b.sort_order)) {
    if (!byNode.has(f.node_id)) byNode.set(f.node_id, [])
    byNode.get(f.node_id).push(f)
  }
  const commentsByField = new Map()
  for (const c of comments) {
    if (!commentsByField.has(c.field_id)) commentsByField.set(c.field_id, [])
    commentsByField.get(c.field_id).push(c)
  }
  const s = summarize(fields)
  const lines = []
  lines.push(`# ${plan.title}`)
  if (plan.description) lines.push('', plan.description)
  lines.push('', `**Status:** ${PLAN_STATUSES[plan.status] || plan.status}  `)
  if (department) lines.push(`**Department:** ${department.name}  `)
  lines.push(`**Progress:** ${s.pct}% decided (${s.decided} decided, ${s.to_confirm} to confirm, ${s.open} open of ${s.total})`)
  lines.push('', `_Exported ${new Date().toLocaleString()}_`)

  const marks = { decided: '[x]', to_confirm: '[~]', open: '[ ]' }
  order.forEach((nodeId, i) => {
    const n = nodes.find((x) => x.id === nodeId)
    if (!n) return
    const nf = byNode.get(n.id) || []
    const ns = summarize(nf)
    lines.push('', `## ${i + 1}. ${n.title}`)
    const meta = [CATEGORIES[n.category]?.label, n.subtitle].filter(Boolean).join(', ')
    if (meta) lines.push(`_${meta}_`)
    if (nf.length) lines.push(`${ns.decided} of ${ns.total} decided`, '')
    for (const f of nf) {
      const owner = f.owner ? ` (${f.owner})` : ''
      lines.push(`- ${marks[f.status]} **${f.label}**${owner}: ${formatValue(f)}`)
      for (const c of commentsByField.get(f.id) || []) {
        const who = people[c.user_id]?.full_name || people[c.user_id]?.email || 'Someone'
        lines.push(`    - 💬 ${who}: ${c.body.replace(/\n/g, ' ')}`)
      }
    }
    if (n.notes) lines.push('', `> ${n.notes.replace(/\n/g, '\n> ')}`)
  })
  lines.push('', '---', 'Legend: [x] decided, [~] to confirm, [ ] open')
  return lines.join('\n')
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan'
}
