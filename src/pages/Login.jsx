import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
      })
      if (error) setError(error.message)
      else if (!data.session) setNotice(`We sent a confirmation link to ${email}. Open it to finish creating your account.`)
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) setError(error.message)
      else setNotice(`If ${email} has an account, a reset link is on its way.`)
    }
    setBusy(false)
  }

  const heading = { signin: 'Sign in', signup: 'Create your account', reset: 'Reset your password' }[mode]
  const action = { signin: 'Sign in', signup: 'Create account', reset: 'Send reset link' }[mode]

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/favicon.svg" alt="" width="34" height="34" />
          <div>
            <h1>J2 Dev Planner</h1>
            <p>Map out projects stage by stage, with your team.</p>
          </div>
        </div>
        <h2>{heading}</h2>
        <form className="stack" onSubmit={submit}>
          {mode === 'signup' && (
            <label>
              Full name
              <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label>
            Work email
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          {mode !== 'reset' && (
            <label>
              Password
              <input
                className="input"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-notice">{notice}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'One moment' : action}</button>
        </form>
        <div className="auth-switch">
          {mode === 'signin' && (
            <>
              <button className="text-btn" onClick={() => setMode('signup')}>Create an account</button>
              <button className="text-btn" onClick={() => setMode('reset')}>Forgot password</button>
            </>
          )}
          {mode !== 'signin' && <button className="text-btn" onClick={() => setMode('signin')}>Back to sign in</button>}
        </div>
      </div>
    </div>
  )
}
