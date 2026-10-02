import { useState } from 'react'
import Modal from './Modal'
import { PLAN_ICONS, PLAN_STATUSES } from '../lib/constants'

export default function PlanSettingsModal({ plan, departments, onSave, onClose }) {
  const [form, setForm] = useState({
    title: plan.title,
    description: plan.description ?? '',
    icon: plan.icon,
    department_id: plan.department_id ?? '',
    status: plan.status,
    is_template: plan.is_template,
  })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setBusy(true)
    await onSave({
      title: form.title.trim(),
      description: form.description.trim() || null,
      icon: form.icon,
      department_id: form.department_id || null,
      status: form.status,
      is_template: form.is_template,
    })
    setBusy(false)
    onClose()
  }

  return (
    <Modal
      title="Plan settings"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="plan-settings" type="submit" disabled={busy || !form.title.trim()}>Save</button>
        </>
      }
    >
      <form id="plan-settings" className="stack" onSubmit={submit}>
        <label>
          Plan name
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label>
          What is this plan for?
          <textarea className="input" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="One or two sentences so a new teammate knows what this is" />
        </label>
        <div className="row-2">
          <label>
            Department
            <select className="input" value={form.department_id} onChange={(e) => set('department_id', e.target.value)}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {Object.entries(PLAN_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="icon-pick">
          <legend>Icon</legend>
          {PLAN_ICONS.map((i) => (
            <button type="button" key={i} className={`icon-opt${form.icon === i ? ' is-on' : ''}`} aria-pressed={form.icon === i} onClick={() => set('icon', i)}>
              {i}
            </button>
          ))}
        </fieldset>
        <label className="toggle">
          <input type="checkbox" checked={form.is_template} onChange={(e) => set('is_template', e.target.checked)} />
          Offer this plan as a template when people create new plans
        </label>
      </form>
    </Modal>
  )
}
