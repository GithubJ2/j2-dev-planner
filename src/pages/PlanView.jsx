import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import Modal from '../components/Modal'
import { fmtDate } from './Dashboard'

const EMPTY = { title: '', owner: '', due: '', tag: '', help: '' }

export default function PlanView() {
  const { id } = useParams()
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState('priority')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [hideDone, setHideDone] = useState(false)
  const [hideBlocker, setHideBlocker] = useState(false)
  const [open, setOpen] = useState(() => new Set())
  const [editing, setEditing] = useState(null) // task object or 'new'
  const [form, setForm] = useState(EMPTY)
  const [editProject, setEditProject] = useState(false)
  const [pform, setPform] = useState({ name: '', description: '', target_date: '' })

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).maybeSingle(),
      supabase.from('tasks').select('*').eq('project_id', id).order('priority'),
    ])
    if (p.error || t.error) return setError((p.error || t.error).message)
    if (!p.data) return setError('Project not found')
    setProject(p.data); setTasks(t.data)
  }, [id])
  useEffect(() => { load() }, [load])

  // live updates from teammates
  useEffect(() => {
    const ch = supabase.channel(`tasks-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  const owners = useMemo(() => [...new Set((tasks ?? []).map((t) => (t.owner || '').split(/[,(]/)[0].trim()).filter(Boolean))].sort(), [tasks])
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const dueClass = (t) => {
    if (!t.due || t.done) return ''
    const diff = (new Date(t.due + 'T00:00:00') - today) / 864e5
    return diff < 0 ? 'late' : diff <= 3 ? 'soon' : ''
  }

  const visible = useMemo(() => {
    const list = (tasks ?? []).filter((t) => !(hideDone && t.done)).filter((t) => !(hideBlocker && t.tag === 'blocker')).filter((t) => !ownerFilter || (t.owner || '').startsWith(ownerFilter))
    const cmp = {
      priority: (a, b) => a.priority - b.priority,
      owner: (a, b) => (a.owner || '').localeCompare(b.owner || '') || a.priority - b.priority,
      due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.priority - b.priority,
      status: (a, b) => (a.done - b.done) || a.priority - b.priority,
    }[sort]
    return [...list].sort(cmp)
  }, [tasks, sort, ownerFilter, hideDone, hideBlocker])

  const toggleDone = async (t) => {
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)))
    const { error } = await supabase.from('tasks').update({ done: !t.done }).eq('id', t.id)
    if (error) { toast.error(error.message); load() }
  }
  const move = async (t, dir) => {
    const { error } = await supabase.rpc('move_task', { p_task: t.id, p_dir: dir })
    if (error) return toast.error(error.message)
    load()
  }
  const startEdit = (t) => { setEditing(t); setForm({ title: t.title, owner: t.owner || '', due: t.due || '', tag: t.tag || '', help: t.help || '' }) }
  const startNew = () => { setEditing('new'); setForm(EMPTY) }
  const save = async () => {
    if (!form.title.trim()) return
    const row = { title: form.title.trim(), owner: form.owner.trim() || null, due: form.due || null, tag: form.tag || null, help: form.help.trim() || null }
    let error
    if (editing === 'new') {
      const maxP = Math.max(0, ...(tasks ?? []).map((t) => t.priority))
      ;({ error } = await supabase.from('tasks').insert({ ...row, project_id: id, priority: maxP + 1, created_by: user.id }))
    } else {
      ;({ error } = await supabase.from('tasks').update(row).eq('id', editing.id))
    }
    if (error) return toast.error(error.message)
    setEditing(null); load()
  }
  const remove = async (t) => {
    if (!confirm(`Remove "${t.title}"?`)) return
    const { error } = await supabase.from('tasks').delete().eq('id', t.id)
    if (error) return toast.error(error.message)
    load()
  }
  const saveProject = async () => {
    const { error } = await supabase.from('projects').update({ name: pform.name.trim() || project.name, description: pform.description.trim() || null, target_date: pform.target_date || null }).eq('id', id)
    if (error) return toast.error(error.message)
    setEditProject(false); load()
  }
  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [['Priority', 'Task', 'Owner', 'Due', 'Done', 'Tag', 'Help'].join(',')]
    for (const t of [...(tasks ?? [])].sort((a, b) => a.priority - b.priority)) lines.push([t.priority, t.title, t.owner, t.due, t.done ? 'yes' : 'no', t.tag, t.help].map(esc).join(','))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${project.name.replace(/[^\w-]+/g, '-')}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  if (error) return <div className="page"><p className="form-error">{error}</p><Link to="/" className="back-link">Back to projects</Link></div>
  if (!project || !tasks) return <div className="splash">Loading tracker</div>

  const done = tasks.filter((t) => t.done).length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0

  return (
    <div className="page tracker">
      <Link to="/" className="back-link">← Projects</Link>
      <div className="dash-head">
        <div>
          <h1>{project.name}</h1>
          <p className="muted">{project.description}{project.target_date && <> · Target <strong>{fmtDate(project.target_date)}</strong></>} · {done}/{tasks.length} done</p>
        </div>
        <div className="row-actions">
          <select className="input input-compact" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="priority">By priority</option>
            <option value="owner">By owner</option>
            <option value="due">By due date</option>
            <option value="status">Open first</option>
          </select>
          <select className="input input-compact" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} aria-label="Owner">
            <option value="">Everyone</option>
            {owners.map((o) => <option key={o}>{o}</option>)}
          </select>
          <label className="small"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> hide done</label>
          <label className="small"><input type="checkbox" checked={hideBlocker} onChange={(e) => setHideBlocker(e.target.checked)} /> hide blockers</label>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>Export</button>
          {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => { setPform({ name: project.name, description: project.description || '', target_date: project.target_date || '' }); setEditProject(true) }}>Edit project</button>}
          <button className="btn btn-primary btn-sm" onClick={startNew}>Add task</button>
        </div>
      </div>
      <div className="progress-track progress-lg"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>

      <div className="tracker-wrap">
        <table className="tracker-table">
          <thead><tr><th></th><th>#</th><th>Task</th><th>Owner / waiting on</th><th>Due</th><th>Priority</th><th></th></tr></thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id} className={`${t.done ? 'done' : ''} ${open.has(t.id) ? 'open' : ''}`}>
                <td><input type="checkbox" checked={t.done} onChange={() => toggleDone(t)} aria-label="Done" /></td>
                <td className="num">{t.priority}</td>
                <td>
                  <button className="task-name" onClick={() => setOpen((s) => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })}>
                    {t.title}{t.tag && <span className={`ttag ${t.tag}`}>{t.tag}</span>}
                  </button>
                  {open.has(t.id) && <div className="task-help">{t.help || 'No notes yet. Press ✎ to add some.'}{t.done && t.done_at && <div className="small muted" style={{ marginTop: 6 }}>Done {new Date(t.done_at).toLocaleString('en-GB')}</div>}</div>}
                </td>
                <td><span className="owner-pill">{t.owner || 'unassigned'}</span></td>
                <td className={`due ${dueClass(t)}`}>{fmtDate(t.due)}</td>
                <td><div className="prio"><button className="btn btn-ghost btn-sm" onClick={() => move(t, -1)} title="Higher">▲</button><button className="btn btn-ghost btn-sm" onClick={() => move(t, 1)} title="Lower">▼</button></div></td>
                <td className="row-actions"><button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)} title="Edit">✎</button><button className="btn btn-ghost btn-sm" onClick={() => remove(t)} title="Remove">✕</button></td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={7} className="empty-cell">Nothing here. Add a task or clear the filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'Add task' : 'Edit task'} onClose={() => setEditing(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={!form.title.trim()}>Save</button></>}>
          <div className="stack">
            <label>Task<input className="input" autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Owner / waiting on<input className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="e.g. Jason (ask for channel)" /></label>
            <div className="row-2">
              <label>Due<input className="input" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></label>
              <label>Tag<select className="input" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}><option value="">none</option><option value="critical">critical</option><option value="blocker">blocker</option></select></label>
            </div>
            <label>Help notes<textarea className="input" rows={6} value={form.help} onChange={(e) => setForm({ ...form, help: e.target.value })} placeholder="What to do, step by step. Why it matters." /></label>
          </div>
        </Modal>
      )}

      {editProject && (
        <Modal title="Edit project" onClose={() => setEditProject(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setEditProject(false)}>Cancel</button><button className="btn btn-primary" onClick={saveProject}>Save</button></>}>
          <div className="stack">
            <label>Name<input className="input" value={pform.name} onChange={(e) => setPform({ ...pform, name: e.target.value })} /></label>
            <label>Description<input className="input" value={pform.description} onChange={(e) => setPform({ ...pform, description: e.target.value })} /></label>
            <label>Target date<input className="input" type="date" value={pform.target_date} onChange={(e) => setPform({ ...pform, target_date: e.target.value })} /></label>
          </div>
        </Modal>
      )}
    </div>
  )
}
