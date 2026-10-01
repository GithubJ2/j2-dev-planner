import { useEffect, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { FIELD_STATUSES } from '../lib/constants'
import { personName, timeAgo } from '../lib/utils'

export default function ActivityPanel({ planId, people, onClose }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    supabase
      .from('activity_log')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })
      .limit(80)
      .then(({ data }) => setRows(data ?? []))
  }, [planId])

  const describe = (r) => {
    const d = r.detail || {}
    if (d.status && d.old_status && d.status !== d.old_status) {
      return <>moved <strong>{d.label}</strong> to {FIELD_STATUSES[d.status]?.label ?? d.status}</>
    }
    return <>answered <strong>{d.label}</strong></>
  }

  return (
    <Modal title="Recent changes" onClose={onClose}>
      {rows === null && <p className="muted">Loading changes</p>}
      {rows?.length === 0 && <p className="muted">No changes yet. Answers and status changes will show up here.</p>}
      <ul className="activity">
        {rows?.map((r) => (
          <li key={r.id}>
            <span className="activity-who">{personName(people, r.user_id)}</span> {describe(r)}
            <span className="activity-when">{timeAgo(r.created_at)}</span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
