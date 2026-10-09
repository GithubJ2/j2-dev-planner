import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import Modal from './Modal'
import { PeopleEditor, PeopleView, useTeam } from './PeopleChips'

// The dump box: paste anything (notes, an email thread, screenshots), AI turns it into tasks,
// you check the result, answer at most 3 quick questions, and add the lot in one go.

const MAX_IMG = 1600

async function fileToDataUrl(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const s = Math.min(1, MAX_IMG / Math.max(img.width, img.height))
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.85)
  } finally { URL.revokeObjectURL(url) }
}

export default function DumpBox({ projectId: initialProject, onClose, onAdded }) {
  const toast = useToast()
  const [projects, setProjects] = useState(null)
  const [projectId, setProjectId] = useState(initialProject || '')
  const [text, setText] = useState('')
  const [images, setImages] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { tasks, questions }
  const [answers, setAnswers] = useState({})
  const [editIdx, setEditIdx] = useState(null) // [i] or [i, j]
  const taRef = useRef(null)
  const team = useTeam()

  useEffect(() => {
    supabase.from('projects').select('id, name').eq('archived', false).order('name').then(({ data }) => setProjects(data ?? []))
  }, [])
  useEffect(() => { if (!result) taRef.current?.focus() }, [result])

  const project = (projects ?? []).find((p) => p.id === projectId)

  const addFiles = async (files) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/')).slice(0, 6 - images.length)
    if (!imgs.length) return
    const urls = await Promise.all(imgs.map(fileToDataUrl))
    setImages((xs) => [...xs, ...urls].slice(0, 6))
  }
  const onPaste = (e) => { if (e.clipboardData?.files?.length) { e.preventDefault(); addFiles(e.clipboardData.files) } }
  const onDrop = (e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }

  const run = async (withAnswers) => {
    if (!projectId) return toast.error('Pick a project first')
    if (!text.trim() && !images.length) return toast.error('Paste or type something first')
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('dump-tasks', { body: { project_id: projectId, project_name: project?.name, text, images, team, answers: withAnswers ? answers : undefined } })
    setBusy(false)
    if (error || data?.error) {
      let msg = data?.error || error?.message || 'Something went wrong'
      try { const ctx = await error?.context?.json(); if (ctx?.error) msg = ctx.error } catch { /* ignore */ }
      return toast.error(msg)
    }
    if (!data.tasks?.length) return toast.error("Couldn't find any tasks in that. Add a line or two of context and try again.")
    setResult(data)
    if (withAnswers) setAnswers({})
  }

  const patch = (i, j, change) => setResult((r) => {
    const tasks = r.tasks.map((t, ti) => {
      if (ti !== i) return t
      if (j == null) return { ...t, ...change }
      return { ...t, subtasks: t.subtasks.map((s, si) => (si === j ? { ...s, ...change } : s)) }
    })
    return { ...r, tasks }
  })
  const removeAt = (i, j) => setResult((r) => ({ ...r, tasks: j == null ? r.tasks.filter((_, ti) => ti !== i) : r.tasks.map((t, ti) => (ti === i ? { ...t, subtasks: t.subtasks.filter((_, si) => si !== j) } : t)) }))
  const addSub = (i) => patch(i, null, { subtasks: [...result.tasks[i].subtasks, { title: '', people: [], due: '', tag: '', help: '' }] })

  const addAll = async () => {
    const tasks = result.tasks.map((t) => ({ ...t, subtasks: t.subtasks.filter((s) => s.title.trim()) })).filter((t) => t.title.trim())
    if (!tasks.length) return
    setBusy(true)
    const { data, error } = await supabase.rpc('add_task_batch', { p_project: projectId, p_tasks: tasks })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success(`${data} added`)
    onAdded?.(projectId)
    onClose()
  }

  const missing = (t) => [!t.people?.length && 'owner', !t.due && 'due'].filter(Boolean)
  const editing = editIdx ? (editIdx.length === 1 ? result.tasks[editIdx[0]] : result.tasks[editIdx[0]].subtasks[editIdx[1]]) : null

  // ---- Step 1: the box ----
  if (!result) {
    return (
      <Modal title="Dump it here" onClose={onClose} wide
        footer={<>
          <span className="small muted" style={{ marginRight: 'auto' }}>Paste text, an email thread, or screenshots. AI sorts it into tasks for you to check.</span>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => run(false)} disabled={busy || !projectId || (!text.trim() && !images.length)}>{busy ? 'Reading…' : 'Sort it out'}</button>
        </>}>
        <div className="stack">
          {!initialProject && (
            <label>Project
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Pick a project</option>
                {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          {initialProject && project && <div className="small muted">Adding to <b>{project.name}</b></div>}
          <textarea ref={taRef} className="input dump-area" rows={10} value={text} onChange={(e) => setText(e.target.value)} onPaste={onPaste} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
            placeholder={"Anything goes. For example:\n\nJarred to set up zoe@ mailbox by Friday, blocks launch.\nJason: ask ConnectWise for API keys, then I test Monday.\nJobix (External) sending the UK number next week."} />
          <div className="dump-files">
            {images.map((src, i) => <span key={i} className="dump-thumb"><img src={src} alt="" /><button type="button" className="icon-btn" onClick={() => setImages((xs) => xs.filter((_, k) => k !== i))} aria-label="Remove">×</button></span>)}
            <label className="btn btn-ghost btn-sm">+ Screenshot<input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} /></label>
            <span className="small muted">or paste one with Ctrl+V</span>
          </div>
        </div>
      </Modal>
    )
  }

  // ---- Step 2: check and add ----
  const count = result.tasks.filter((t) => t.title.trim()).reduce((n, t) => n + 1 + t.subtasks.filter((s) => s.title.trim()).length, 0)
  return (
    <Modal title="Check before adding" onClose={onClose} wide
      footer={<>
        <button className="btn btn-ghost" onClick={() => setResult(null)}>← Back to the box</button>
        <span style={{ marginRight: 'auto' }} />
        <button className="btn btn-primary" onClick={addAll} disabled={busy || !count}>{busy ? 'Adding…' : `Add ${count} to ${project?.name || 'project'}`}</button>
      </>}>
      {result.questions?.length > 0 && (
        <div className="dump-questions">
          <div className="small"><b>Quick questions</b> (skip any you like)</div>
          {result.questions.map((q) => (
            <label key={q} className="small">{q}<input className="input input-compact" value={answers[q] || ''} onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })} placeholder="one line is enough" /></label>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => run(true)} disabled={busy || !Object.values(answers).some((a) => a.trim())}>{busy ? 'Updating…' : 'Update with my answers'}</button>
        </div>
      )}
      <div className="dump-list">
        {result.tasks.map((t, i) => (
          <div key={i} className="dump-task">
            <div className="dump-row">
              <input className="input dump-title" value={t.title} onChange={(e) => patch(i, null, { title: e.target.value })} />
              <button className="icon-btn" onClick={() => removeAt(i)} aria-label="Remove">×</button>
            </div>
            <div className="dump-meta" onClick={() => setEditIdx([i])} role="button" title="Edit">
              <PeopleView task={t} />
              <span className={`due ${!t.due ? 'muted' : ''}`}>{t.due || 'no date'}</span>
              {t.tag && <span className={`ttag ${t.tag}`}>{t.tag}</span>}
              {missing(t).length > 0 && <span className="chip chip-missing">needs {missing(t).join(' + ')}</span>}
            </div>
            {t.help && <div className="small muted dump-help">{t.help}</div>}
            {t.subtasks.map((s, j) => (
              <div key={j} className="dump-sub">
                <span className="sub-arrow" aria-hidden="true">↳</span>
                <input className="input dump-title" value={s.title} onChange={(e) => patch(i, j, { title: e.target.value })} placeholder="Subtask" />
                <span className="dump-meta" onClick={() => setEditIdx([i, j])} role="button" title="Edit"><PeopleView task={s} /><span className={`due ${!s.due ? 'muted' : ''}`}>{s.due || 'no date'}</span></span>
                <button className="icon-btn" onClick={() => removeAt(i, j)} aria-label="Remove">×</button>
              </div>
            ))}
            <button className="text-btn small" onClick={() => addSub(i)}>+ subtask</button>
          </div>
        ))}
        <button className="text-btn small" onClick={() => setResult((r) => ({ ...r, tasks: [...r.tasks, { title: '', people: [], due: '', tag: '', help: '', subtasks: [] }] }))}>+ another task</button>
      </div>

      {editing && (
        <Modal title="Who, when, how" onClose={() => setEditIdx(null)} footer={<button className="btn btn-primary" onClick={() => setEditIdx(null)}>Done</button>}>
          <div className="stack">
            <div><b>{editing.title || 'Untitled'}</b></div>
            <label>Owner / waiting on<PeopleEditor value={editing.people} onChange={(people) => patch(editIdx[0], editIdx[1], { people })} team={team} /></label>
            <div className="row-2">
              <label>Due<input className="input" type="date" value={editing.due} onChange={(e) => patch(editIdx[0], editIdx[1], { due: e.target.value })} /></label>
              <label>Tag<select className="input" value={editing.tag} onChange={(e) => patch(editIdx[0], editIdx[1], { tag: e.target.value })}><option value="">none</option><option value="critical">critical</option><option value="blocker">blocker</option></select></label>
            </div>
            <label>Help notes<textarea className="input" rows={4} value={editing.help} onChange={(e) => patch(editIdx[0], editIdx[1], { help: e.target.value })} /></label>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
