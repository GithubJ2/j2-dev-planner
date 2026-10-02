import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PLAN_STATUSES } from '../lib/constants'
import { timeAgo } from '../lib/utils'
import ProgressBar from '../components/ProgressBar'
import NewPlanModal from '../components/NewPlanModal'

export default function Dashboard() {
  const [plans, setPlans] = useState(null)
  const [departments, setDepartments] = useState([])
  const [progress, setProgress] = useState({})
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [p, d, pr] = await Promise.all([
        supabase.from('plans').select('*').order('updated_at', { ascending: false }),
        supabase.from('departments').select('*').order('sort_order'),
        supabase.from('plan_progress').select('*'),
      ])
      const err = [p, d, pr].find((r) => r.error)
      if (err) return setError(err.error.message)
      setPlans(p.data)
      setDepartments(d.data)
      setProgress(Object.fromEntries(pr.data.map((r) => [r.plan_id, r])))
    })()
  }, [])

  const deptById = useMemo(() => Object.fromEntries(departments.map((d) => [d.id, d])), [departments])

  const visible = useMemo(() => {
    if (!plans) return []
    const q = query.trim().toLowerCase()
    return plans.filter((p) => {
      if (!showArchived && p.archived) return false
      if (filter === 'templates' && !p.is_template) return false
      if (filter !== 'all' && filter !== 'templates' && p.department_id !== filter) return false
      if (q && !`${p.title} ${p.description ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [plans, filter, query, showArchived])

  const countFor = (key) =>
    (plans ?? []).filter((p) => !p.archived && (key === 'templates' ? p.is_template : p.department_id === key)).length

  const summaryFor = (id) => {
    const r = progress[id] || { total: 0, decided: 0, to_confirm: 0 }
    return { ...r, open: r.total - r.decided - r.to_confirm, pct: r.total ? Math.round((r.decided / r.total) * 100) : 0 }
  }

  const filterName =
    filter === 'all' ? 'All plans' : filter === 'templates' ? 'Templates' : deptById[filter]?.name ?? 'Plans'

  const stats = useMemo(() => {
    const live = visible.filter((p) => !p.archived && !p.is_template)
    const agg = live.reduce(
      (a, p) => {
        const r = progress[p.id]
        if (!r) return a
        return { total: a.total + r.total, decided: a.decided + r.decided, to_confirm: a.to_confirm + r.to_confirm }
      },
      { total: 0, decided: 0, to_confirm: 0 }
    )
    return { plans: live.length, ...agg, open: agg.total - agg.decided - agg.to_confirm }
  }, [visible, progress])

  return (
    <div className="dash">
      <aside className="dash-side" aria-label="Departments">
        <button className={`side-item${filter === 'all' ? ' is-on' : ''}`} onClick={() => setFilter('all')}>
          <span>All plans</span>
          <span className="count">{(plans ?? []).filter((p) => !p.archived).length}</span>
        </button>
        <div className="side-group">Departments</div>
        {departments.map((d) => (
          <button key={d.id} className={`side-item${filter === d.id ? ' is-on' : ''}`} onClick={() => setFilter(d.id)}>
            <span><span className="side-icon">{d.icon}</span>{d.name}</span>
            <span className="count">{countFor(d.id)}</span>
          </button>
        ))}
        <div className="side-group">Reuse</div>
        <button className={`side-item${filter === 'templates' ? ' is-on' : ''}`} onClick={() => setFilter('templates')}>
          <span>Templates</span>
          <span className="count">{countFor('templates')}</span>
        </button>
      </aside>

      <main className="dash-main">
        <div className="dash-head">
          <h1>{filterName}</h1>
          <div className="dash-tools">
            <input className="input search" type="search" placeholder="Search plans" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search plans" />
            <label className="toggle">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>New plan</button>
          </div>
        </div>

        {plans && stats.plans > 0 && (
          <div className="stats">
            <div><strong>{stats.plans}</strong><span>{stats.plans === 1 ? 'active plan' : 'active plans'}</span></div>
            <div><strong>{stats.total ? Math.round((stats.decided / stats.total) * 100) : 0}%</strong><span>decided overall</span></div>
            <div><strong>{stats.to_confirm}</strong><span>to confirm</span></div>
            <div><strong>{stats.open}</strong><span>still open</span></div>
          </div>
        )}

        {error && <p className="form-error">Could not load plans: {error}</p>}
        {!plans && !error && <p className="muted">Loading plans</p>}

        {plans && visible.length === 0 && (
          <div className="empty">
            <p>
              {query ? `No plans match "${query}".` : `No plans in ${filterName} yet. Start one to map out the work.`}
            </p>
            {!query && <button className="btn btn-primary" onClick={() => setCreating(true)}>New plan</button>}
          </div>
        )}

        <ul className="plan-list">
          {visible.map((p) => {
            const dept = deptById[p.department_id]
            const s = summaryFor(p.id)
            return (
              <li key={p.id}>
                <Link to={`/plan/${p.id}`} className={`plan-row${p.archived ? ' is-archived' : ''}`}>
                  <span className="plan-icon" aria-hidden="true">{p.icon}</span>
                  <span className="plan-info">
                    <span className="plan-title">
                      {p.title}
                      {p.is_template && <span className="tag">Template</span>}
                      {p.archived && <span className="tag">Archived</span>}
                    </span>
                    {p.description && <span className="plan-desc">{p.description}</span>}
                    <span className="plan-meta">
                      {dept && <span className="dept" style={{ '--dept': dept.color }}>{dept.name}</span>}
                      <span className={`plan-status st-${p.status}`}>{PLAN_STATUSES[p.status]}</span>
                      <span>Updated {timeAgo(p.updated_at)}</span>
                    </span>
                  </span>
                  <span className="plan-progress">
                    <span className="plan-pct">{s.pct}%</span>
                    <ProgressBar summary={s} size="sm" />
                    <span className="plan-counts">{s.decided} of {s.total} decided</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </main>

      {creating && (
        <NewPlanModal
          departments={departments}
          plans={plans ?? []}
          defaultDepartment={filter !== 'all' && filter !== 'templates' ? filter : ''}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}
