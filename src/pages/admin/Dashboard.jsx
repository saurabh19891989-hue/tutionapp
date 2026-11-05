import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, BellRing, BadgeIndianRupee, TrendingUp, CheckCircle2, XCircle, Plus, Table2, CalendarPlus, ClipboardCheck, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Card, Empty, Loading, Stat, useAction } from '../../components/ui'
import { CLASS_SELECT, ClassDetailModal, ClassFormModal, ClassRow } from '../../components/ClassModals'
import { balanceDue, classAmount, fmtDate, hoursOf, money } from '../../lib/format'

export function usePaymentActions(onDone) {
  const [run, busy] = useAction()
  const setStatus = async (p, status) => {
    if (await run(() => supabase.from('payments').update({ status }).eq('id', p.id), status === 'confirmed' ? `${money(p.amount)} confirmed` : 'Marked as not received')) onDone()
  }
  return [setStatus, busy]
}

export function PendingPayments({ rows, onChanged }) {
  const [setStatus, busy] = usePaymentActions(onChanged)
  if (!rows.length) return <Empty icon={BadgeIndianRupee} title="Nothing to verify" text="When a parent reports a payment, it shows up here." />
  return (
    <div className="space-y-2">
      {rows.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sun-400/40 bg-sun-100/50 p-3">
          <div className="min-w-0">
            <div className="font-extrabold">{money(p.amount)} <span className="font-semibold text-muted">· {p.students?.full_name}</span></div>
            <div className="text-xs text-muted">{fmtDate(p.paid_on)} · {p.method.toUpperCase()}{p.reference ? ` · Ref ${p.reference}` : ''}</div>
          </div>
          <div className="flex gap-1.5">
            <button className="btn-success btn-sm" disabled={busy} onClick={() => setStatus(p, 'confirmed')}><CheckCircle2 size={14} /> Received</button>
            <button className="btn-danger btn-sm" disabled={busy} onClick={() => setStatus(p, 'rejected')}><XCircle size={14} /> No</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { students, profile } = useAuth()
  const nav = useNavigate()
  const [d, setD] = useState(null)
  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayEnd = new Date(dayStart.getTime() + 864e5)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const [today, requests, toMark, pay, bal, month] = await Promise.all([
      supabase.from('classes').select(CLASS_SELECT).gte('start_at', dayStart.toISOString()).lt('start_at', dayEnd.toISOString()).neq('status', 'cancelled').order('start_at'),
      supabase.from('classes').select(CLASS_SELECT).eq('status', 'requested').order('start_at'),
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('status', 'scheduled').lt('end_at', now.toISOString()),
      supabase.from('payments').select('*, students(full_name)').eq('status', 'pending').order('created_at'),
      supabase.from('student_balances').select('*'),
      supabase.from('classes').select('start_at, end_at, fee, is_trial, student_id, students(billing_type, hourly_rate, fee_per_class)').eq('status', 'completed').gte('start_at', monthStart.toISOString()),
    ])
    const outstanding = (bal.data || []).reduce((a, b) => a + Math.max(0, balanceDue(b)), 0)
    const unbilled = (bal.data || []).reduce((a, b) => a + Number(b.unbilled), 0)
    const mc = month.data || []
    setD({
      today: today.data || [], requests: requests.data || [], toMark: toMark.count || 0, payments: pay.data || [],
      outstanding, unbilled,
      monthHours: mc.reduce((a, c) => a + hoursOf(c), 0),
      monthEarned: mc.reduce((a, c) => a + classAmount(c, c.students), 0)
        + students.filter((s) => s.billing_type === 'monthly').reduce((a, s) => a + Number(s.monthly_fee || 0), 0),
    })
  }, [students])
  useEffect(() => { load() }, [load])

  const hello = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{hello}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} 👋</h1>
          <p className="text-sm text-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {students.length} active student{students.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/register" className="btn-soft"><Table2 size={17} /> Register</Link>
          <button className="btn-primary" onClick={() => setEditing({})}><Plus size={17} /> Add class</button>
        </div>
      </div>

      {!d ? <Loading /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={CalendarClock} label="Classes today" value={d.today.length} onClick={() => nav('/calendar')} />
            <Stat icon={BellRing} tone="sun" label="Requests" value={d.requests.length} hint={d.toMark ? `${d.toMark} class(es) to mark` : undefined} onClick={() => nav('/classes')} />
            <Stat icon={BadgeIndianRupee} tone="rose" label="To collect" value={money(d.outstanding)} hint={d.unbilled ? `incl. ${money(d.unbilled)} not billed yet` : undefined} onClick={() => nav('/billing')} />
            <Stat icon={TrendingUp} tone="mint" label="This month" value={money(d.monthEarned)} hint={`${Number(d.monthHours.toFixed(2))} hrs taught`} onClick={() => nav('/register')} />
          </div>

          {!students.length && (
            <Card className="mb-5 p-5">
              <h2 className="text-lg font-extrabold">Let’s get set up 🚀</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                <li>Add your UPI ID and phone in <Link className="font-bold text-brand-600" to="/settings">Settings</Link>.</li>
                <li>Add your students with their fee (per hour / class / month) and parent emails in <Link className="font-bold text-brand-600" to="/students">Students</Link>.</li>
                <li>Share the app link — parents sign up with the same email and are linked automatically.</li>
                <li>Log classes daily in the <Link className="font-bold text-brand-600" to="/register">Register</Link>, or open slots in the <Link className="font-bold text-brand-600" to="/calendar">Calendar</Link> for families to book.</li>
              </ol>
              <Link to="/students" className="btn-primary mt-4"><Users size={17} /> Add first student</Link>
            </Card>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-extrabold">Today’s classes</h2>
                <Link to="/calendar" className="btn-ghost btn-sm"><CalendarPlus size={15} /> Calendar</Link>
              </div>
              {d.today.length ? (
                <div className="space-y-2">{d.today.map((c) => <ClassRow key={c.id} c={c} onClick={() => setDetail(c)} />)}</div>
              ) : <Empty icon={CalendarClock} title="No classes today" text="Enjoy the break — or open some slots for booking." />}
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 text-lg font-extrabold">Payments to verify</h2>
              <PendingPayments rows={d.payments} onChanged={load} />
            </Card>

            <Card className="p-4 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-extrabold">Class requests</h2>
                {d.toMark > 0 && <Link to="/classes" className="btn-soft btn-sm"><ClipboardCheck size={15} /> {d.toMark} to mark</Link>}
              </div>
              {d.requests.length ? (
                <div className="grid gap-2 md:grid-cols-2">{d.requests.map((c) => <ClassRow key={c.id} c={c} onClick={() => setDetail(c)} />)}</div>
              ) : <Empty icon={BellRing} title="No pending requests" />}
            </Card>
          </div>
        </>
      )}
      <ClassDetailModal cls={detail} onClose={() => setDetail(null)} onChanged={load} onEdit={(c) => setEditing(c)} />
      <ClassFormModal open={!!editing} initial={editing?.id ? editing : null} students={students} onClose={() => setEditing(null)} onSaved={load} />
    </>
  )
}
