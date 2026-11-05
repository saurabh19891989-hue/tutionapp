import { useEffect, useMemo, useState } from 'react'
import { Home, Video, Clock, MapPin, Link as LinkIcon, NotebookPen, CheckCircle2, XCircle, Trash2, UserX } from 'lucide-react'
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
            <input type="number" min="15" step="15" className="input" value={form.minutes || ''} onChange={set('minutes')} />
          </Field>
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
          <Field label="Fee override (₹)" hint={student ? `Empty = ${planLabel(student)}${student.billing_type === 'monthly' ? '' : ` → ${money(classAmount({ start_at: new Date(form.start || Date.now()), end_at: addMinutes(new Date(form.start || Date.now()), Number(form.minutes) || 60), is_trial: form.is_trial }, student))}`}` : ''}>
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

  useEffect(() => {
    setTopic(cls?.topic || ''); setHomework(cls?.homework || ''); setReason(''); setConfirmCancel(false)
  }, [cls])
  if (!cls) return null

  const upcoming = ['requested', 'scheduled'].includes(cls.status)
  const link = cls.meeting_link || cls.students?.meeting_link
  const done = async (fn, msg) => { const ok = await run(fn, msg); if (ok) { onChanged?.(); onClose() } }

  const update = (patch, msg) => done(() => supabase.from('classes').update(patch).eq('id', cls.id), msg)
  const cancel = () => done(() => supabase.rpc('cancel_class', { p_class: cls.id, p_reason: reason || null }), 'Class cancelled')

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
          {isAdmin && <div>{fmtHours(hoursOf(cls))} · Fee: <b>{money(classAmount(cls, cls.students))}</b>{cls.is_trial ? ' (trial)' : ''}{cls.invoice_id ? ' · billed' : ''}</div>}
          {cls.request_note && <div className="text-muted">Note from family: “{cls.request_note}”</div>}
          {cls.cancel_reason && <div className="text-muted">Cancel reason: {cls.cancel_reason}</div>}
        </div>

        {isAdmin ? (
          <>
            <Field label="Topic covered"><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What was taught" /></Field>
            <Field label="Homework"><textarea rows={2} className="input" value={homework} onChange={(e) => setHomework(e.target.value)} /></Field>
            <div className="flex flex-wrap gap-2">
              {cls.status === 'requested' && (
                <button className="btn-success" disabled={busy} onClick={() => update({ status: 'scheduled' }, 'Request approved')}>
                  <CheckCircle2 size={16} /> Approve request
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
              <button className="btn-ghost" onClick={() => { onClose(); onEdit?.(cls) }}>Edit</button>
            </div>
          </>
        ) : (
          (cls.topic || cls.homework) && (
            <div className="space-y-2 text-sm">
              {cls.topic && <div><div className="label">Topic covered</div>{cls.topic}</div>}
              {cls.homework && <div className="rounded-xl bg-sun-100 p-3"><div className="label text-sun-600">Homework</div>{cls.homework}</div>}
            </div>
          )
        )}

        {upcoming && (
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
                <div className="flex gap-2">
                  <button className="btn-danger" disabled={busy} onClick={cancel}>{busy && <Spinner />} Yes, cancel</button>
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
export function RequestModal({ open, onClose, onSaved, student, defaultDate }) {
  const { settings } = useAuth()
  const [form, setForm] = useState({})
  const [run, busy] = useAction()
  useEffect(() => {
    if (!open) return
    const d = new Date(defaultDate || Date.now())
    if (d < new Date()) d.setDate(new Date().getDate() + 1)
    d.setHours(17, 0, 0, 0)
    setForm({ start: toLocalInput(d), minutes: settings?.default_class_minutes || 60, mode: student?.default_mode || 'home', note: '' })
  }, [open, defaultDate, student, settings])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  async function save() {
    const s = new Date(form.start)
    const ok = await run(() => supabase.rpc('request_class', {
      p_student: student.id, p_start: s.toISOString(), p_end: addMinutes(s, Number(form.minutes) || 60).toISOString(), p_mode: form.mode, p_note: form.note || null,
    }), 'Request sent! The teacher will confirm it.')
    if (ok) { onSaved?.(); onClose() }
  }
  return (
    <Modal open={open} onClose={onClose} title="Request a class time"
      footer={<><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-primary" disabled={busy} onClick={save}>{busy && <Spinner />} Send request</button></>}>
      <p className="mb-3 text-sm text-muted">Can’t find a suitable open slot? Suggest a time for <b>{student?.full_name}</b> and the teacher will confirm.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Preferred time" className="col-span-2"><input type="datetime-local" className="input" value={form.start || ''} onChange={set('start')} /></Field>
        <Field label="Duration">
          <select className="input" value={form.minutes} onChange={set('minutes')}>
            {[45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </Field>
        <Field label="Where">
          <select className="input" value={form.mode} onChange={set('mode')}>
            <option value="home">Home visit</option>
            <option value="online">Online</option>
          </select>
        </Field>
        <Field label="Message (optional)" className="col-span-2"><textarea rows={2} className="input" value={form.note} onChange={set('note')} placeholder="e.g. Exam on Monday, need revision" /></Field>
      </div>
    </Modal>
  )
}
