import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// The ProjectR logo can be dragged. Pull it about a quarter of the way down the screen and
// it becomes a frisbee. Let go and it turns into a boomerang, flies out, and comes back to
// its spot in the nav. When it lands, the dump box opens. A plain click still goes home.

const DISC = 60

export default function FrisbeeLogo({ onReturn }) {
  const navigate = useNavigate()
  const homeRef = useRef(null)
  const dragRef = useRef(null)
  const [drag, setDrag] = useState(null)      // { x, y, moved }
  const [flight, setFlight] = useState(null)  // { x, y, rot, t }

  const isDisc = drag && drag.y > window.innerHeight * 0.25

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    if (flight) return
    e.preventDefault()
    dragRef.current = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false }
    setDrag(dragRef.current)
  }

  useEffect(() => {
    if (!drag) return
    const onMove = (e) => {
      const d = dragRef.current
      dragRef.current = { ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6 }
      setDrag(dragRef.current)
    }
    const onUp = (e) => {
      const d = dragRef.current
      const wasDisc = e.clientY > window.innerHeight * 0.25
      setDrag(null)
      if (!wasDisc) { if (!d?.moved) navigate('/'); return }
      // Boomerang: out to the right and up, then curve back to the logo's home.
      const home = homeRef.current?.getBoundingClientRect()
      const hx = (home?.left ?? 16) + (home?.width ?? 24) / 2, hy = (home?.top ?? 16) + (home?.height ?? 24) / 2
      const sx = e.clientX, sy = e.clientY
      const cx = Math.min(window.innerWidth - 80, sx + window.innerWidth * 0.45), cy = Math.max(60, Math.min(sy, hy) - window.innerHeight * 0.25)
      const start = performance.now(), dur = 1100
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur)
        const u = 1 - t
        const x = u * u * sx + 2 * u * t * cx + t * t * hx
        const y = u * u * sy + 2 * u * t * cy + t * t * hy
        setFlight({ x, y, rot: t * 1080, t })
        if (t < 1) requestAnimationFrame(step)
        else setTimeout(() => { setFlight(null); onReturn() }, 120)
      }
      requestAnimationFrame(step)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  const hidden = drag || flight
  return (
    <>
      <span ref={homeRef} className={`brand-logo${hidden ? ' is-lifted' : ''}`} onPointerDown={onPointerDown} title="Click: home. Pull me down the page: dump box" role="button" tabIndex={-1}>
        <img src="/favicon.svg" alt="" width="24" height="24" draggable="false" />
      </span>

      {drag && (
        <div className={`disc${isDisc ? ' is-disc' : ''}`} style={{ left: drag.x - (isDisc ? DISC / 2 : 12), top: drag.y - (isDisc ? DISC / 2 : 12) }} aria-hidden="true">
          {isDisc ? <FrisbeeSvg /> : <img src="/favicon.svg" alt="" width="24" height="24" draggable="false" />}
        </div>
      )}
      {isDisc && <div className="disc-hint" aria-hidden="true">Let it go</div>}

      {flight && (
        <div className="boomerang" style={{ left: flight.x - DISC / 2, top: flight.y - DISC / 2, transform: `rotate(${flight.rot}deg) scale(${1 - flight.t * 0.5})` }} aria-hidden="true">
          <BoomerangSvg />
        </div>
      )}
    </>
  )
}

function FrisbeeSvg() {
  return (
    <svg viewBox="0 0 64 64" width={DISC} height={DISC}>
      <ellipse cx="32" cy="34" rx="30" ry="12" fill="#b31a20" />
      <ellipse cx="32" cy="30" rx="30" ry="12" fill="#d4232a" stroke="#8d1218" strokeWidth="1.5" />
      <ellipse cx="32" cy="30" rx="18" ry="7" fill="none" stroke="#f4a1a5" strokeWidth="1.5" opacity=".8" />
      <ellipse cx="24" cy="26" rx="8" ry="2.5" fill="#fff" opacity=".35" />
    </svg>
  )
}

function BoomerangSvg() {
  return (
    <svg viewBox="0 0 64 64" width={DISC} height={DISC}>
      <path d="M10 50 Q14 20 44 12 Q54 10 54 18 Q54 24 46 24 Q28 26 22 44 Q20 54 14 54 Q10 54 10 50Z" fill="#d4232a" stroke="#8d1218" strokeWidth="2" strokeLinejoin="round" />
      <path d="M18 46 Q22 28 42 18" fill="none" stroke="#f4a1a5" strokeWidth="2" strokeLinecap="round" opacity=".8" />
    </svg>
  )
}
