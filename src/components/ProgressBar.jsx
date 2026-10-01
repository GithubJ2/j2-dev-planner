export default function ProgressBar({ summary, size = 'md' }) {
  const { total, decided, to_confirm, open, pct } = summary
  const d = total ? (decided / total) * 100 : 0
  const c = total ? (to_confirm / total) * 100 : 0
  return (
    <div className={`progress progress-${size}`}>
      {size !== 'sm' && (
        <div className="progress-head">
          <span className="progress-pct">{pct}%</span>
          <span className="progress-caption">decided</span>
        </div>
      )}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${decided} decided, ${to_confirm} to confirm, ${open} open`}
        title={`${decided} decided, ${to_confirm} to confirm, ${open} open`}
      >
        <span className="seg seg-decided" style={{ width: `${d}%` }} />
        <span className="seg seg-confirm" style={{ width: `${c}%` }} />
      </div>
      {size === 'lg' && (
        <div className="progress-legend">
          <span><i className="key key-decided" />{decided} decided</span>
          <span><i className="key key-confirm" />{to_confirm} to confirm</span>
          <span><i className="key key-open" />{open} open</span>
        </div>
      )}
    </div>
  )
}
