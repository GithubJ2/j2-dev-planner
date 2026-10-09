import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// People who can be @mentioned: approved ProjectR users, by first name.
let cache = null
export function useMentionables() {
  const [list, setList] = useState(cache ?? [])
  useEffect(() => {
    if (cache) return
    supabase.from('profiles').select('id, full_name, email').eq('approved', true).then(({ data }) => {
      const seen = new Set()
      cache = (data ?? []).map((p) => {
        const first = ((p.full_name || '').trim().split(/\s+/)[0] || (p.email || '').split('@')[0])
        return { id: p.id, handle: first.replace(/[^A-Za-z0-9_-]/g, ''), name: p.full_name || first }
      }).filter((p) => p.handle && !seen.has(p.handle.toLowerCase()) && seen.add(p.handle.toLowerCase()))
        .sort((a, b) => a.handle.localeCompare(b.handle))
      setList(cache)
    })
  }, [])
  return list
}

// Shows "@Name" in bold-ish chips inside plain text.
export function MentionText({ text }) {
  if (!text) return null
  const parts = String(text).split(/(^|[^A-Za-z0-9._%+-])(@[A-Za-z][A-Za-z0-9_-]*)/g)
  return parts.map((p, i) => (p && p.startsWith('@') && i % 3 === 2 ? <span key={i} className="mention">{p}</span> : p))
}

// An input or textarea with an @ pick-list. Arrow keys / Enter / Tab pick; Esc closes.
export const MentionInput = forwardRef(function MentionInput({ as = 'input', value, onChange, onKeyDown, className = 'input', ...rest }, ref) {
  const people = useMentionables()
  const el = useRef(null)
  const [q, setQ] = useState(null) // { start, text }
  const [idx, setIdx] = useState(0)
  useImperativeHandle(ref, () => el.current)

  const matches = q ? people.filter((p) => p.handle.toLowerCase().startsWith(q.text.toLowerCase()) || p.name.toLowerCase().includes(q.text.toLowerCase())).slice(0, 6) : []

  const detect = (v, caret) => {
    const before = v.slice(0, caret)
    const m = /(^|[^A-Za-z0-9._%+-])@([A-Za-z0-9_-]*)$/.exec(before)
    if (m) { setQ({ start: caret - m[2].length - 1, text: m[2] }); setIdx(0) } else setQ(null)
  }
  const pick = (p) => {
    const caret = el.current.selectionStart
    const v = value.slice(0, q.start) + '@' + p.handle + ' ' + value.slice(caret)
    onChange({ target: { value: v } })
    setQ(null)
    requestAnimationFrame(() => { const pos = q.start + p.handle.length + 2; el.current.focus(); el.current.setSelectionRange(pos, pos) })
  }
  const keyDown = (e) => {
    if (q && matches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); return setIdx((i) => (i + 1) % matches.length) }
      if (e.key === 'ArrowUp') { e.preventDefault(); return setIdx((i) => (i - 1 + matches.length) % matches.length) }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return pick(matches[idx]) }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return setQ(null) }
    }
    onKeyDown?.(e)
  }
  const Tag = as
  return (
    <span className="mention-wrap">
      <Tag ref={el} className={className} value={value} {...rest}
        onChange={(e) => { onChange(e); detect(e.target.value, e.target.selectionStart) }}
        onKeyDown={keyDown}
        onBlur={() => setTimeout(() => setQ(null), 120)} />
      {q && matches.length > 0 && (
        <ul className="mention-pop" role="listbox">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === idx} className={i === idx ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); pick(p) }}>
              <b>@{p.handle}</b> <span className="muted">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </span>
  )
})
