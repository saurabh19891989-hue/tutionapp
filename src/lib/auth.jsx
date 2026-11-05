import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, enforceSessionWindow, touchActivity } from './supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

const ACTIVE_STUDENT_KEY = 'vct-active-student'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [students, setStudents] = useState([])
  const [activeStudentId, setActiveStudentIdState] = useState(() => {
    try { return localStorage.getItem(ACTIVE_STUDENT_KEY) } catch { return null }
  })
  const [ready, setReady] = useState(false)

  const setActiveStudentId = (id) => {
    setActiveStudentIdState(id)
    try { localStorage.setItem(ACTIVE_STUDENT_KEY, id) } catch { /* ignore */ }
  }

  useEffect(() => {
    let sub
    ;(async () => {
      await enforceSessionWindow()
      const { data } = await supabase.auth.getSession()
      setSession(data.session ?? null)
      sub = supabase.auth.onAuthStateChange((_e, s) => {
        setSession(s ?? null)
        if (s) touchActivity()
      }).data.subscription
    })()
    const onVisible = () => document.visibilityState === 'visible' && touchActivity()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      sub?.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const loadUserData = useCallback(async () => {
    if (!session) {
      setProfile(null); setIsAdmin(false); setStudents([]); setSettings(null); setReady(true)
      return
    }
    const uid = session.user.id
    const [p, s, a, st] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.rpc('is_admin'),
      supabase.from('students').select('*').eq('active', true).order('full_name'),
    ])
    setProfile(p.data)
    setSettings(s.data)
    setIsAdmin(!!a.data)
    setStudents(st.data || [])
    setReady(true)
  }, [session])

  useEffect(() => {
    if (session === undefined) return
    setReady(false)
    loadUserData()
  }, [session, loadUserData])

  // members: make sure a valid student is selected
  const activeStudent =
    students.find((s) => s.id === activeStudentId) || students[0] || null

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    settings,
    isAdmin,
    students,
    activeStudent,
    setActiveStudentId,
    ready: session !== undefined && ready,
    refresh: loadUserData,
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
