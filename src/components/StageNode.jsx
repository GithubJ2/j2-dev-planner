import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { CATEGORIES, FIELD_STATUSES } from '../lib/constants'

function StageNode({ data, selected }) {
  const cat = CATEGORIES[data.category] || CATEGORIES.process
  const { fields, dimmed, ownerFilter } = data
  const decided = fields.filter((f) => f.status === 'decided').length
  const forOwner = ownerFilter ? fields.filter((f) => f.owner === ownerFilter).length : 0
  const settled = fields.length > 0 && decided === fields.length
  const untouched = fields.length === 0 || decided === 0

  return (
    <div
      className={`stage${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}${settled ? ' is-settled' : ''}${untouched ? ' is-untouched' : ''}`}
      style={{ '--cat': cat.color }}
    >
      <Handle type="target" position={Position.Left} />
      {settled && <span className="stage-mark" aria-hidden="true" />}
      <div className="stage-cat"><span className="cat-dot" />{cat.label}</div>
      <div className="stage-title">{data.title}</div>
      {data.subtitle && <div className="stage-sub">{data.subtitle}</div>}
      {fields.length > 0 ? (
        <>
          <div className="pips" aria-hidden="true">
            {fields.map((f) => (
              <span
                key={f.id}
                className={`pip pip-${f.status}${ownerFilter && f.owner !== ownerFilter ? ' pip-faded' : ''}`}
                title={`${f.label}: ${FIELD_STATUSES[f.status].label}`}
              />
            ))}
          </div>
          <div className="stage-count">
            {settled ? 'Settled' : `${decided} of ${fields.length} decided`}
            {ownerFilter && forOwner > 0 && <span className="stage-owner">, {forOwner} for {ownerFilter}</span>}
            {data.commentCount > 0 && <span className="stage-comments">{data.commentCount} {data.commentCount === 1 ? 'comment' : 'comments'}</span>}
          </div>
        </>
      ) : (
        <div className="stage-count">No questions yet</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export default memo(StageNode)
