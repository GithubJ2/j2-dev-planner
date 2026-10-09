import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// A task's people: [{ name, kind: 'owner' | 'waiting' }]
// Owners are solid chips. People we are waiting on are hollow amber chips with an hourglass.

export function firstName(s) { return (s || '').trim().split(/\s+/)[0] }

// Team = approved ProjectR users (first names), plus any names already used on tasks.
export function useTeam(extra = []) {
  const [team, setTeam] = useState([])
  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('full_name, email').eq('approved', true),
      supabase.from('tasks').select('people').limit(1000),
    ]).then(([pr, tk]) => {
      const fromProfiles = (pr.data ?? []).map((p) => firstName(p.full_name) || (p.email || '').split('@')[0])
      const fromTasks = (tk.data ?? []).flatMap((t) => (Array.isArray(t.people) ? t.people : []).filter((p) => p.kind !== 'waiting').map((p) => p.name))
      setTeam([...new Set([...fromProfiles, ...fromTasks])].filter(Boolean))
    })
  }, [])
  const all = [...new Set([...team, ...extra])].sort((a, b) => a.localeCompare(b))
  return all
}

export function peopleOf(t) {
  if (Array.isArray(t?.people) && t.people.length) return t.people
  return t?.owner ? [{ name: t.owner, kind: 'owner' }] : []
}

export function PeopleView({ task, onClick }) {
  const people = peopleOf(task)
  if (!people.length) return <button type="button" className="chip chip-empty" onClick={onClick}>unassigned</button>
  return (
    <span className="chips" onClick={onClick} role={onClick ? 'button' : undefined}>
      {people.map((p, i) => <span key={i} className={`chip ${p.kind === 'waiting' ? 'chip-wait' : 'chip-owner'}`} title={p.kind === 'waiting' ? 'Waiting on' : 'Owner'}>{p.kind === 'waiting' && <span aria-hidden="true">⏳ </span>}{p.name}</span>)}
    </span>
  )
}

// Click a name to cycle: not involved -> owner -> waiting on -> not involved.
export function PeopleEditor({ value, onChange, team }) {
  const [other, setOther] = useState('')
  const people = value ?? []
  const kindOf = (name) => people.find((p) => p.name.toLowerCase() === name.toLowerCase())?.kind
  const cycle = (name) => {
    const k = kindOf(name)
    const rest = people.filter((p) => p.name.toLowerCase() !== name.toLowerCase())
    if (!k) onChange([...rest, { name, kind: 'owner' }])
    else if (k === 'owner') onChange([...rest, { name, kind: 'waiting' }])
    else onChange(rest)
  }
  const names = [...new Set([...team, ...people.map((p) => p.name)])]
  const addOther = () => { const n = other.trim(); if (!n) return; if (!kindOf(n)) onChange([...people, { name: n, kind: 'owner' }]); setOther('') }
  return (
    <div className="people-editor">
      <div className="chips">
        {names.map((n) => {
          const k = kindOf(n)
          return <button type="button" key={n} className={`chip chip-pick ${k === 'owner' ? 'chip-owner' : k === 'waiting' ? 'chip-wait' : ''}`} onClick={() => cycle(n)} title="Click: owner → waiting on → off">{k === 'waiting' && <span aria-hidden="true">⏳ </span>}{n}</button>
        })}
        <span className="chip-add"><input className="input input-compact" value={other} placeholder="+ someone else" onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOther() } }} onBlur={addOther} /></span>
      </div>
      <div className="small muted">Click a name once for <b>owner</b>, twice for <b>waiting on</b>, three times to clear.</div>
    </div>
  )
}
