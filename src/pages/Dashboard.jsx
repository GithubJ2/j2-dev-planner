import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import Modal from '../components/Modal'

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [projects, setProjects] = useState(null)
  const [progress, setProgress] = useState({})
  const [error, setError] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', target_date: '' })

  const load = async () => {
    const [p, pr] = await Promise.all([
      supabase.from('projects').select('*').order('archived').order('target_date', { ascending: true, nullsFirst: false }),
      supabase.from('project_progress').select('*'),
    ])
    const err = [p, pr].find((r) => r.error)
    if (err) return setError(err.error.message)
    setProjects(p.data)
    setProgress(Object.fromEntries(pr.data.map((r) => [r.project_id, r])))
  }
  useEffect(() => { load() }, [])

  const visible = useMemo(() => (projects ?? []).filter((p) => showArchived || !p.archived), [projects, showArchived])

  const create = async () => {
    if (!form.name.trim()) return
    const { data, error } = await supabase.from('projects').insert({ name: form.name.trim(), description: form.description.trim() || null, target_date: form.target_date || null, created_by: user.id }).select('id').single()
    if (error) return toast.error(error.message)
    setCreating(false)
    toast.success('Project created')
    navigate(`/p/${data.id}`)
  }

  const archive = async (p) => {
    const { error } = await supabase.from('projects').update({ archived: !p.archived }).eq('id', p.id)
    if (error) return toast.error(error.message)
    load()
  }

  if (error) return <div className="page"><p className="form-error">{error}</p></div>
  if (!projects) return <div className="splash">Loading projects</div>

  return (
    <div className="page dash">
      <div className="dash-head">
        <div>
          <h1>Projects</h1>
          <p className="muted">Every launch as one list: who does what, by when.</p>
        </div>
        <div className="row-actions">
          <label className="small"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> show archived</label>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>New project</button>
        </div>
      </div>

      {visible.length === 0 && <div className="empty"><p>No projects yet.</p><button className="btn btn-primary" onClick={() => setCreating(true)}>Create the first one</button></div>}

      <div className="proj-grid">
        {visible.map((p) => {
          const pr = progress[p.id] || { total: 0, done: 0, overdue: 0 }
          const pct = pr.total ? Math.round((pr.done / pr.total) * 100) : 0
          return (
            <div key={p.id} className={`proj-card ${p.archived ? 'is-archived' : ''}`}>
              <Link to={`/p/${p.id}`} className="proj-main">
                <div className="proj-title">{p.name}</div>
                {p.description && <div className="proj-desc">{p.description}</div>}
                <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                <div className="proj-meta">
                  <span>{pr.done}/{pr.total} done</span>
                  {pr.overdue > 0 && <span className="late">{pr.overdue} overdue</span>}
                  {p.target_date && <span>target {fmtDate(p.target_date)}</span>}
                </div>
              </Link>
              {isAdmin && <button className="text-btn small" onClick={() => archive(p)}>{p.archived ? 'Restore' : 'Archive'}</button>}
            </div>
          )
        })}
      </div>

      {creating && (
        <Modal title="New project" onClose={() => setCreating(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button><button className="btn btn-primary" onClick={create} disabled={!form.name.trim()}>Create</button></>}>
          <div className="stack">
            <label>Name<input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. SA outreach launch" /></label>
            <label>Description<input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="One line on what this is" /></label>
            <label>Target date<input className="input" type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></label>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
