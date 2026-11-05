import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { STATUS } from '../lib/format'

export function Card({ className = '', children, ...rest }) {
  return <div className={`card ${className}`} {...rest}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Badge({ status, children, className = '' }) {
  const s = STATUS[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${s?.cls || 'bg-slate-100 text-slate-600'} ${className}`}>
      {children || s?.label || status}
    </span>
  )
}

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin ${className}`} size={18} />
}

export function Loading({ text = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted">
      <Spinner /> {text}
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      {Icon && (
        <div className="mb-3 rounded-2xl bg-brand-50 p-3 text-brand-500">
          <Icon size={26} />
        </div>
      )}
      <p className="font-bold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={`card max-h-[92vh] w-full overflow-y-auto rounded-b-none sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-100 bg-white/95 px-5 py-3.5 backdrop-blur">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button className="rounded-lg p-1.5 text-muted hover:bg-slate-100" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-brand-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Stat({ icon: Icon, label, value, tone = 'brand', hint, onClick }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    sun: 'bg-sun-100 text-sun-600',
    mint: 'bg-mint-100 text-mint-700',
    rose: 'bg-rose-100 text-rose-600',
  }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`card flex items-center gap-3 p-4 text-left ${onClick ? 'transition hover:border-brand-300' : ''}`}>
      <div className={`rounded-xl p-2.5 ${tones[tone]}`}>{Icon && <Icon size={22} />}</div>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wide text-muted">{label}</div>
        <div className="truncate text-xl font-extrabold">{value}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
    </Tag>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 inline-flex flex-wrap gap-1 rounded-xl bg-brand-50 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
            value === t.value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-brand-700'
          }`}
        >
          {t.label}
          {t.count ? <span className="ml-1.5 rounded-full bg-sun-400 px-1.5 text-[11px] text-white">{t.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

// ---- Toasts -------------------------------------------------------------
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((msg, type = 'success') => {
    const id = Math.random()
    setToasts((t) => [...t.slice(-2), { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] lg:bottom-6 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
              t.type === 'error' ? 'bg-rose-600 text-white' : 'bg-ink text-white'
            }`}
          >
            {t.type === 'error' ? <AlertCircle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0 text-mint-100" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// Run an async Supabase call with toast feedback
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async (fn, success) => {
      setBusy(true)
      try {
        const res = await fn()
        if (res?.error) throw res.error
        if (success) toast(success)
        return res ?? true
      } catch (e) {
        toast(e.message || String(e), 'error')
        return null
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )
  return [run, busy]
}
