import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { Loading, ToastProvider } from './components/ui'
import Layout, { Logo } from './components/Layout'
import Login from './pages/Login'
import Setup from './pages/Setup'
import CalendarPage from './pages/CalendarPage'
import ClassesPage from './pages/ClassesPage'
import Profile from './pages/Profile'
import MemberHome from './pages/member/Home'
import Fees from './pages/member/Fees'
import Dashboard from './pages/admin/Dashboard'
import Register from './pages/admin/Register'
import Students from './pages/admin/Students'
import Billing from './pages/admin/Billing'
import NoticesAdmin from './pages/admin/Notices'
import SettingsPage from './pages/admin/Settings'

function Gate() {
  const { session, ready, isAdmin } = useAuth()
  if (session === undefined || (session && !ready)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Logo size={56} withText={false} />
        <Loading text="Opening your classroom…" />
      </div>
    )
  }
  if (!session) return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        {isAdmin ? (
          <>
            <Route index element={<Dashboard />} />
            <Route path="register" element={<Register />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="students" element={<Students />} />
            <Route path="billing" element={<Billing />} />
            <Route path="notices" element={<NoticesAdmin />} />
            <Route path="settings" element={<SettingsPage />} />
          </>
        ) : (
          <>
            <Route index element={<MemberHome />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="fees" element={<Fees />} />
          </>
        )}
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  if (!isConfigured) return <Setup />
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Gate />
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
