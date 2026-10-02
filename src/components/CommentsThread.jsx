import { useState } from 'react'
import { personName, timeAgo } from '../lib/utils'

export default function CommentsThread({ comments, people, currentUserId, isAdmin, onAdd, onDelete }) {
  const [open, setOpen] = useState(comments.length > 0)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    await onAdd(body.trim())
    setBody('')
    setBusy(false)
  }

  return (
    <div className="comments">
      <button type="button" className="text-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {comments.length === 0 ? 'Add a comment' : `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`}
      </button>
      {open && (
        <div className="comments-body">
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <div className="comment-head">
                <span className="comment-who">{personName(people, c.user_id)}</span>
                <span className="comment-when">{timeAgo(c.created_at)}</span>
                {(c.user_id === currentUserId || isAdmin) && (
                  <button type="button" className="text-btn comment-delete" onClick={() => window.confirm('Delete this comment?') && onDelete(c.id)}>
                    Delete
                  </button>
                )}
              </div>
              <p className="comment-text">{c.body}</p>
            </div>
          ))}
          <form className="comment-form" onSubmit={submit}>
            <textarea
              className="input"
              rows={2}
              value={body}
              placeholder="Write a comment"
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
              }}
            />
            <button className="btn btn-ghost btn-sm" disabled={busy || !body.trim()}>Post</button>
          </form>
        </div>
      )}
    </div>
  )
}
