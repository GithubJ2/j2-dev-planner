import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function TopNav() {
  const { profile, isAdmin, signOut } = useAuth()
  const [pending, setPending] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('approved', false)
      .then(({ count }) => setPending(count ?? 0))
  }, [isAdmin])

  return (
    <nav className="topnav">
      <NavLink to="/" className="brand" end>
        <img src="/favicon.svg" alt="" width="22" height="22" />
        <span>J2 Dev Planner</span>
      </NavLink>
      <div className="topnav-links">
        <NavLink to="/" end>Plans</NavLink>
        {isAdmin && (
          <NavLink to="/team">
            Team {pending > 0 && <span className="badge" aria-label={`${pending} waiting for approval`}>{pending}</span>}
          </NavLink>
        )}
      </div>
      <div className="topnav-user">
        <span className="user-name">{profile?.full_name || profile?.email}</span>
        <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
      </div>
    </nav>
  )
}
