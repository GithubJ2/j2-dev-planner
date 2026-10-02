import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { PLAN_ICONS } from '../lib/constants'

export default function NewPlanModal({ departments, plans, defaultDepartment, onClose }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState(defaultDepartment || departments[0]?.id || '')
  const [icon, setIcon] = useState('🗺️')
  const [source, setSource] = useState('blank')
  const [busy, setBusy] = useState(false)

  const templates = plans.filter((p) => p.is_template)
  const others = plans.filter((p) => !p.is_template && !p.archived)

  const create = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    let planId
    if (source === 'blank') {
      const { data, error } = await supabase
        .from('plans')
        .insert({ title: title.trim(), description: description.trim() || null, department_id: departmentId || null, icon, created_by: user.id })
        .select()
        .single()
      if (error) return fail(error)
      planId = data.id
      const { error: nodeErr } = await supabase
        .from('plan_nodes')
        .insert({ plan_id: planId, title: 'First stage', subtitle: 'Rename me and add questions', category: 'process', pos_x: 0, pos_y: 0 })
      if (nodeErr) return fail(nodeErr)
    } else {
      const { data, error } = await supabase.rpc('duplicate_plan', { src: source, new_title: title.trim(), keep_values: false })
      if (error) return fail(error)
      planId = data
      const { error: upErr } = await supabase
        .from('plans')
        .update({ description: description.trim() || null, department_id: departmentId || null, icon, is_template: false, status: 'planning' })
        .eq('id', planId)
      if (upErr) return fail(upErr)
    }
    toast.success('Plan created')
    navigate(`/plan/${planId}`)
  }

  const fail = (error) => {
    setBusy(false)
    toast.error(`Could not create the plan: ${error.message}`)
  }

  return (
    <Modal
      title="New plan"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="new-plan" type="submit" disabled={busy || !title.trim()}>
            {busy ? 'Creating plan' : 'Create plan'}
          </button>
        </>
      }
    >
      <form id="new-plan" className="stack" onSubmit={create}>
        <label>
          Plan name
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Client onboarding portal" />
        </label>
        <label>
          What is this plan for?
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="row-2">
          <label>
            Department
            <select className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
              ))}
            </select>
          </label>
          <label>
            Start from
            <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="blank">Blank canvas</option>
              {templates.length > 0 && (
                <optgroup label="Templates">
                  {templates.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </optgroup>
              )}
              {others.length > 0 && (
                <optgroup label="Copy the structure of">
                  {others.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </optgroup>
              )}
            </select>
          </label>
        </div>
        <fieldset className="icon-pick">
          <legend>Icon</legend>
          {PLAN_ICONS.map((i) => (
            <button
              type="button"
              key={i}
              className={`icon-opt${icon === i ? ' is-on' : ''}`}
              aria-pressed={icon === i}
              onClick={() => setIcon(i)}
            >
              {i}
            </button>
          ))}
        </fieldset>
        {source !== 'blank' && (
          <p className="muted small">Stages, questions and connections are copied. Answers start empty.</p>
        )}
      </form>
    </Modal>
  )
}
