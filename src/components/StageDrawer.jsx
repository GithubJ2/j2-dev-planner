import { useEffect, useState } from 'react'
import InlineInput from './InlineInput'
import FieldEditor from './FieldEditor'
import ProgressBar from './ProgressBar'
import { CATEGORIES, FIELD_TYPES } from '../lib/constants'
import { summarize } from '../lib/utils'

export default function StageDrawer({
  node,
  fields,
  people,
  owners,
  position,
  onPrev,
  onNext,
  onClose,
  onUpdateNode,
  onUpdateField,
  onAddField,
  onDeleteField,
  onDeleteStage,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cat = CATEGORIES[node.category] || CATEGORIES.process
  const summary = summarize(fields)

  return (
    <aside className="drawer" style={{ '--cat': cat.color }} aria-label={`Stage: ${node.title}`}>
      <div className="drawer-head">
        <div className="drawer-nav">
          <button className="btn btn-ghost btn-sm" onClick={onPrev} disabled={!onPrev}>Previous</button>
          <span className="drawer-pos">Stage {position.index + 1} of {position.total}</span>
          <button className="btn btn-ghost btn-sm" onClick={onNext} disabled={!onNext}>Next</button>
          <button className="icon-btn" onClick={onClose} aria-label="Close stage">×</button>
        </div>
        <select
          className="cat-select"
          value={node.category}
          onChange={(e) => onUpdateNode(node.id, { category: e.target.value })}
          aria-label="Stage type"
        >
          {Object.entries(CATEGORIES).map(([k, c]) => (
            <option key={k} value={k}>{c.label}</option>
          ))}
        </select>
        <InlineInput
          className="drawer-title"
          value={node.title}
          aria-label="Stage name"
          onSave={(v) => v.trim() && onUpdateNode(node.id, { title: v.trim() })}
        />
        <InlineInput
          className="drawer-sub"
          value={node.subtitle ?? ''}
          placeholder="Add a short description"
          aria-label="Stage description"
          onSave={(v) => onUpdateNode(node.id, { subtitle: v.trim() || null })}
        />
        {summary.total > 0 && <ProgressBar summary={summary} size="md" />}
      </div>

      <div className="drawer-body">
        <datalist id="owner-options">
          {owners.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>

        {fields.length === 0 && (
          <p className="empty-note">This stage has no questions yet. Add the first thing your team needs to decide.</p>
        )}
        {fields.map((f) => (
          <FieldEditor key={f.id} field={f} people={people} onUpdate={onUpdateField} onDelete={onDeleteField} />
        ))}

        <AddQuestion onAdd={(data) => onAddField(node.id, data)} />

        <div className="notes-block">
          <label htmlFor="stage-notes">Notes</label>
          <InlineInput
            id="stage-notes"
            multiline
            className="input"
            value={node.notes ?? ''}
            placeholder="Anything else worth recording for this stage"
            onSave={(v) => onUpdateNode(node.id, { notes: v.trim() || null })}
          />
        </div>

        <button
          className="btn btn-danger-ghost"
          onClick={() =>
            window.confirm(`Delete the stage "${node.title}" and all its questions? This cannot be undone.`) &&
            onDeleteStage(node.id)
          }
        >
          Delete stage
        </button>
      </div>
    </aside>
  )
}

function AddQuestion({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [type, setType] = useState('text')
  const [choices, setChoices] = useState('')
  const [owner, setOwner] = useState('')

  const reset = () => {
    setLabel('')
    setType('text')
    setChoices('')
    setOwner('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="btn btn-dashed" onClick={() => setOpen(true)}>
        Add question
      </button>
    )
  }

  const needsChoices = type === 'select' || type === 'multiselect'
  const submit = (e) => {
    e.preventDefault()
    if (!label.trim()) return
    onAdd({
      label: label.trim(),
      field_type: type,
      options: needsChoices ? choices.split('\n').map((s) => s.trim()).filter(Boolean) : [],
      owner: owner.trim() || null,
    })
    reset()
  }

  return (
    <form className="add-question" onSubmit={submit}>
      <label>
        Question
        <input className="input" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What needs deciding?" />
      </label>
      <div className="row-2">
        <label>
          Answer type
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(FIELD_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Who answers
          <input className="input" list="owner-options" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. Jason" />
        </label>
      </div>
      {needsChoices && (
        <label>
          Choices, one per line
          <textarea className="input" rows={3} value={choices} onChange={(e) => setChoices(e.target.value)} />
        </label>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={reset}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!label.trim()}>Add question</button>
      </div>
    </form>
  )
}
