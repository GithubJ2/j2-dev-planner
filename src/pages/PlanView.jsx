import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import Modal from '../components/Modal'
import { PeopleEditor, PeopleView, peopleOf, useTeam } from '../components/PeopleChips'
import { fmtDate } from './Dashboard'
import { CommentButton, CommentsPanel, useCommentCounts } from '../components/TaskComments'
import { MentionInput, MentionText } from '../components/Mentions'

const EMPTY = { title: '', people: [], due: '', tag: '', help: '' }

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
  const [editing, setEditing] = useState(null) // task object, or { new: true, parent_id }
  const [form, setForm] = useState(EMPTY)
  const [quickSub, setQuickSub] = useState({}) // parent id -> text being typed
  const [editProject, setEditProject] = useState(false)
  const [commentsFor, setCommentsFor] = useState(null) // task id
  const [highlightComment, setHighlightComment] = useState(null)
  const [flashId, setFlashId] = useState(null)
  const [params, setParams] = useSearchParams()
  const commentCounts = useCommentCounts(id)
  const closeComments = useCallback(() => { setCommentsFor(null); setHighlightComment(null) }, [])
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

  // Arriving from a notification: open the parent, glide to the row, flash it, open the thread.
  useEffect(() => {
    const target = params.get('task')
    if (!target || !tasks) return
    const t = tasks.find((x) => x.id === target)
    if (!t) return
    if (t.parent_id) setOpen((s) => new Set(s).add(t.parent_id))
    if (t.done) setHideDone(false)
    setHideBlocker(false); setOwnerFilter('')
    const comment = params.get('comment')
    setTimeout(() => {
      document.querySelector(`[data-task-id="${target}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setFlashId(target)
      setTimeout(() => setFlashId(null), 2200)
      if (comment) { setHighlightComment(comment); setCommentsFor(target) }
    }, 120)
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, tasks])

  // live updates from teammates
  useEffect(() => {
    const ch = supabase.channel(`tasks-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  const names = useMemo(() => [...new Set((tasks ?? []).flatMap((t) => peopleOf(t).map((p) => p.name)))].sort(), [tasks])
  const team = useTeam(names)
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const dueClass = (t) => {
    if (!t.due || t.done) return ''
    const diff = (new Date(t.due + 'T00:00:00') - today) / 864e5
    return diff < 0 ? 'late' : diff <= 3 ? 'soon' : ''
  }

  // Tree: top-level tasks, each with its subtasks in priority order.
  const children = useMemo(() => {
    const m = {}
    for (const t of tasks ?? []) if (t.parent_id) (m[t.parent_id] ??= []).push(t)
    for (const k in m) m[k].sort((a, b) => a.priority - b.priority)
    return m
  }, [tasks])
  const involves = (t, name) => peopleOf(t).some((p) => p.name === name) || (children[t.id] ?? []).some((s) => peopleOf(s).some((p) => p.name === name))

  const visible = useMemo(() => {
    const list = (tasks ?? []).filter((t) => !t.parent_id)
      .filter((t) => !(hideDone && t.done))
      .filter((t) => !(hideBlocker && t.tag === 'blocker'))
      .filter((t) => !ownerFilter || involves(t, ownerFilter))
    const firstDue = (t) => [t.due, ...(children[t.id] ?? []).map((s) => s.due)].filter(Boolean).sort()[0] || '9999'
    const cmp = {
      priority: (a, b) => a.priority - b.priority,
      owner: (a, b) => (a.owner || '').localeCompare(b.owner || '') || a.priority - b.priority,
      due: (a, b) => firstDue(a).localeCompare(firstDue(b)) || a.priority - b.priority,
      status: (a, b) => (a.done - b.done) || a.priority - b.priority,
    }[sort]
    return [...list].sort(cmp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sort, ownerFilter, hideDone, hideBlocker, children])

  const toggleOpen = (tid) => setOpen((s) => { const n = new Set(s); n.has(tid) ? n.delete(tid) : n.add(tid); return n })
  // A main task is done when all its subtasks are done. Ticking a main task ticks its subtasks too.
  const toggleDone = async (t) => {
    const done = !t.done
    const ids = [t.id]
    if (!t.parent_id) for (const s of children[t.id] ?? []) if (s.done !== done) ids.push(s.id)
    let parentFix = null
    if (t.parent_id) {
      const sibs = (children[t.parent_id] ?? []).map((s) => (s.id === t.id ? { ...s, done } : s))
      const parent = (tasks ?? []).find((x) => x.id === t.parent_id)
      const allDone = sibs.length > 0 && sibs.every((s) => s.done)
      if (parent && parent.done !== allDone) parentFix = { id: parent.id, done: allDone }
    }
    setTasks((ts) => ts.map((x) => (ids.includes(x.id) ? { ...x, done } : parentFix && x.id === parentFix.id ? { ...x, done: parentFix.done } : x)))
    const { error } = await supabase.from('tasks').update({ done }).in('id', ids)
    if (!error && parentFix) {
      const r = await supabase.from('tasks').update({ done: parentFix.done }).eq('id', parentFix.id)
      if (r.error) return toast.error(r.error.message)
      if (parentFix.done) toast.success('All subtasks done, task ticked off')
    }
    if (error) { toast.error(error.message); load() }
  }
  const move = async (t, dir) => {
    const { error } = await supabase.rpc('move_task', { p_task: t.id, p_dir: dir })
    if (error) return toast.error(error.message)
    load()
  }
  const startEdit = (t) => { setEditing(t); setForm({ title: t.title, people: peopleOf(t), due: t.due || '', tag: t.tag || '', help: t.help || '' }) }
  const startNew = (parent_id = null) => { setEditing({ new: true, parent_id }); setForm(EMPTY) }
  const save = async () => {
    if (!form.title.trim()) return
    const row = { title: form.title.trim(), people: form.people, due: form.due || null, tag: form.tag || null, help: form.help.trim() || null }
    if (!form.people.length) row.owner = null
    let error
    if (editing.new) {
      const siblings = (tasks ?? []).filter((t) => (t.parent_id ?? null) === (editing.parent_id ?? null))
      const maxP = Math.max(0, ...siblings.map((t) => t.priority))
      ;({ error } = await supabase.from('tasks').insert({ ...row, project_id: id, parent_id: editing.parent_id, priority: maxP + 1, created_by: user.id }))
      if (editing.parent_id) setOpen((s) => new Set(s).add(editing.parent_id))
    } else {
      ;({ error } = await supabase.from('tasks').update(row).eq('id', editing.id))
    }
    if (error) return toast.error(error.message)
    setEditing(null); load()
  }
  const addQuickSub = async (parent) => {
    const title = (quickSub[parent.id] || '').trim()
    if (!title) return
    const maxP = Math.max(0, ...(children[parent.id] ?? []).map((t) => t.priority))
    const { error } = await supabase.from('tasks').insert({ title, project_id: id, parent_id: parent.id, people: peopleOf(parent), priority: maxP + 1, created_by: user.id })
    if (error) return toast.error(error.message)
    if (parent.done) await supabase.from('tasks').update({ done: false }).eq('id', parent.id)
    setQuickSub((q) => ({ ...q, [parent.id]: '' })); load()
  }
  const remove = async (t) => {
    const n = (children[t.id] ?? []).length
    if (!confirm(`Remove "${t.title}"${n ? ` and its ${n} subtask${n > 1 ? 's' : ''}` : ''}?`)) return
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
    const lines = [['Priority', 'Task', 'Subtask of', 'Owner / waiting on', 'Due', 'Done', 'Tag', 'Help'].join(',')]
    const byId = Object.fromEntries((tasks ?? []).map((t) => [t.id, t]))
    for (const t of [...(tasks ?? [])].sort((a, b) => (byId[a.parent_id]?.priority ?? a.priority) - (byId[b.parent_id]?.priority ?? b.priority) || (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0) || a.priority - b.priority)) {
      lines.push([t.parent_id ? `${byId[t.parent_id]?.priority}.${t.priority}` : t.priority, t.title, byId[t.parent_id]?.title || '', t.owner, t.due, t.done ? 'yes' : 'no', t.tag, t.help].map(esc).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${project.name.replace(/[^\w-]+/g, '-')}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  if (error) return <div className="page"><p className="form-error">{error}</p><Link to="/" className="back-link">Back to projects</Link></div>
  if (!project || !tasks) return <div className="splash">Loading tracker</div>

  const mains = tasks.filter((t) => !t.parent_id)
  const subsAll = tasks.filter((t) => t.parent_id)
  const done = mains.filter((t) => t.done).length
  const subsDoneAll = subsAll.filter((t) => t.done).length
  const pct = subsAll.length ? Math.round((subsDoneAll / subsAll.length) * 100) : mains.length ? Math.round((done / mains.length) * 100) : 0

  const row = (t, parent) => {
    const subs = children[t.id] ?? []
    const subsDone = subs.filter((s) => s.done).length
    const isOpen = open.has(t.id)
    return (
      <tr key={t.id} data-task-id={t.id} className={`${t.done ? 'done' : ''} ${isOpen ? 'open' : ''} ${parent ? 'sub' : ''} ${flashId === t.id ? 'flash' : ''}`}>
        <td><input type="checkbox" checked={t.done} onChange={() => toggleDone(t)} aria-label="Done" /></td>
        <td className="num">{parent ? `${parent.priority}.${t.priority}` : t.priority}</td>
        <td>
          <div className="task-line">
            {parent && <span className="sub-arrow" aria-hidden="true">↳</span>}
            <button className="task-name" onClick={() => (parent ? startEdit(t) : toggleOpen(t.id))} aria-expanded={parent ? undefined : isOpen} title={t.help || (parent ? 'Click to edit' : subs.length ? 'Show subtasks' : 'Add subtasks')}>
              {!parent && <span className={`caret${isOpen ? ' down' : ''}`} aria-hidden="true">▸</span>}
              <MentionText text={t.title} />{t.tag && <span className={`ttag ${t.tag}`}>{t.tag}</span>}
              {subs.length > 0 && <span className={`subcount${subsDone === subs.length ? ' all' : ''}`}>{subsDone}/{subs.length}</span>}
            </button>
          </div>
          {t.help && <div className="task-note"><MentionText text={t.help} /></div>}
        </td>
        <td><PeopleView task={t} onClick={() => startEdit(t)} /></td>
        <td className={`due ${dueClass(t)}`}>{fmtDate(t.due)}</td>
        <td><div className="prio"><button className="btn btn-ghost btn-sm" onClick={() => move(t, -1)} title="Higher">▲</button><button className="btn btn-ghost btn-sm" onClick={() => move(t, 1)} title="Lower">▼</button></div></td>
        <td className="row-actions"><CommentButton count={commentCounts[t.id] || 0} onClick={() => setCommentsFor(t.id)} /><button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)} title="Edit">✎</button><button className="btn btn-ghost btn-sm" onClick={() => remove(t)} title="Remove">✕</button></td>
      </tr>
    )
  }

  return (
    <div className="page tracker">
      <Link to="/" className="back-link">← Projects</Link>
      <div className="dash-head">
        <div>
          <h1>{project.name}</h1>
          <p className="muted">{project.description}{project.target_date && <> · Target <strong>{fmtDate(project.target_date)}</strong></>} · {done}/{mains.length} tasks done{subsAll.length > 0 && <> · {subsDoneAll}/{subsAll.length} steps</>}</p>
        </div>
        <div className="row-actions">
          <select className="input input-compact" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="priority">By priority</option>
            <option value="owner">By owner</option>
            <option value="due">By due date</option>
            <option value="status">Open first</option>
          </select>
          <select className="input input-compact" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} aria-label="Person">
            <option value="">Everyone</option>
            {names.map((o) => <option key={o}>{o}</option>)}
          </select>
          <label className="small"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> hide done</label>
          <label className="small"><input type="checkbox" checked={hideBlocker} onChange={(e) => setHideBlocker(e.target.checked)} /> hide blockers</label>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen((s) => (s.size ? new Set() : new Set(visible.map((t) => t.id))))}>{open.size ? 'Collapse all' : 'Expand all'}</button>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>Export</button>
          {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => { setPform({ name: project.name, description: project.description || '', target_date: project.target_date || '' }); setEditProject(true) }}>Edit project</button>}
          <button className="btn btn-primary btn-sm" onClick={() => startNew(null)}>Add task</button>
        </div>
      </div>
      <div className="progress-track progress-lg"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>

      <div className="tracker-wrap">
        <table className="tracker-table">
          <thead><tr><th></th><th>#</th><th>Task</th><th>Owner / waiting on</th><th>Due</th><th>Priority</th><th></th></tr></thead>
          <tbody>
            {visible.map((t) => {
              const subs = (children[t.id] ?? []).filter((s) => !(hideDone && s.done))
              const isOpen = open.has(t.id)
              return [
                row(t, null),
                ...(isOpen ? subs.map((s) => row(s, t)) : []),
                isOpen && (
                  <tr key={t.id + '-add'} className="sub sub-add">
                    <td></td><td></td>
                    <td colSpan={5}>
                      <form className="quick-sub" onSubmit={(e) => { e.preventDefault(); addQuickSub(t) }}>
                        <span className="sub-arrow" aria-hidden="true">↳</span>
                        <input className="input input-compact" value={quickSub[t.id] || ''} onChange={(e) => setQuickSub((q) => ({ ...q, [t.id]: e.target.value }))} placeholder="Add a subtask and press Enter" />
                        <button type="button" className="text-btn small" onClick={() => startNew(t.id)}>more options…</button>
                      </form>
                    </td>
                  </tr>
                ),
              ]
            })}
            {visible.length === 0 && <tr><td colSpan={7} className="empty-cell">Nothing here. Add a task, pull the logo down for the dump box, or clear the filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.new ? (editing.parent_id ? 'Add subtask' : 'Add task') : (editing.parent_id ? 'Edit subtask' : 'Edit task')} onClose={() => setEditing(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={!form.title.trim()}>Save</button></>}>
          <div className="stack">
            {editing.parent_id && <div className="small muted">Under <b>{tasks.find((t) => t.id === editing.parent_id)?.title}</b></div>}
            <label>Task<MentionInput autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs doing? Type @ to mention someone" /></label>
            <label>Owner / waiting on<PeopleEditor value={form.people} onChange={(people) => setForm({ ...form, people })} team={team} /></label>
            <div className="row-2">
              <label>Due<input className="input" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></label>
              <label>Tag<select className="input" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}><option value="">none</option><option value="critical">critical</option><option value="blocker">blocker</option></select></label>
            </div>
            <label className="small muted">Note (optional, one line)<MentionInput value={form.help} onChange={(e) => setForm({ ...form, help: e.target.value })} placeholder="Only if the title needs it. Steps go in subtasks." /></label>
          </div>
        </Modal>
      )}

      {commentsFor && tasks.find((t) => t.id === commentsFor) && (() => {
        const t = tasks.find((x) => x.id === commentsFor)
        return <CommentsPanel key={t.id} task={t} highlight={highlightComment} parentTitle={t.parent_id ? tasks.find((x) => x.id === t.parent_id)?.title : null} onClose={closeComments} />
      })()}

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
