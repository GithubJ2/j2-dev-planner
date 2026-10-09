import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/utils'
import { MentionText } from './Mentions'

const VERB = { mention: 'mentioned you', owner: 'made you owner of', waiting: 'is waiting on you for' }

function useNotifications() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('notifications')
      .select('*, tasks(title, parent_id), projects(name), actor:profiles!notifications_actor_id_fkey(full_name, email)')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(60)
    setItems(data ?? [])
  }, [user])
  useEffect(() => {
    load()
    if (!user) return
    const ch = supabase.channel(`notif-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user, load])
  return [items, setItems, load]
}

export default function NotificationsBell() {
  const [items, setItems] = useNotifications()
  const [open, setOpen] = useState(false)
  const unread = items.filter((n) => !n.read_at).length

  return (
    <>
      <button type="button" className={`bell${unread ? ' has' : ''}`} onClick={() => setOpen(true)} aria-label={unread ? `${unread} unread notifications` : 'Notifications'} title="Notifications">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 2.5a5 5 0 0 0-5 5v3.2L3.5 13.5h13L15 10.7V7.5a5 5 0 0 0-5-5zM8 15.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
        {unread > 0 && <span className="bell-n">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && <Drawer items={items} setItems={setItems} onClose={() => setOpen(false)} />}
    </>
  )
}

function Drawer({ items, setItems, onClose }) {
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const [dragX, setDragX] = useState(0)
  const drag = useRef(null)
  const unread = items.filter((n) => !n.read_at).length

  const close = useCallback(() => { setClosing(true); setTimeout(onClose, 220) }, [onClose])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const markRead = async (ids) => {
    if (!ids.length) return
    const now = new Date().toISOString()
    setItems((xs) => xs.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)))
    await supabase.from('notifications').update({ read_at: now }).in('id', ids)
  }
  const markAll = () => markRead(items.filter((n) => !n.read_at).map((n) => n.id))

  const go = (n) => {
    markRead(n.read_at ? [] : [n.id])
    const params = new URLSearchParams({ task: n.task_id || '' })
    if (n.comment_id) params.set('comment', n.comment_id)
    close()
    setTimeout(() => navigate(`/p/${n.project_id}?${params.toString()}`), 120)
  }

  // Swipe the whole drawer right to close it.
  const onDown = (e) => { if (e.target.closest('.notif-item, button')) return; drag.current = { x: e.clientX } }
  const onMove = (e) => { if (!drag.current) return; setDragX(Math.max(0, e.clientX - drag.current.x)) }
  const onUp = () => { if (!drag.current) return; drag.current = null; if (dragX > 90) close(); else setDragX(0) }

  return (
    <div className={`notif-overlay${closing ? ' closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <aside className={`notif-drawer${closing ? ' closing' : ''}`} style={dragX ? { transform: `translateX(${dragX}px)`, transition: 'none' } : undefined}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="dialog" aria-label="Notifications">
        <div className="notif-grab" aria-hidden="true" />
        <div className="notif-head">
          <b>Notifications</b>
          <span className="spacer" />
          <button className="text-btn small" onClick={markAll} disabled={!unread}>Mark all as read</button>
          <button className="icon-btn" onClick={close} aria-label="Close">×</button>
        </div>
        <div className="notif-list">
          {items.length === 0 && <div className="notif-empty">Nothing yet. When someone @mentions you, or adds you to a task, it lands here.</div>}
          {items.map((n) => <Item key={n.id} n={n} onOpen={() => go(n)} onRead={() => markRead([n.id])} />)}
        </div>
        <div className="notif-foot small muted">Swipe an item left to mark it read. Swipe the panel right to close.</div>
      </aside>
    </div>
  )
}

// One notification. Swipe left to mark read; tap to open.
function Item({ n, onOpen, onRead }) {
  const [dx, setDx] = useState(0)
  const st = useRef(null)
  const actor = n.actor ? ((n.actor.full_name || n.actor.email || '').split(/\s+/)[0]) : 'Someone'
  const down = (e) => { st.current = { x: e.clientX, moved: false }; e.currentTarget.setPointerCapture?.(e.pointerId) }
  const move = (e) => {
    if (!st.current) return
    const d = Math.min(0, e.clientX - st.current.x)
    if (Math.abs(d) > 6) st.current.moved = true
    setDx(d)
  }
  const up = () => {
    if (!st.current) return
    const moved = st.current.moved
    st.current = null
    if (dx < -80) { setDx(-400); setTimeout(() => { onRead(); setDx(0) }, 180); return }
    setDx(0)
    if (!moved) onOpen()
  }
  return (
    <div className={`notif-item${n.read_at ? '' : ' unread'}`}>
      <div className="notif-under" aria-hidden="true">Mark read ✓</div>
      <div className="notif-card" style={{ transform: `translateX(${dx}px)`, transition: st.current ? 'none' : undefined }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { st.current = null; setDx(0) }}
        role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
        <div className="notif-line"><b>{actor}</b> {VERB[n.kind] || 'mentioned you'}{n.kind !== 'mention' && <> <b>{n.tasks?.title || 'a task'}</b></>}</div>
        {n.kind === 'mention' && <div className="notif-where">{n.comment_id ? 'in a comment on ' : 'in '}<b>{n.tasks?.title || 'a task'}</b></div>}
        {n.comment_id && n.snippet && <div className="notif-snip"><MentionText text={n.snippet} /></div>}
        <div className="notif-meta">{n.projects?.name} · {timeAgo(n.created_at)}</div>
      </div>
    </div>
  )
}
