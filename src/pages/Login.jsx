import { useEffect, useState } from 'react'
import { Mail, KeyRound, ArrowLeft, GraduationCap, CalendarCheck2, Wallet, Sparkles } from 'lucide-react'
import { supabase, errMsg, config } from '../lib/supabase'
import { Logo } from '../components/Layout'
import { Field, Spinner } from '../components/ui'

const redirectTo = () => window.location.origin + window.location.pathname

export default function Login() {
  const [mode, setMode] = useState('signin') // signin | signup
  const [method, setMethod] = useState('code') // code | password
  const [step, setStep] = useState('form') // form | code
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [accountType, setAccountType] = useState('parent')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [codeKind, setCodeKind] = useState('otp') // otp | signup

  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const meta = mode === 'signup' ? { full_name: name.trim(), phone: phone.trim(), account_type: accountType } : undefined
  const cleanEmail = email.trim().toLowerCase()

  async function sendCode() {
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo(), data: meta },
    })
    if (error) throw error
    setCodeKind('otp')
    setStep('code')
    setCooldown(45)
    setInfo(`We emailed a 6-digit code to ${cleanEmail}. You can also just tap the link in that email.`)
  }

  async function submit(e) {
    e.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'signup' && !name.trim()) throw new Error('Please enter your name.')
      if (method === 'code') {
        await sendCode()
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
        if (error) throw error
      } else {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.')
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail, password, options: { data: meta, emailRedirectTo: redirectTo() },
        })
        if (error) throw error
        if (!data.session) {
          setCodeKind('signup')
          setStep('code')
          setCooldown(45)
          setInfo(`Almost done! We emailed a code to ${cleanEmail} to confirm it's you. Enter it below or tap the link in the email.`)
        }
      }
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  async function verify(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const token = code.replace(/\s/g, '')
      let { error } = await supabase.auth.verifyOtp({ email: cleanEmail, token, type: 'email' })
      if (error && codeKind === 'signup') {
        ;({ error } = await supabase.auth.verifyOtp({ email: cleanEmail, token, type: 'signup' }))
      }
      if (error) throw error
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError(''); setBusy(true)
    try {
      if (codeKind === 'signup') {
        const { error } = await supabase.auth.resend({ type: 'signup', email: cleanEmail, options: { emailRedirectTo: redirectTo() } })
        if (error) throw error
        setCooldown(45)
        setInfo('A new code is on its way.')
      } else {
        await sendCode()
      }
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-100 via-brand-50 to-sun-100 p-12 lg:flex lg:flex-col">
        <Logo size={48} />
        <div className="my-auto max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight text-ink">
            Learning made simple,<br />at home or online.
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Book classes, follow the timetable, see homework and pay fees — all in one place with {config.TEACHER_NAME || 'your teacher'}.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              [CalendarCheck2, 'Book a slot in seconds', 'See open times and reserve the one that suits you.'],
              [GraduationCap, 'Track every class', 'Topics covered and homework, class by class.'],
              [Wallet, 'Fees without the hassle', 'See what is due and pay by UPI.'],
            ].map(([Icon, t, d]) => (
              <li key={t} className="flex gap-3">
                <div className="rounded-xl bg-white p-2.5 text-brand-600 shadow-sm"><Icon size={22} /></div>
                <div><div className="font-bold">{t}</div><div className="text-sm text-slate-600">{d}</div></div>
              </li>
            ))}
          </ul>
        </div>
        <svg className="pointer-events-none absolute -bottom-10 -right-10 opacity-30" width="280" height="280" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#2f6fde" strokeWidth="1.5" strokeDasharray="3 5" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="#f5b62f" strokeWidth="1.5" strokeDasharray="2 4" />
        </svg>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo size={44} /></div>

          {step === 'code' ? (
            <form onSubmit={verify} className="space-y-4">
              <button type="button" onClick={() => { setStep('form'); setCode(''); setError('') }} className="btn-ghost -ml-3 btn-sm">
                <ArrowLeft size={16} /> Back
              </button>
              <h2 className="text-2xl font-extrabold">Check your email</h2>
              {info && <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{info}</p>}
              <Field label="6-digit code">
                <input
                  className="input text-center text-2xl font-extrabold tracking-[0.4em]"
                  inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={10}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} placeholder="••••••"
                />
              </Field>
              {error && <p className="rounded-xl bg-rose-100 p-3 text-sm font-semibold text-rose-600">{error}</p>}
              <button className="btn-primary w-full py-3" disabled={busy || code.length < 6}>
                {busy && <Spinner />} Verify & continue
              </button>
              <p className="text-center text-sm text-muted">
                Didn’t get it? Check spam, or{' '}
                <button type="button" className="font-bold text-brand-600 disabled:text-muted" disabled={cooldown > 0 || busy} onClick={resend}>
                  {cooldown > 0 ? `resend in ${cooldown}s` : 'send again'}
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h2 className="text-2xl font-extrabold">{mode === 'signin' ? 'Welcome back 👋' : 'Create your account'}</h2>
                <p className="mt-1 text-sm text-muted">
                  {mode === 'signin' ? 'Sign in once — you’ll stay signed in on this device.' : 'For students and parents. It takes under a minute.'}
                </p>
              </div>

              {mode === 'signup' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {[['parent', 'I’m a parent'], ['student', 'I’m a student']].map(([v, l]) => (
                      <button type="button" key={v} onClick={() => setAccountType(v)}
                        className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition ${accountType === v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-brand-100 bg-white text-slate-500'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <Field label="Your name">
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anita Sharma" autoComplete="name" />
                  </Field>
                  <Field label="Phone (optional)">
                    <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" inputMode="tel" autoComplete="tel" />
                  </Field>
                </>
              )}

              <Field label="Email">
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </Field>

              <div className="grid grid-cols-2 gap-1 rounded-xl bg-brand-50 p-1">
                {[['code', 'Email code', Mail], ['password', 'Password', KeyRound]].map(([v, l, Icon]) => (
                  <button type="button" key={v} onClick={() => setMethod(v)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold ${method === v ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                    <Icon size={16} /> {l}
                  </button>
                ))}
              </div>

              {method === 'password' && (
                <Field label={mode === 'signup' ? 'Choose a password' : 'Password'} hint={mode === 'signin' ? 'Forgot it? Switch to “Email code” — you can set a new password from your profile.' : 'At least 6 characters.'}>
                  <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
                </Field>
              )}

              {error && <p className="rounded-xl bg-rose-100 p-3 text-sm font-semibold text-rose-600">{error}</p>}

              <button className="btn-primary w-full py-3" disabled={busy}>
                {busy ? <Spinner /> : method === 'code' ? <Sparkles size={18} /> : null}
                {method === 'code' ? 'Email me a code' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>

              <p className="text-center text-sm text-muted">
                {mode === 'signin' ? 'New here? ' : 'Already have an account? '}
                <button type="button" className="font-bold text-brand-600" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}>
                  {mode === 'signin' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
