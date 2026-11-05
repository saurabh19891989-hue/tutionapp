import { useEffect, useMemo, useState } from 'react'
import { Home, Video, Clock, MapPin, Link as LinkIcon, NotebookPen, CheckCircle2, XCircle, Trash2, UserX, IndianRupee, CalendarClock, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge, Field, Modal, Spinner, useAction } from './ui'
import { addMinutes, classAmount, fmtDay, fmtHours, fmtRange, hoursOf, money, planLabel, toLocalInput, ymd } from '../lib/format'

export const CLASS_SELECT = '*, students(id, full_name, phone, address, meeting_link, fee_per_class, hourly_rate, billing_type)'

export function ModeIcon({ mode, size = 15 }) {
  return mode === 'online' ? <Video size={size} className="text-brand-500" /> : <Home size={size} className="text-mint-500" />
}

export function ClassRow({ c, showStudent = true, onClick }) {
  const faded = c.status === 'cancelled'
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border border-brand-100 bg-white p-3 text-left transition hover:border-brand-300 ${faded ? 'opacity-60' : ''}`}
    >
      <div className="w-16 shrink-0 rounded-lg bg-brand-50 py-1.5 text-center">
        <div className="text-[11px] font-bold uppercase text-brand-600">
          {new Date(c.start_at).toLocaleDateString('en-IN', { weekday: 'short' })}
        </div>
        <div className="text-lg font-extrabold leading-tight">{new Date(c.start_at).getDate()}</div>
        <div className="text-[11px] font-semibold text-muted">
          {new Date(c.start_at).toLocaleDateString('en-IN', { month: 'short' })}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showStudent && <span className="font-extrabold">{c.students?.full_name || 'Student'}</span>}
          <Badge status={c.status} />
          {c.is_trial && <Badge status="requested">Trial</Badge>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
          <span className="flex items-center gap-1"><Clock size={14} /> {fmtRange(c.start_at, c.end_at)} · {fmtHours(hoursOf(c))}</span>
          <span className="flex items-center gap-1"><ModeIcon mode={c.mode} size={14} /> {c.mode === 'online' ? 'Online' : 'Home visit'}</span>
        </div>
        {(c.topic || c.subject) && (
          <div className="mt-1 truncate text-sm"><b>{c.subject}</b>{c.subject && c.topic ? ' · ' : ''}{c.topic}</div>
        )}
        {c.homework && <div className="mt-0.5 truncate text-sm text-sun-600">Homework: {c.homework}</div>}
      </div>
    </button>
  )
}

// ----------------------------------------------------------------------
// Teacher: add or edit a class
// ----------------------------------------------------------------------
export function ClassFormModal({ open, onClose, onSaved, students, initial, defaultDate }) {
  const { settings } = useAuth()
  const editing = !!initial?.id
  const [form, setForm] = useState({})
  const [run, busy] = useAction()

  useEffect(() => {
    if (!open) return
    const start = initial?.start_at
      ? new Date(initial.start_at)
      : (() => { const d = new Date(defaultDate || Date.now()); d.setHours(17, 0, 0, 0); return d })()
    const minutes = initial?.end_at
      ? Math.round((new Date(initial.end_at) - new Date(initial.start_at)) / 60000)
      : settings?.default_class_minutes || 60
    const st = students.find((s) => s.id === initial?.student_id) || students[0]
    setForm({
      student_id: initial?.student_id || st?.id || '',
      start: toLocalInput(start),
      minutes,
      mode: initial?.mode || st?.default_mode || 'home',
      status: initial?.status || 'scheduled',
      subject: initial?.subject || '',
      topic: initial?.topic || '',
      homework: initial?.homework || '',
      meeting_link: initial?.meeting_link || '',
      fee: initial?.fee ?? '',
      is_trial: !!initial?.is_trial,
      repeat: 1,
    })
  }, [open, initial, defaultDate, students, settings])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const student = students.find((s) => s.id === form.student_id)

  // warn (don't block) when the new time overlaps another class
  const [clashes, setClashes] = useState([])
  useEffect(() => {
    if (!open || !form.start) { setClashes([]); return }
    const s = new Date(form.start)
    if (Number.isNaN(s.getTime())) return
    const e = addMinutes(s, Number(form.minutes) || 60)
    let q = supabase.from('classes').select('id, start_at, end_at, status, students(full_name)')
      .lt('start_at', e.toISOString()).gt('end_at', s.toISOString()).in('status', ['requested', 'scheduled', 'completed'])
    if (initial?.id) q = q.neq('id', initial.id)
    let stale = false
    q.then(({ data }) => { if (!stale) setClashes(data || []) })
    return () => { stale = true }
  }, [open, form.start, form.minutes, initial])

  async function save() {
    if (!form.student_id) return
    const base = new Date(form.start)
    const row = (startDate) => ({
      student_id: form.student_id,
      start_at: startDate.toISOString(),
      end_at: addMinutes(startDate, Number(form.minutes) || 60).toISOString(),
      mode: form.mode,
      status: form.status,
      subject: form.subject || null,
      topic: form.topic || null,
      homework: form.homework || null,
      meeting_link: form.mode === 'online' ? form.meeting_link || student?.meeting_link || null : null,
      fee: form.fee === '' ? null : Number(form.fee), // empty = worked out from the student's plan
      is_trial: !!form.is_trial,
    })
    const ok = await run(async () => {
      if (editing) return supabase.from('classes').update(row(base)).eq('id', initial.id)
      const rows = []
      for (let w = 0; w < Math.max(1, Number(form.repeat) || 1); w++) {
        const d = new Date(base); d.setDate(d.getDate() + 7 * w); rows.push(row(d))
      }
      return supabase.from('classes').insert(rows)
    }, editing ? 'Class updated' : Number(form.repeat) > 1 ? `${form.repeat} weekly classes added` : 'Class added')
    if (ok) { onSaved?.(); onClose() }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit class' : 'Add a class'}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Close</button>
        <button className="btn-primary" disabled={busy || !form.student_id} onClick={save}>{busy && <Spinner />} Save</button>
      </>}>
      {!students.length ? (
        <p className="text-sm text-muted">Add a student first (Students → Add student).</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Student" className="col-span-2">
            <select className="input" value={form.student_id} onChange={(e) => {
              const s = students.find((x) => x.id === e.target.value)
              setForm((f) => ({ ...f, student_id: e.target.value, mode: s?.default_mode || f.mode }))
            }}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
          <Field label="Starts" className="col-span-2 sm:col-span-1">
            <input type="datetime-local" className="input" value={form.start || ''} onChange={set('start')} />
          </Field>
          <Field label="Duration (minutes)" className="col-span-2 sm:col-span-1">
            <input type="number" min="5" step="5" className="input" value={form.minutes || ''} onChange={set('minutes')} />
          </Field>
          {clashes.length > 0 && (
            <div className="col-span-2 rounded-xl bg-sun-100 p-2.5 text-xs font-semibold text-sun-600">
              Overlaps with {clashes.map((c) => `${c.students?.full_name || 'a class'} (${fmtRange(c.start_at, c.end_at)})`).join(', ')}. You can still save.
            </div>
          )}
          {editing && initial?.invoice_id && (
            <div className="col-span-2 rounded-xl bg-brand-50 p-2.5 text-xs font-semibold text-brand-800">
              This class is already on a bill. Changing its time or fee won’t change that bill. Edit the bill in Billing if needed.
            </div>
          )}
          <Field label="Where">
            <select className="input" value={form.mode} onChange={set('mode')}>
              <option value="home">Home visit</option>
              <option value="online">Online</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={set('status')}>
              {['requested', 'scheduled', 'completed', 'missed', 'cancelled'].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
          </Field>
          {form.mode === 'online' && (
            <Field label="Meeting link" className="col-span-2" hint={student?.meeting_link ? 'Leave empty to use the student’s usual link.' : undefined}>
              <input className="input" value={form.meeting_link} onChange={set('meeting_link')} placeholder="https://meet.google.com/…" />
            </Field>
          )}
          <Field label="Subject"><input className="input" value={form.subject} onChange={set('subject')} placeholder="Maths" /></Field>
          <Field label="Fee override (₹)" hint={!student ? '' : student.billing_type === 'monthly'
            ? 'Empty = included in the monthly fee. Enter an amount to charge this class extra.'
            : `Empty = ${planLabel(student)} → ${money(classAmount({ start_at: new Date(form.start || Date.now()), end_at: addMinutes(new Date(form.start || Date.now()), Number(form.minutes) || 60), is_trial: form.is_trial }, student))}`}>
            <input type="number" min="0" className="input" value={form.fee} onChange={set('fee')} placeholder="Auto" />
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!form.is_trial} onChange={(e) => setForm((f) => ({ ...f, is_trial: e.target.checked }))} />
            Trial class (free, not billed)
          </label>
          <Field label="Topic covered" className="col-span-2"><input className="input" value={form.topic} onChange={set('topic')} placeholder="Quadratic equations" /></Field>
          <Field label="Homework" className="col-span-2"><textarea rows={2} className="input" value={form.homework} onChange={set('homework')} /></Field>
          {!editing && (
            <Field label="Repeat weekly" className="col-span-2" hint="Creates the same class on this weekday for the next few weeks.">
              <select className="input" value={form.repeat} onChange={set('repeat')}>
                {[1, 2, 4, 8, 12].map((n) => <option key={n} value={n}>{n === 1 ? 'Just once' : `${n} weeks`}</option>)}
              </select>
            </Field>
          )}
        </div>
      )}
    </Modal>
  )
}

// ----------------------------------------------------------------------
// Teacher: open bookable slots
// ----------------------------------------------------------------------
export function SlotsModal({ open, onClose, onSaved, defaultDate }) {
  const { settings } = useAuth()
  const [form, setForm] = useState({})
  const [run, busy] = useAction()
  useEffect(() => {
    if (!open) return
    setForm({ date: ymd(defaultDate || new Date()), time: '16:00', minutes: settings?.default_class_minutes || 60, count: 3, gap: 0, mode: 'either', weeks: 1, note: '' })
  }, [open, defaultDate, settings])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const preview = useMemo(() => {
    if (!form.date || !form.time) return []
    const out = []
    for (let w = 0; w < (Number(form.weeks) || 1); w++) {
      let t = new Date(`${form.date}T${form.time}`)
      t.setDate(t.getDate() + 7 * w)
      for (let i = 0; i < (Number(form.count) || 1); i++) {
        const end = addMinutes(t, Number(form.minutes) || 60)
        out.push({ start_at: t.toISOString(), end_at: end.toISOString(), mode: form.mode, note: form.note || null })
        t = addMinutes(end, Number(form.gap) || 0)
      }
    }
    return out
  }, [form])

  async function save() {
    const ok = await run(() => supabase.from('slots').insert(preview), `${preview.length} slot(s) opened for booking`)
    if (ok) { onSaved?.(); onClose() }
  }

  return (
    <Modal open={open} onClose={onClose} title="Open slots for booking"
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Close</button>
        <button className="btn-success" disabled={busy || !preview.length} onClick={save}>{busy && <Spinner />} Open {preview.length} slot{preview.length === 1 ? '' : 's'}</button>
      </>}>
      <p className="mb-3 text-sm text-muted">Students and parents will see these times and can book them instantly.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className="input" value={form.date || ''} onChange={set('date')} /></Field>
        <Field label="First slot starts"><input type="time" className="input" value={form.time || ''} onChange={set('time')} /></Field>
        <Field label="Each slot (minutes)"><input type="number" min="15" step="15" className="input" value={form.minutes || ''} onChange={set('minutes')} /></Field>
        <Field label="Slots in a row"><input type="number" min="1" max="12" className="input" value={form.count || ''} onChange={set('count')} /></Field>
        <Field label="Break between (min)" hint="Travel time between homes"><input type="number" min="0" step="5" className="input" value={form.gap} onChange={set('gap')} /></Field>
        <Field label="Where">
          <select className="input" value={form.mode} onChange={set('mode')}>
            <option value="either">Home or online</option>
            <option value="home">Home visit only</option>
            <option value="online">Online only</option>
          </select>
        </Field>
        <Field label="Repeat weekly" className="col-span-2">
          <select className="input" value={form.weeks} onChange={set('weeks')}>
            {[1, 2, 4, 8].map((n) => <option key={n} value={n}>{n === 1 ? 'Just this date' : `${n} weeks`}</option>)}
          </select>
        </Field>
        <Field label="Note (optional)" className="col-span-2"><input className="input" value={form.note || ''} onChange={set('note')} placeholder="e.g. Sector 21 area only" /></Field>
      </div>
      {preview.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {preview.slice(0, 12).map((p, i) => (
            <span key={i} className="rounded-lg bg-mint-100 px-2 py-1 text-xs font-bold text-mint-700">
              {fmtDay(p.start_at)} · {fmtRange(p.start_at, p.end_at)}
            </span>
          ))}
          {preview.length > 12 && <span className="text-xs text-muted">+{preview.length - 12} more</span>}
        </div>
      )}
    </Modal>
  )
}

// ----------------------------------------------------------------------
// Class details — teacher can complete/approve/cancel; families can cancel
// ----------------------------------------------------------------------
export function ClassDetailModal({ cls, onClose, onChanged, onEdit }) {
  const { isAdmin, settings } = useAuth()
  const [run, busy] = useAction()
  const [topic, setTopic] = useState('')
  const [homework, setHomework] = useState('')
  const [reason, setReason] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [reopen, setReopen] = useState(true)
  const [replaced, setReplaced] = useState(null) // the class a "move" request replaces
  const [charge, setCharge] = useState(null) // { amount, title } while charging a missed/cancelled class
  const [moving, setMoving] = useState(false)
  const [moveReq, setMoveReq] = useState(null) // a pending request to move this class elsewhere

  useEffect(() => {
    setTopic(cls?.topic || ''); setHomework(cls?.homework || ''); setReason(''); setConfirmCancel(false)
    setReopen(true); setCharge(null); setMoving(false); setReplaced(null); setMoveReq(null)
    if (cls?.replaces_class) {
      supabase.from('classes').select('id, start_at, end_at, status').eq('id', cls.replaces_class).maybeSingle()
        .then(({ data }) => setReplaced(data))
    }
    if (cls?.status === 'scheduled') {
      supabase.from('classes').select('id, start_at, end_at').eq('replaces_class', cls.id).eq('status', 'requested').limit(1).maybeSingle()
        .then(({ data }) => setMoveReq(data))
    }
  }, [cls])
  if (!cls) return null

  const upcoming = ['requested', 'scheduled'].includes(cls.status)
  const future = new Date(cls.start_at) > new Date()
  const link = cls.meeting_link || cls.students?.meeting_link
  // families can cancel a booked class online only with enough notice (the server checks this too)
  const tooLate = !isAdmin && cls.status === 'scheduled'
    && new Date(cls.start_at) < new Date(Date.now() + (settings?.cancel_notice_hours || 0) * 3600e3)
  const done = async (fn, msg) => { const ok = await run(fn, msg); if (ok) { onChanged?.(); onClose() } }

  const update = (patch, msg) => done(() => supabase.from('classes').update(patch).eq('id', cls.id), msg)
  const cancel = () => done(() => supabase.rpc('cancel_class', { p_class: cls.id, p_reason: reason || null, p_reopen: isAdmin ? reopen : true }),
    cls.status === 'requested' ? (isAdmin ? 'Request declined' : 'Request withdrawn') : 'Class cancelled')
  // approving a "move" request also cancels the class it replaces (and frees its slot)
  const approve = () => done(async () => {
    const r = await supabase.from('classes').update({ status: 'scheduled' }).eq('id', cls.id)
    if (r.error || !cls.replaces_class) return r
    const { data: old } = await supabase.from('classes').select('status').eq('id', cls.replaces_class).maybeSingle()
    if (old?.status !== 'scheduled') return r
    return supabase.rpc('cancel_class', { p_class: cls.replaces_class, p_reason: `Moved to ${fmtDay(cls.start_at)} ${fmtRange(cls.start_at, cls.end_at)}`, p_reopen: true })
  }, cls.replaces_class ? 'Class moved to the new time' : 'Request approved')
  // charge a missed or late-cancelled class (full or part of the fee) as a separate bill
  const startCharge = () => {
    const fee = classAmount({ ...cls, is_trial: false }, cls.students)
    setCharge({ amount: fee > 0 ? String(fee) : '', title: `${cls.status === 'missed' ? 'Missed class' : 'Late cancellation'} · ${fmtDay(cls.start_at)}` })
  }
  const saveCharge = () => done(async () => {
    const day = ymd(cls.start_at)
    const ins = await supabase.from('invoices').insert({
      student_id: cls.student_id, title: charge.title || 'Class charge', amount: Number(charge.amount),
      period_start: day, period_end: day, due_date: ymd(addMinutes(new Date(), 7 * 24 * 60)), kind: 'adjustment',
    }).select('id').single()
    if (ins.error) return ins
    return supabase.from('classes').update({ invoice_id: ins.data.id }).eq('id', cls.id)
  }, 'Charge added to the bill list')

  if (moving) {
    return <RequestModal open replaces={cls} student={cls.students} onClose={() => setMoving(false)} onSaved={() => { onChanged?.(); onClose() }} />
  }

  return (
    <Modal open={!!cls} onClose={onClose} title={cls.students?.full_name || 'Class'}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge status={cls.status} />
          <span className="text-sm font-bold">{fmtDay(cls.start_at)} · {fmtRange(cls.start_at, cls.end_at)}</span>
        </div>
        <div className="space-y-1.5 rounded-xl bg-brand-50 p-3 text-sm">
          <div className="flex items-center gap-2"><ModeIcon mode={cls.mode} /> {cls.mode === 'online' ? 'Online class' : 'Home visit'}</div>
          {cls.mode === 'home' && cls.students?.address && isAdmin && (
            <a className="flex items-center gap-2 text-brand-700 underline" target="_blank" rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cls.students.address)}`}>
              <MapPin size={15} /> {cls.students.address}
            </a>
          )}
          {cls.mode === 'online' && link && (
            <a className="flex items-center gap-2 break-all font-bold text-brand-700 underline" href={link} target="_blank" rel="noreferrer">
              <LinkIcon size={15} /> Join class
            </a>
          )}
          {cls.mode === 'online' && !link && upcoming && (
            <div className="text-muted">{isAdmin ? 'No class link yet: add one with Edit, or on the student.' : 'The class link will show here once the teacher adds it.'}</div>
          )}
          {isAdmin && (['missed', 'cancelled'].includes(cls.status)
            ? <div>{fmtHours(hoursOf(cls))} · {cls.invoice_id ? <b>Charged (see Billing)</b> : 'Not charged'}</div>
            : <div>{fmtHours(hoursOf(cls))} · Fee: <b>{money(classAmount(cls, cls.students))}</b>{cls.is_trial ? ' (trial)' : ''}{cls.invoice_id ? ' · billed' : ''}</div>)}
          {cls.replaces_class && (cls.status === 'requested' ? (
            <div className="font-semibold text-sun-600">
              Request to move the class on {replaced ? `${fmtDay(replaced.start_at)} · ${fmtRange(replaced.start_at, replaced.end_at)}` : '…'}
              {replaced && replaced.status !== 'scheduled' ? ` (that class is now ${replaced.status})` : ''}
            </div>
          ) : (
            <div className="text-muted">Moved from {replaced ? `${fmtDay(replaced.start_at)} · ${fmtRange(replaced.start_at, replaced.end_at)}` : '…'}</div>
          ))}
          {moveReq && (
            <div className="font-semibold text-sun-600">
              {isAdmin ? 'The family asked to move this to' : 'You asked to move this to'} {fmtDay(moveReq.start_at)} · {fmtRange(moveReq.start_at, moveReq.end_at)}
              {isAdmin ? ' (open that request to approve it)' : '. Waiting for the teacher.'}
            </div>
          )}
          {cls.request_note && <div className="text-muted">Note from family: “{cls.request_note}”</div>}
          {cls.cancel_reason && <div className="text-muted">Cancel reason: {cls.cancel_reason}</div>}
        </div>

        {isAdmin ? (
          <>
            <Field label="Topic covered"><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What was taught" /></Field>
            <Field label="Homework"><textarea rows={2} className="input" value={homework} onChange={(e) => setHomework(e.target.value)} /></Field>
            <div className="flex flex-wrap gap-2">
              {cls.status === 'requested' && (
                <button className="btn-success" disabled={busy} onClick={approve}>
                  <CheckCircle2 size={16} /> {cls.replaces_class ? 'Approve move' : 'Approve request'}
                </button>
              )}
              {cls.status !== 'completed' && cls.status !== 'requested' && (
                <button className="btn-success" disabled={busy} onClick={() => update({ status: 'completed', topic: topic || null, homework: homework || null }, 'Marked as completed')}>
                  <CheckCircle2 size={16} /> Mark completed
                </button>
              )}
              {(topic !== (cls.topic || '') || homework !== (cls.homework || '')) && (
                <button className="btn-soft" disabled={busy} onClick={() => update({ topic: topic || null, homework: homework || null }, 'Notes saved')}>
                  <NotebookPen size={16} /> Save notes
                </button>
              )}
              {upcoming && cls.status === 'scheduled' && new Date(cls.start_at) < new Date() && (
                <button className="btn-ghost" disabled={busy} onClick={() => update({ status: 'missed' }, 'Marked as missed')}>
                  <UserX size={16} /> Missed
                </button>
              )}
              {onEdit && <button className="btn-ghost" onClick={() => { onClose(); onEdit(cls) }}>Edit</button>}
            </div>
            {['missed', 'cancelled'].includes(cls.status) && !cls.invoice_id && (
              !charge ? (
                <button className="btn-soft btn-sm" onClick={startCharge}><IndianRupee size={15} /> Charge for this class</button>
              ) : (
                <div className="space-y-2 rounded-xl border border-brand-100 p-3">
                  <div className="text-sm font-bold">Charge for this class</div>
                  <div className="grid grid-cols-3 gap-2">
                    <input className="input col-span-2" value={charge.title} onChange={(e) => setCharge((c) => ({ ...c, title: e.target.value }))} />
                    <input className="input" type="number" min="1" value={charge.amount} placeholder="₹" onChange={(e) => setCharge((c) => ({ ...c, amount: e.target.value }))} />
                  </div>
                  <p className="text-xs text-muted">Full or part of the fee, e.g. half for a late cancellation. It shows on the family’s bills.</p>
                  <div className="flex gap-2">
                    <button className="btn-primary btn-sm" disabled={busy || !(Number(charge.amount) > 0)} onClick={saveCharge}>{busy && <Spinner />} Add charge</button>
                    <button className="btn-ghost btn-sm" onClick={() => setCharge(null)}>Cancel</button>
                  </div>
                </div>
              )
            )}
          </>
        ) : (
          <>
            {(cls.topic || cls.homework) && (
              <div className="space-y-2 text-sm">
                {cls.topic && <div><div className="label">Topic covered</div>{cls.topic}</div>}
                {cls.homework && <div className="rounded-xl bg-sun-100 p-3"><div className="label text-sun-600">Homework</div>{cls.homework}</div>}
              </div>
            )}
            {cls.status === 'scheduled' && future && !moveReq && (
              <button className="btn-soft btn-sm" onClick={() => setMoving(true)}><CalendarClock size={15} /> Ask to change the time</button>
            )}
          </>
        )}

        {upcoming && tooLate && future && (
          <div className="flex flex-wrap items-center gap-2 border-t border-brand-100 pt-3 text-sm text-muted">
            Too close to the class to cancel online.
            {settings?.phone
              ? <a href={`tel:${settings.phone}`} className="btn-soft btn-sm"><Phone size={14} /> Call {settings.teacher_name || 'the teacher'}</a>
              : 'Please call the teacher.'}
          </div>
        )}

        {upcoming && !tooLate && (
          <div className="border-t border-brand-100 pt-3">
            {!confirmCancel ? (
              <button className="btn-danger btn-sm" onClick={() => setConfirmCancel(true)}>
                <XCircle size={15} /> {cls.status === 'requested' ? (isAdmin ? 'Decline request' : 'Withdraw request') : 'Cancel class'}
              </button>
            ) : (
              <div className="space-y-2">
                {!isAdmin && cls.status === 'scheduled' && settings?.cancel_notice_hours > 0 && (
                  <p className="text-xs text-muted">Online cancellation needs {settings.cancel_notice_hours} hours’ notice.</p>
                )}
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
                {isAdmin && cls.status === 'scheduled' && (
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={reopen} onChange={(e) => setReopen(e.target.checked)} />
                    Let families book this time again (if it was a booked slot)
                  </label>
                )}
                <div className="flex gap-2">
                  <button className="btn-danger" disabled={busy} onClick={cancel}>
                    {busy && <Spinner />} {cls.status === 'requested' ? (isAdmin ? 'Yes, decline' : 'Yes, withdraw') : 'Yes, cancel'}
                  </button>
                  <button className="btn-ghost" onClick={() => setConfirmCancel(false)}>Keep it</button>
                </div>
              </div>
            )}
          </div>
        )}

        {isAdmin && !upcoming && (
          <div className="border-t border-brand-100 pt-3">
            <button className="btn-ghost btn-sm text-rose-600" disabled={busy}
              onClick={() => confirm('Delete this class permanently?') && done(() => supabase.from('classes').delete().eq('id', cls.id), 'Class deleted')}>
              <Trash2 size={15} /> Delete
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ----------------------------------------------------------------------
// Families: request a custom time
// ----------------------------------------------------------------------
// replaces = a booked class the family wants moved (the teacher approves; the old one is then cancelled)
export function RequestModal({ open, onClose, onSaved, student, defaultDate, replaces }) {
  const { settings } = useAuth()
  const [form, setForm] = useState({})
  const [run, busy] = useAction()
  useEffect(() => {
    if (!open) return
    if (replaces) {
      const d = new Date(replaces.start_at); d.setDate(d.getDate() + 1)
      setForm({ start: toLocalInput(d), minutes: Math.round(hoursOf(replaces) * 60), mode: replaces.mode, note: '' })
      return
    }
    const d = new Date(defaultDate || Date.now())
    if (d < new Date()) d.setDate(new Date().getDate() + 1)
    d.setHours(17, 0, 0, 0)
    setForm({ start: toLocalInput(d), minutes: settings?.default_class_minutes || 60, mode: student?.default_mode || 'home', note: '' })
  }, [open, defaultDate, student, settings, replaces])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const durations = [...new Set([30, 45, 60, 75, 90, 120, 150, Number(form.minutes) || 60])].sort((a, b) => a - b)
  async function save() {
    const s = new Date(form.start)
    const e = addMinutes(s, Number(form.minutes) || 60)
    const ok = await run(() => replaces
      ? supabase.rpc('request_reschedule', { p_class: replaces.id, p_start: s.toISOString(), p_end: e.toISOString(), p_note: form.note || null })
      : supabase.rpc('request_class', { p_student: student.id, p_start: s.toISOString(), p_end: e.toISOString(), p_mode: form.mode, p_note: form.note || null }),
    replaces ? 'Asked to move the class. The teacher will confirm.' : 'Request sent! The teacher will confirm it.')
    if (ok) { onSaved?.(); onClose() }
  }
  return (
    <Modal open={open} onClose={onClose} title={replaces ? 'Ask to change the time' : 'Request a class time'}
      footer={<><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-primary" disabled={busy} onClick={save}>{busy && <Spinner />} Send request</button></>}>
      <p className="mb-3 text-sm text-muted">
        {replaces
          ? <>Suggest a new time for the class on <b>{fmtDay(replaces.start_at)} · {fmtRange(replaces.start_at, replaces.end_at)}</b>. It stays booked until the teacher approves the new time.</>
          : <>Can’t find a suitable open slot? Suggest a time for <b>{student?.full_name}</b> and the teacher will confirm.</>}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={replaces ? 'New time' : 'Preferred time'} className="col-span-2"><input type="datetime-local" className="input" value={form.start || ''} onChange={set('start')} /></Field>
        <Field label="Duration">
          <select className="input" value={form.minutes} onChange={set('minutes')}>
            {durations.map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </Field>
        <Field label="Where">
          <select className="input" value={form.mode} onChange={set('mode')} disabled={!!replaces}>
            <option value="home">Home visit</option>
            <option value="online">Online</option>
          </select>
        </Field>
        <Field label="Message (optional)" className="col-span-2"><textarea rows={2} className="input" value={form.note} onChange={set('note')} placeholder="e.g. Exam on Monday, need revision" /></Field>
      </div>
    </Modal>
  )
}
