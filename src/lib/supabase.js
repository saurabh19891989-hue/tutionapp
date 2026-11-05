import { createClient } from '@supabase/supabase-js'

export const config = window.APP_CONFIG || {}

export const isConfigured =
  !!config.SUPABASE_URL &&
  !!config.SUPABASE_ANON_KEY &&
  !config.SUPABASE_URL.includes('YOUR-PROJECT') &&
  !config.SUPABASE_ANON_KEY.startsWith('YOUR-')

export const supabase = isConfigured
  ? createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true, // keep the login in this browser
        autoRefreshToken: true, // silently renew it
        detectSessionInUrl: true, // finish magic-link logins
        flowType: 'pkce', // links come back as ?code=… (works with the #/ router)
        storageKey: 'vct-auth',
      },
    })
  : null

// ---- "Stay logged in for ~15 days" -----------------------------------
// The session renews itself while the app is used. If a device is not
// used for SESSION_DAYS, we sign it out on the next visit.
const LAST_ACTIVE_KEY = 'vct-last-active'
const sessionDays = Number(config.SESSION_DAYS) || 15

function safeGet(k) {
  try { return localStorage.getItem(k) } catch { return null }
}
function safeSet(k, v) {
  try { localStorage.setItem(k, v) } catch { /* private mode */ }
}

export function touchActivity() {
  safeSet(LAST_ACTIVE_KEY, String(Date.now()))
}

export async function enforceSessionWindow() {
  if (!supabase) return
  const last = Number(safeGet(LAST_ACTIVE_KEY) || 0)
  const { data } = await supabase.auth.getSession()
  if (data.session && last && Date.now() - last > sessionDays * 864e5) {
    await supabase.auth.signOut()
  }
  touchActivity()
}

// Friendly message from a Supabase error
export function errMsg(error) {
  if (!error) return ''
  const m = error.message || String(error)
  if (/rate limit/i.test(m)) return 'Too many emails were sent just now. Please wait a minute and try again, or use your password.'
  if (/Invalid login credentials/i.test(m)) return 'Email or password is not correct.'
  if (/expired|invalid.*(otp|token)/i.test(m)) return 'That code is wrong or has expired. Please request a new one.'
  if (/Email not confirmed/i.test(m)) return 'Please confirm your email first — use the code or link we emailed you.'
  return m
}
