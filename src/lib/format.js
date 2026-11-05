const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
export const money = (n) => inr.format(Number(n || 0))

export const fmtDate = (d, opts = {}) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...opts })
export const fmtDay = (d) =>
  new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
export const fmtRange = (a, b) => `${fmtTime(a)} – ${fmtTime(b)}`

export const pad = (n) => String(n).padStart(2, '0')
export const ymd = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}
// value for <input type="datetime-local">
export const toLocalInput = (d) => {
  const x = new Date(d)
  return `${ymd(x)}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}
export const sameDay = (a, b) => ymd(a) === ymd(b)
export const addMinutes = (d, m) => new Date(new Date(d).getTime() + m * 60000)
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
export const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

export const STATUS = {
  requested: { label: 'Requested', cls: 'bg-sun-100 text-sun-600' },
  scheduled: { label: 'Scheduled', cls: 'bg-brand-100 text-brand-700' },
  completed: { label: 'Completed', cls: 'bg-mint-100 text-mint-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
  missed: { label: 'Missed', cls: 'bg-rose-100 text-rose-600' },
  pending: { label: 'Awaiting check', cls: 'bg-sun-100 text-sun-600' },
  confirmed: { label: 'Received', cls: 'bg-mint-100 text-mint-700' },
  rejected: { label: 'Not received', cls: 'bg-rose-100 text-rose-600' },
  paid: { label: 'Paid', cls: 'bg-mint-100 text-mint-700' },
  partial: { label: 'Part paid', cls: 'bg-sun-100 text-sun-600' },
  due: { label: 'Due', cls: 'bg-rose-100 text-rose-600' },
  void: { label: 'Void', cls: 'bg-slate-100 text-slate-500' },
  credit: { label: 'Discount', cls: 'bg-mint-100 text-mint-700' },
}

export const invoiceState = (inv) => {
  if (inv.status === 'void') return 'void'
  if (Number(inv.amount) < 0) return 'credit'
  const paid = Number(inv.paid_amount || 0)
  if (paid >= Number(inv.amount)) return 'paid'
  if (paid > 0) return 'partial'
  return 'due'
}

export const upiLink = ({ upi, name, amount, note }) => {
  const p = new URLSearchParams({ pa: upi, pn: name || '', cu: 'INR' })
  if (amount) p.set('am', Number(amount).toFixed(2))
  if (note) p.set('tn', note.slice(0, 50))
  return `upi://pay?${p.toString()}`
}

export const hoursOf = (c) => (new Date(c.end_at) - new Date(c.start_at)) / 3600000
export const fmtHours = (h) => `${Number(h.toFixed(2))} hr${h === 1 ? '' : 's'}`

// Mirrors public.class_amount() in the database
export const classAmount = (c, s) => {
  if (!s) return Number(c.fee || 0)
  if (c.is_trial) return 0
  if (c.fee != null) return Number(c.fee)
  if (s.billing_type === 'per_hour') return Math.round(hoursOf(c) * Number(s.hourly_rate || 0) * 100) / 100
  if (s.billing_type === 'per_class') return Number(s.fee_per_class || 0)
  return 0
}

export const planLabel = (s) =>
  s.billing_type === 'per_hour' ? `${inr.format(s.hourly_rate || 0)}/hr`
    : s.billing_type === 'per_class' ? `${inr.format(s.fee_per_class || 0)}/class`
    : `${inr.format(s.monthly_fee || 0)}/month`

// What a family owes right now: bills + classes taken but not yet billed − confirmed payments.
// Negative = advance credit.
export const balanceDue = (b) => (b ? Number(b.billed || 0) + Number(b.unbilled || 0) - Number(b.paid || 0) : 0)
