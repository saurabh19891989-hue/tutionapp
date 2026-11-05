import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, BookOpenCheck, Users, Wallet, Megaphone, Settings, UserCircle2, LogOut, Home, ChevronDown, Table2,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { config } from '../lib/supabase'

export function Logo({ size = 40, withText = true, sub }) {
  const { settings } = useAuth() || {}
  const name = settings?.brand_name || config.BRAND_NAME || 'ShikshaGram Home Classes'
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#e0efff" />
        <path d="M12 22 32 13l20 9-20 9z" fill="#2f6fde" />
        <path d="M20 27v8c0 3 5.5 6 12 6s12-3 12-6v-8l-12 5.4z" fill="#2f6fde" opacity=".85" />
        <path d="M50 23v10" stroke="#f5b62f" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="35" r="2.6" fill="#f5b62f" />
        <path d="M14 46c6-3 12-3 18 0 6-3 12-3 18 0v4c-6-3-12-3-18 0-6-3-12-3-18 0z" fill="#34b38a" />
      </svg>
      {withText && (
        <div className="leading-tight">
          <div className="font-extrabold text-ink">{name}</div>
          {sub && <div className="text-xs font-semibold text-muted">{sub}</div>}
        </div>
      )}
    </div>
  )
}

const adminNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/register', label: 'Register', icon: Table2 },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/billing', label: 'Billing', icon: Wallet },
  { to: '/classes', label: 'Classes', icon: BookOpenCheck, desktopOnly: true },
  { to: '/notices', label: 'Notices', icon: Megaphone, desktopOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, desktopOnly: true },
]
const memberNav = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/calendar', label: 'Book', icon: CalendarDays },
  { to: '/classes', label: 'Classes', icon: BookOpenCheck },
  { to: '/fees', label: 'Fees', icon: Wallet },
  { to: '/profile', label: 'Profile', icon: UserCircle2 },
]

function UserMenu() {
  const { profile, user, isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const nav = useNavigate()
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const name = profile?.full_name || user?.email
  const go = (p) => { setOpen(false); nav(p) }
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 font-extrabold text-brand-700">
          {(name || '?').slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[160px] truncate text-sm font-bold sm:block">{name}</span>
        <ChevronDown size={16} className="text-muted" />
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-56 overflow-hidden p-1.5">
          <div className="px-3 py-2 text-xs text-muted">
            Signed in as <b className="break-all text-ink">{user?.email}</b>
            <div className="mt-0.5">{isAdmin ? 'Teacher (admin)' : profile?.account_type === 'student' ? 'Student' : 'Parent'}</div>
          </div>
          <button className="btn-ghost w-full justify-start" onClick={() => go('/profile')}><UserCircle2 size={16} /> My profile</button>
          {isAdmin && (
            <>
              <button className="btn-ghost w-full justify-start lg:hidden" onClick={() => go('/classes')}><BookOpenCheck size={16} /> All classes</button>
              <button className="btn-ghost w-full justify-start lg:hidden" onClick={() => go('/notices')}><Megaphone size={16} /> Notices</button>
              <button className="btn-ghost w-full justify-start lg:hidden" onClick={() => go('/settings')}><Settings size={16} /> Settings</button>
            </>
          )}
          <button className="btn-ghost w-full justify-start text-rose-600" onClick={signOut}><LogOut size={16} /> Sign out</button>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { isAdmin } = useAuth()
  const nav = isAdmin ? adminNav : memberNav
  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
      isActive ? 'bg-brand-600 text-white shadow-sm shadow-brand-200' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
    }`
  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-brand-100 bg-white/70 p-4 backdrop-blur lg:flex">
        <div className="mb-6 px-1"><Logo sub={isAdmin ? 'Teacher panel' : 'Student & parent'} /></div>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}>
              <n.icon size={19} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-sun-100 p-3 text-xs font-semibold text-sun-600">
          “Education is the most powerful weapon which you can use to change the world.”
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-100 bg-paper/85 px-4 py-2.5 backdrop-blur lg:justify-end lg:px-8">
          <div className="lg:hidden"><Logo size={34} /></div>
          <UserMenu />
        </header>
        <main className="safe-bottom mx-auto w-full max-w-6xl px-4 pt-5 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-brand-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {nav.filter((n) => !n.desktopOnly).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${isActive ? 'text-brand-600' : 'text-slate-500'}`
            }
          >
            <n.icon size={21} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
