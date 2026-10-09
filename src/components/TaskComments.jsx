import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { timeAgo } from '../lib/utils'
import { MentionInput, MentionText } from './Mentions'

// Comment count for every task in a project, kept live.
export function useCommentCounts(projectId) {
  const [counts, setCounts] = useState({})
  useEffect(() => {
    const load = () => supabase.from('task_comments').select('task_id').eq('project_id', projectId).then(({ data }) => {
      const c = {}
      for (const r of data ?? []) c[r.task_id] = (c[r.task_id] || 0) + 1
      setCounts(c)
    })
    load()
    const ch = supabase.channel(`task-comments-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `project_id=eq.${projectId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId])
  return counts
}

// The quiet speech-bubble on each row. Faint when empty, shows a number when there are comments.
export function CommentButton({ count, onClick }) {
  return (
    <button type="button" className={`cmt-btn${count ? ' has' : ''}`} onClick={onClick} title={count ? `${count} comment${count > 1 ? 's' : ''}` : 'Comment'} aria-label={count ? `${count} comments` : 'Add a comment'}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}

// Slim side panel with the thread for one task or subtask.
export function CommentsPanel({ task, parentTitle, onClose, highlight }) {
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [people, setPeople] = useState({})
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, email').then(({ data }) => setPeople(Object.fromEntries((data ?? []).map((p) => [p.id, p]))))
  }, [])
  useEffect(() => {
    const load = () => supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at').then(({ data }) => setList(data ?? []))
    load()
    const ch = supabase.channel(`task-thread-${task.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${task.id}` }, load)
      .subscribe()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { supabase.removeChannel(ch); window.removeEventListener('keydown', onKey) }
  }, [task.id, onClose])
  useEffect(() => {
    if (!list) return
    const target = highlight && document.getElementById(`cmt-${highlight}`)
    ;(target || endRef.current)?.scrollIntoView({ block: target ? 'center' : 'end', behavior: 'smooth' })
  }, [list, highlight])

  const post = async (e) => {
    e?.preventDefault()
    const text = body.trim()
    if (!text) return
    setBusy(true)
    const { error } = await supabase.from('task_comments').insert({ task_id: task.id, project_id: task.project_id, user_id: user.id, body: text })
    setBusy(false)
    if (error) return toast.error(error.message)
    setBody('')
  }
  const remove = async (c) => {
    setList((l) => (l ?? []).filter((x) => x.id !== c.id))
    const { error } = await supabase.from('task_comments').delete().eq('id', c.id)
    if (error) toast.error(error.message)
  }
  const who = (id) => { const p = people[id]; return p ? (p.full_name || p.email || '').split(/\s+/)[0] : 'Someone' }

  return (
    <aside className="cmt-panel" role="dialog" aria-label="Comments">
      <div className="cmt-head">
        <div>
          {parentTitle && <div className="small muted">{parentTitle}</div>}
          <div className="cmt-title">{task.title}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="cmt-list">
        {list === null && <div className="small muted">Loading…</div>}
        {list?.length === 0 && <div className="small muted">No comments yet. Updates, links, blockers: drop them here.</div>}
        {list?.map((c) => (
          <div key={c.id} id={`cmt-${c.id}`} className={`cmt${c.user_id === user.id ? ' mine' : ''}${c.id === highlight ? ' flash' : ''}`}>
            <div className="cmt-meta"><b>{who(c.user_id)}</b> · {timeAgo(c.created_at)}
              {(c.user_id === user.id || isAdmin) && <button className="text-btn cmt-del" onClick={() => remove(c)}>delete</button>}
            </div>
            <div className="cmt-body"><MentionText text={c.body} /></div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="cmt-form" onSubmit={post}>
        <MentionInput as="textarea" className="input" rows={2} value={body} autoFocus placeholder="Write a comment… type @ to mention someone"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() } }} />
        <button className="btn btn-primary btn-sm" disabled={busy || !body.trim()}>Post</button>
      </form>
    </aside>
  )
}
