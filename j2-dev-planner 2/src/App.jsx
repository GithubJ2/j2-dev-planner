import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider } from './lib/toast'
import { configMissing } from './lib/supabase'
import TopNav from './components/TopNav'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Pending from './pages/Pending'
import Dashboard from './pages/Dashboard'
import PlanView from './pages/PlanView'
import Admin from './pages/Admin'

export default function App() {
  if (configMissing) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Supabase is not configured</h2>
          <p>
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code> for local
            development, or to the project's environment variables in Vercel, then restart or redeploy.
          </p>
        </div>
      </div>
    )
  }
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  )
}

function Gate() {
  const { session, profile, loading, recovery, isAdmin } = useAuth()
  if (loading) return <div className="splash">Loading J2 Dev Planner</div>
  if (recovery) return <ResetPassword />
  if (!session) return <Login />
  if (!profile?.approved) return <Pending />

  return (
    <div className="app">
      <TopNav />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/plan/:id" element={<PlanView />} />
        <Route path="/team" element={isAdmin ? <Admin /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
