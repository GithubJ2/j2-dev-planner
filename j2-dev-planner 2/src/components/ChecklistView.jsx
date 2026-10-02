import { useMemo, useState } from 'react'
import FieldEditor from './FieldEditor'
import ProgressBar from './ProgressBar'
import { CATEGORIES, FIELD_STATUSES } from '../lib/constants'
import { summarize } from '../lib/utils'

export default function ChecklistView({
  order,
  nodes,
  fieldsByNode,
  people,
  owners,
  ownerFilter,
  commentsByField,
  currentUserId,
  isAdmin,
  onUpdateField,
  onDeleteField,
  onMoveField,
  onAddComment,
  onDeleteComment,
  onOpenStage,
}) {
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const matches = (f) =>
    (status === 'all' || f.status === status) &&
    (!ownerFilter || f.owner === ownerFilter) &&
    (!q || `${f.label} ${f.help ?? ''} ${JSON.stringify(f.value ?? '')} ${f.owner ?? ''}`.toLowerCase().includes(q))

  const groups = useMemo(
    () =>
      order
        .map((id) => nodes.find((n) => n.id === id))
        .filter(Boolean)
        .map((n) => {
          const all = fieldsByNode.get(n.id) || []
          return { node: n, all, visible: all.filter(matches) }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order, nodes, fieldsByNode, status, q, ownerFilter]
  )

  const shown = groups.reduce((n, g) => n + g.visible.length, 0)
  const total = groups.reduce((n, g) => n + g.all.length, 0)

  return (
    <div className="checklist">
      <div className="checklist-tools">
        <div className="status-switch" role="group" aria-label="Filter by status">
          {[['all', 'All'], ...Object.entries(FIELD_STATUSES).map(([k, s]) => [k, s.label])].map(([k, label]) => (
            <button key={k} type="button" className={`status-opt status-${k}${status === k ? ' is-on' : ''}`} aria-pressed={status === k} onClick={() => setStatus(k)}>
              {label}
            </button>
          ))}
        </div>
        <input className="input search" type="search" placeholder="Search questions and answers" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search questions" />
        <span className="muted small">{shown} of {total} questions</span>
      </div>

      {groups.length === 0 && <p className="empty">This plan has no stages yet. Switch to the canvas and add one.</p>}

      {groups.map(({ node, all, visible }, i) => {
        if (visible.length === 0 && (status !== 'all' || q || ownerFilter)) return null
        const cat = CATEGORIES[node.category] || CATEGORIES.process
        const s = summarize(all)
        return (
          <section key={node.id} className="check-group" style={{ '--cat': cat.color }}>
            <header className="check-head">
              <div className="check-head-main">
                <span className="check-num">{i + 1}</span>
                <div>
                  <div className="stage-cat">{cat.label}</div>
                  <h2>{node.title}</h2>
                  {node.subtitle && <p className="muted small">{node.subtitle}</p>}
                </div>
              </div>
              <div className="check-head-side">
                {all.length > 0 && <ProgressBar summary={s} size="sm" />}
                <span className="muted small">{s.decided} of {s.total} decided</span>
                {onOpenStage && (
                  <button type="button" className="text-btn" onClick={() => onOpenStage(node.id)}>Open on canvas</button>
                )}
              </div>
            </header>
            {all.length === 0 && <p className="muted small">No questions in this stage yet.</p>}
            {visible.map((f) => {
              const idx = all.findIndex((x) => x.id === f.id)
              return (
                <FieldEditor
                  key={f.id}
                  field={f}
                  people={people}
                  owners={owners}
                  onUpdate={onUpdateField}
                  onDelete={onDeleteField}
                  onMove={onMoveField}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < all.length - 1}
                  comments={commentsByField.get(f.id) || []}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onAddComment={onAddComment}
                  onDeleteComment={onDeleteComment}
                />
              )
            })}
            {node.notes && (
              <div className="check-notes">
                <strong>Notes</strong>
                <p>{node.notes}</p>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
