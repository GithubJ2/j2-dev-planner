import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'

export default function Admin() {
  const { user } = useAuth()
  const toast = useToast()
  const [people, setPeople] = useState(null)
  const [departments, setDepartments] = useState([])
  const [dept, setDept] = useState({ name: '', icon: '📁', color: '#64748b' })

  const load = async () => {
    const [p, d] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('departments').select('*').order('sort_order'),
    ])
    setPeople(p.data ?? [])
    setDepartments(d.data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const setAccess = async (person, approved, role) => {
    const { error } = await supabase.rpc('set_user_access', { target: person.id, make_approved: approved, make_role: role })
    if (error) return toast.error(error.message)
    toast.success(`Updated access for ${person.full_name || person.email}`)
    load()
  }

  const addDept = async (e) => {
    e.preventDefault()
    if (!dept.name.trim()) return
    const { error } = await supabase
      .from('departments')
      .insert({ name: dept.name.trim(), icon: dept.icon || '📁', color: dept.color, sort_order: departments.length + 1 })
    if (error) return toast.error(error.message)
    setDept({ name: '', icon: '📁', color: '#64748b' })
    toast.success('Department added')
    load()
  }

  const renameDept = async (d) => {
    const name = window.prompt('New name for this department', d.name)
    if (name === null || !name.trim() || name.trim() === d.name) return
    const { error } = await supabase.from('departments').update({ name: name.trim() }).eq('id', d.id)
    if (error) return toast.error(error.message)
    load()
  }

  const removeDept = async (d) => {
    if (!window.confirm(`Remove ${d.name}? Its plans stay, but lose their department.`)) return
    const { error } = await supabase.from('departments').delete().eq('id', d.id)
    if (error) return toast.error(error.message)
    load()
  }

  const waiting = (people ?? []).filter((p) => !p.approved)
  const active = (people ?? []).filter((p) => p.approved)

  return (
    <div className="page">
      <h1>Team</h1>

      <section className="panel">
        <h2>Waiting for approval</h2>
        {people && waiting.length === 0 && <p className="muted">Nobody is waiting. New sign-ups appear here.</p>}
        <ul className="people">
          {waiting.map((p) => (
            <li key={p.id}>
              <span><strong>{p.full_name}</strong> <span className="muted">{p.email}</span></span>
              <button className="btn btn-primary btn-sm" onClick={() => setAccess(p, true, 'member')}>Approve</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Members</h2>
        <ul className="people">
          {active.map((p) => (
            <li key={p.id}>
              <span>
                <strong>{p.full_name}</strong> <span className="muted">{p.email}</span>
                {p.role === 'admin' && <span className="tag">Admin</span>}
              </span>
              {p.id !== user.id && (
                <span className="row-actions">
                  {p.role === 'admin' ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => setAccess(p, true, 'member')}>Make member</button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setAccess(p, true, 'admin')}>Make admin</button>
                  )}
                  <button className="btn btn-danger-ghost btn-sm" onClick={() => setAccess(p, false, 'member')}>Remove access</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Departments</h2>
        <ul className="people">
          {departments.map((d) => (
            <li key={d.id}>
              <span><span className="swatch" style={{ background: d.color }} /> {d.icon} {d.name}</span>
              <span className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => renameDept(d)}>Rename</button>
                <button className="btn btn-danger-ghost btn-sm" onClick={() => removeDept(d)}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
        <form className="dept-form" onSubmit={addDept}>
          <input className="input input-icon" value={dept.icon} onChange={(e) => setDept({ ...dept, icon: e.target.value })} aria-label="Icon" />
          <input className="input" placeholder="Department name" value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} aria-label="Department name" />
          <input type="color" value={dept.color} onChange={(e) => setDept({ ...dept, color: e.target.value })} aria-label="Colour" />
          <button className="btn btn-primary" disabled={!dept.name.trim()}>Add department</button>
        </form>
      </section>
    </div>
  )
}
