import { useState } from 'react'
import InlineInput from './InlineInput'
import { FIELD_STATUSES, FIELD_TYPES } from '../lib/constants'
import { isFilled, personName, timeAgo } from '../lib/utils'

export default function FieldEditor({ field, people, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const options = Array.isArray(field.options) ? field.options : []

  // Answering an open question moves it to "To confirm" automatically.
  const saveValue = (value) => {
    const patch = { value }
    if (field.status === 'open' && isFilled(value)) patch.status = 'to_confirm'
    onUpdate(field.id, patch)
  }

  const renderInput = () => {
    switch (field.field_type) {
      case 'textarea':
        return (
          <InlineInput
            multiline
            className="input"
            value={field.value ?? ''}
            placeholder="Type an answer"
            onSave={(v) => saveValue(v.trim() === '' ? null : v)}
          />
        )
      case 'number':
        return (
          <InlineInput
            type="number"
            className="input input-short"
            value={field.value ?? ''}
            placeholder="0"
            onSave={(v) => saveValue(v === '' ? null : Number(v))}
          />
        )
      case 'date':
        return (
          <input
            type="date"
            className="input input-short"
            value={field.value ?? ''}
            onChange={(e) => saveValue(e.target.value || null)}
          />
        )
      case 'select': {
        const opts = field.value && !options.includes(field.value) ? [...options, field.value] : options
        return (
          <select className="input" value={field.value ?? ''} onChange={(e) => saveValue(e.target.value || null)}>
            <option value="">Choose one</option>
            {opts.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )
      }
      case 'multiselect': {
        const selected = Array.isArray(field.value) ? field.value : []
        const opts = [...options, ...selected.filter((s) => !options.includes(s))]
        const toggle = (o) => {
          const next = selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]
          saveValue(next.length ? next : null)
        }
        return (
          <div className="chips">
            {opts.map((o) => (
              <button
                key={o}
                type="button"
                className={`chip${selected.includes(o) ? ' is-on' : ''}`}
                aria-pressed={selected.includes(o)}
                onClick={() => toggle(o)}
              >
                {o}
              </button>
            ))}
          </div>
        )
      }
      case 'checkbox':
        return (
          <div className="chips">
            {[
              [true, 'Yes'],
              [false, 'No'],
            ].map(([val, label]) => (
              <button
                key={label}
                type="button"
                className={`chip${field.value === val ? ' is-on' : ''}`}
                aria-pressed={field.value === val}
                onClick={() => saveValue(field.value === val ? null : val)}
              >
                {label}
              </button>
            ))}
          </div>
        )
      default:
        return (
          <InlineInput
            className="input"
            value={field.value ?? ''}
            placeholder="Type an answer"
            onSave={(v) => saveValue(v.trim() === '' ? null : v)}
          />
        )
    }
  }

  return (
    <div className={`field field-${field.status}`}>
      <div className="field-top">
        <div className="field-label">
          {field.label}
          {field.owner && <span className="owner-tag">{field.owner}</span>}
        </div>
        <button type="button" className="text-btn" onClick={() => setEditing((e) => !e)}>
          {editing ? 'Done' : 'Edit question'}
        </button>
      </div>
      {field.help && <p className="field-help">{field.help}</p>}

      {editing && (
        <div className="field-config">
          <label>
            Question
            <InlineInput className="input" value={field.label} onSave={(v) => v.trim() && onUpdate(field.id, { label: v.trim() })} />
          </label>
          <label>
            Hint
            <InlineInput className="input" value={field.help ?? ''} onSave={(v) => onUpdate(field.id, { help: v.trim() || null })} />
          </label>
          <div className="row-2">
            <label>
              Answer type
              <select
                className="input"
                value={field.field_type}
                onChange={(e) => onUpdate(field.id, { field_type: e.target.value, value: null, status: 'open' })}
              >
                {Object.entries(FIELD_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Who answers
              <InlineInput
                className="input"
                list="owner-options"
                value={field.owner ?? ''}
                placeholder="e.g. Jason"
                onSave={(v) => onUpdate(field.id, { owner: v.trim() || null })}
              />
            </label>
          </div>
          {(field.field_type === 'select' || field.field_type === 'multiselect') && (
            <label>
              Choices, one per line
              <InlineInput
                multiline
                className="input"
                value={options.join('\n')}
                onSave={(v) => onUpdate(field.id, { options: v.split('\n').map((s) => s.trim()).filter(Boolean) })}
              />
            </label>
          )}
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => window.confirm(`Delete the question "${field.label}"?`) && onDelete(field.id)}
          >
            Delete question
          </button>
        </div>
      )}

      <div className="field-input">{renderInput()}</div>

      <div className="field-foot">
        <div className="status-switch" role="group" aria-label="Status">
          {Object.entries(FIELD_STATUSES).map(([k, s]) => (
            <button
              key={k}
              type="button"
              className={`status-opt status-${k}${field.status === k ? ' is-on' : ''}`}
              aria-pressed={field.status === k}
              onClick={() => field.status !== k && onUpdate(field.id, { status: k })}
            >
              {s.label}
            </button>
          ))}
        </div>
        {field.updated_by && (
          <span className="field-meta">
            {personName(people, field.updated_by)}, {timeAgo(field.updated_at)}
          </span>
        )}
      </div>
    </div>
  )
}
