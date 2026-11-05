import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Wallet, NotebookPen, Megaphone, Phone, Mail, Link as LinkIcon, Hourglass } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Card, Empty, Loading, Stat } from '../../components/ui'
import { CLASS_SELECT, ClassDetailModal, ClassRow, ModeIcon } from '../../components/ClassModals'
import StudentPicker from '../../components/StudentPicker'
import { balanceDue, fmtDate, fmtDay, fmtRange, money } from '../../lib/format'

export function Notices({ limit = 5 }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
      .then(({ data }) => setRows(data || []))
  }, [limit])
  if (!rows?.length) return null
  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Megaphone size={19} className="text-sun-400" /> Notice board</h2>
      <div className="space-y-3">
        {rows.map((n) => (
          <div key={n.id} className={`rounded-xl p-3 ${n.pinned ? 'bg-sun-100' : 'bg-brand-50'}`}>
            <div className="font-bold">{n.title}</div>
            {n.body && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{n.body}</p>}
            <div className="mt-1 text-xs text-muted">{fmtDate(n.created_at)}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function MemberHome() {
  const { profile, user, students, activeStudent, settings } = useAuth()
  const [data, setData] = useState(null)
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    if (!activeStudent) return
    const id = activeStudent.id
    const now = new Date().toISOString()
    const [up, past, bal] = await Promise.all([
      supabase.from('classes').select(CLASS_SELECT).eq('student_id', id).in('status', ['scheduled', 'requested']).gte('end_at', now).order('start_at').limit(5),
      supabase.from('classes').select(CLASS_SELECT).eq('student_id', id).eq('status', 'completed').order('start_at', { ascending: false }).limit(3),
      supabase.from('student_balances').select('*').eq('student_id', id).maybeSingle(),
    ])
    setData({ upcoming: up.data || [], recent: past.data || [], balance: bal.data })
  }, [activeStudent])
  useEffect(() => { load() }, [load])

  const firstName = (profile?.full_name || '').split(' ')[0]

  if (!students.length) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 w-fit rounded-2xl bg-sun-100 p-3 text-sun-600"><Hourglass size={28} /></div>
          <h1 className="text-xl font-extrabold">Welcome{firstName ? `, ${firstName}` : ''}! 👋</h1>
          <p className="mt-2 text-sm text-muted">
            Your account is ready. The teacher just needs to link it to the student. Please share this email with {settings?.teacher_name || 'the teacher'}:
          </p>
          <div className="mx-auto mt-3 w-fit rounded-xl bg-brand-50 px-4 py-2 font-extrabold text-brand-700">{user.email}</div>
          {(settings?.phone || settings?.contact_email) && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {settings.phone && <a className="btn-soft btn-sm" href={`https://wa.me/${settings.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Hello, please link my account (${user.email}) on the class app.`)}`} target="_blank" rel="noreferrer"><Phone size={15} /> WhatsApp</a>}
              {settings.contact_email && <a className="btn-soft btn-sm" href={`mailto:${settings.contact_email}`}><Mail size={15} /> Email</a>}
            </div>
          )}
        </Card>
        <Notices />
      </div>
    )
  }

  const next = data?.upcoming?.find((c) => c.status === 'scheduled')
  const due = balanceDue(data?.balance)
  const feesStat = data && (
    <Stat icon={Wallet} tone={due > 0 ? 'rose' : 'mint'} label={due >= 0 ? 'Fees due' : 'Advance credit'} value={money(Math.abs(due))}
      hint={Number(data.balance?.pending) > 0 ? `${money(data.balance.pending)} awaiting confirmation` : due > 0 ? 'Tap to pay by UPI' : 'All clear'} />
  )

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Hello{firstName ? `, ${firstName}` : ''} 👋</h1>
          <p className="text-sm text-muted">Here’s what’s coming up for {activeStudent?.full_name}.</p>
        </div>
        <StudentPicker />
      </div>

      {!data ? <Loading /> : (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-brand-600 to-brand-500 p-5 text-white">
                <div className="text-xs font-bold uppercase tracking-wide text-brand-100">Next class</div>
                {next ? (
                  <>
                    <div className="mt-1 text-2xl font-extrabold">{fmtDay(next.start_at)}</div>
                    <div className="text-lg font-bold text-brand-50">{fmtRange(next.start_at, next.end_at)}</div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="rounded-full bg-white/20 px-2.5 py-1 font-bold">{next.mode === 'online' ? 'Online' : 'Home visit'}</span>
                      {next.mode === 'online' && (next.meeting_link || activeStudent.meeting_link) && (
                        <a className="flex items-center gap-1 rounded-full bg-white px-3 py-1 font-bold text-brand-700" href={next.meeting_link || activeStudent.meeting_link} target="_blank" rel="noreferrer">
                          <LinkIcon size={14} /> Join
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-lg font-bold">No class booked yet</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                <Link to="/calendar" className="btn-primary"><CalendarPlus size={17} /> Book a class</Link>
                <Link to="/fees" className="btn-soft"><Wallet size={17} /> Fees</Link>
              </div>
            </Card>
            {/* on phones the side column sits at the very bottom, so show the fees right under the next class */}
            <Link to="/fees" className="block lg:hidden">{feesStat}</Link>

            {data.upcoming.length > 0 && (
              <div>
                <h2 className="mb-2 text-lg font-extrabold">Upcoming</h2>
                <div className="space-y-2">{data.upcoming.map((c) => <ClassRow key={c.id} c={c} showStudent={false} onClick={() => setDetail(c)} />)}</div>
              </div>
            )}

            <div>
              <h2 className="mb-2 flex items-center gap-2 text-lg font-extrabold"><NotebookPen size={19} className="text-sun-400" /> Recent classes & homework</h2>
              {data.recent.length ? (
                <div className="space-y-2">{data.recent.map((c) => <ClassRow key={c.id} c={c} showStudent={false} onClick={() => setDetail(c)} />)}</div>
              ) : <Card><Empty title="No completed classes yet" /></Card>}
            </div>
          </div>

          <div className="space-y-5">
            <Link to="/fees" className="hidden lg:block">{feesStat}</Link>
            <Card className="p-4 text-sm">
              <div className="mb-1 flex items-center gap-2 font-extrabold"><ModeIcon mode={activeStudent.default_mode} /> {activeStudent.full_name}</div>
              <div className="text-muted">{[activeStudent.grade && `Class ${activeStudent.grade}`, activeStudent.subjects].filter(Boolean).join(' · ') || '—'}</div>
            </Card>
            <Notices />
          </div>
        </div>
      )}
      <ClassDetailModal cls={detail} onClose={() => setDetail(null)} onChanged={load} />
    </>
  )
}
