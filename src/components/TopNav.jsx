import { useEffect, useState } from 'react'
import HelpPanel from './HelpPanel'
import DumpBox from './DumpBox'
import FrisbeeLogo from './FrisbeeLogo'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function TopNav() {
  const { profile, isAdmin, signOut } = useAuth()
  const [pending, setPending] = useState(0)
  const [help, setHelp] = useState(false)
  const [dump, setDump] = useState(false)
  const { pathname } = useLocation()
  const projectId = /^\/(?:p|plan)\/([0-9a-f-]{36})/i.exec(pathname)?.[1] || ''

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('approved', false)
      .then(({ count }) => setPending(count ?? 0))
  }, [isAdmin])

  // Anyone can open the dump box from anywhere with D.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() !== 'd' || e.metaKey || e.ctrlKey || e.altKey) return
      if (/input|textarea|select/i.test(e.target?.tagName) || e.target?.isContentEditable) return
      setDump(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <nav className="topnav">
      <span className="brand">
        <FrisbeeLogo onReturn={() => setDump(true)} />
        <NavLink to="/" className="brand-name" end>Project<span className="brand-r">R</span></NavLink>
      </span>
      <div className="topnav-links">
        <NavLink to="/" end>Projects</NavLink>
        {isAdmin && (
          <NavLink to="/team">
            Team {pending > 0 && <span className="badge" aria-label={`${pending} waiting for approval`}>{pending}</span>}
          </NavLink>
        )}
      </div>
      <div className="topnav-user">
        <button className="btn btn-ghost btn-sm dump-btn" onClick={() => setDump(true)} title="Paste notes, emails or screenshots and let AI sort them into tasks (D)">Dump</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setHelp(true)}>Help</button>
        <span className="user-name">{profile?.full_name || profile?.email}</span>
        <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
      </div>
      {help && <HelpPanel onClose={() => setHelp(false)} />}
      {dump && <DumpBox projectId={projectId} onClose={() => setDump(false)} />}
    </nav>
  )
}
