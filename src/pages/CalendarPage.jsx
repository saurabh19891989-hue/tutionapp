import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, CalendarPlus, Trash2, Clock, CalendarX2, Send, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import MonthCalendar from '../components/MonthCalendar'
import { Card, Empty, Field, Loading, Modal, PageHeader, Spinner, useAction } from '../components/ui'
import { CLASS_SELECT, ClassDetailModal, ClassFormModal, ClassRow, ModeIcon, RequestModal, SlotsModal } from '../components/ClassModals'
import StudentPicker from '../components/StudentPicker'
import { fmtDay, fmtRange, sameDay } from '../lib/format'

export default function CalendarPage() {
  const { isAdmin, students, activeStudent, settings } = useAuth()
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState(new Date())
  const [classes, setClasses] = useState(null)
  const [slots, setSlots] = useState([])
  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null) // null | {} | class
  const [slotsOpen, setSlotsOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [booking, setBooking] = useState(null)

  const load = useCallback(async () => {
    const from = new Date(month.getFullYear(), month.getMonth(), -7)
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 8)
    let q = supabase.from('classes').select(CLASS_SELECT).gte('start_at', from.toISOString()).lt('start_at', to.toISOString()).order('start_at')
    if (!isAdmin && activeStudent) q = q.eq('student_id', activeStudent.id)
    let sq = supabase.from('slots').select('*').gte('start_at', from.toISOString()).lt('start_at', to.toISOString()).order('start_at')
    if (!isAdmin) sq = sq.is('class_id', null).gte('start_at', new Date().toISOString())
    const [c, s] = await Promise.all([q, sq])
    setClasses(c.data || [])
    setSlots(s.data || [])
  }, [month, isAdmin, activeStudent])

  useEffect(() => { load() }, [load])

  const events = useMemo(() => [
    ...(classes || []).filter((c) => c.status !== 'cancelled').map((c) => ({ date: c.start_at, kind: c.status === 'requested' ? 'request' : 'class' })),
    ...slots.filter((s) => !s.class_id).map((s) => ({ date: s.start_at, kind: 'slot' })),
  ], [classes, slots])

  const dayClasses = (classes || []).filter((c) => sameDay(c.start_at, selected))
  const daySlots = slots.filter((s) => sameDay(s.start_at, selected))
  const openSlots = daySlots.filter((s) => !s.class_id)
  const bookCutoff = Date.now() + (settings?.booking_notice_hours || 0) * 3600e3

  const [run, busy] = useAction()
  const deleteSlot = async (id) => { if (await run(() => supabase.from('slots').delete().eq('id', id), 'Slot removed')) load() }

  if (!isAdmin && !activeStudent) {
    return <Empty icon={CalendarX2} title="No student linked yet" text="Once the teacher links your account to a student, you can book classes here." />
  }

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Calendar' : 'Book a class'}
        subtitle={isAdmin ? 'Plan classes and open slots that families can book.' : 'Pick a day, then tap an open slot to book it.'}
        actions={isAdmin ? (
          <>
            <button className="btn-soft" onClick={() => setSlotsOpen(true)}><CalendarPlus size={17} /> Open slots</button>
            <button className="btn-primary" onClick={() => setEditing({})}><Plus size={17} /> Add class</button>
          </>
        ) : (
          <>
            <StudentPicker />
            <button className="btn-soft" onClick={() => setRequestOpen(true)}><Send size={16} /> Request a time</button>
          </>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <MonthCalendar month={month} onMonthChange={setMonth} selected={selected} onSelect={setSelected} events={events} />

        <Card className="p-4">
          <h2 className="mb-3 text-lg font-extrabold">{fmtDay(selected)}</h2>
          {classes === null ? <Loading /> : (
            <div className="space-y-4">
              {openSlots.length > 0 && (
                <div>
                  <div className="label">Open slots</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {openSlots.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-mint-500/30 bg-mint-100/60 px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 whitespace-nowrap text-sm font-extrabold text-mint-700"><Clock size={14} /> {fmtRange(s.start_at, s.end_at)}</div>
                          <div className="text-xs text-mint-700/80">
                            {s.mode === 'either' ? 'Home or online' : s.mode === 'home' ? 'Home visit' : 'Online'}{s.note ? ` · ${s.note}` : ''}
                          </div>
                        </div>
                        {isAdmin ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <button className="btn-soft btn-sm" onClick={() => setBooking(s)} title="Book this slot for a student (e.g. when a parent calls)">Book for…</button>
                            <button className="rounded-lg p-1.5 text-mint-700 hover:bg-white" disabled={busy} onClick={() => deleteSlot(s.id)} aria-label="Remove slot"><Trash2 size={16} /></button>
                          </div>
                        ) : new Date(s.start_at) < bookCutoff ? (
                          // inside the booking notice: families can't book online, so offer a call instead
                          settings?.phone
                            ? <a href={`tel:${settings.phone}`} className="btn-soft btn-sm shrink-0"><Phone size={14} /> Call to book</a>
                            : <span className="text-xs font-bold text-mint-700">Call the teacher to book</span>
                        ) : (
                          <button className="btn-success btn-sm" onClick={() => setBooking(s)}>Book</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                {dayClasses.length > 0 && <div className="label">Classes</div>}
                {dayClasses.length ? (
                  <div className="space-y-2">
                    {dayClasses.map((c) => <ClassRow key={c.id} c={c} showStudent={isAdmin || students.length > 1} onClick={() => setDetail(c)} />)}
                  </div>
                ) : !openSlots.length ? (
                  <Empty icon={CalendarX2} title="Nothing on this day"
                    text={isAdmin ? 'Add a class or open some slots for booking.' : 'No open slots on this day. Try another day, or request a time.'}
                    action={isAdmin
                      ? <button className="btn-soft btn-sm" onClick={() => setEditing({})}><Plus size={15} /> Add class</button>
                      : <button className="btn-soft btn-sm" onClick={() => setRequestOpen(true)}><Send size={15} /> Request a time</button>} />
                ) : null}
              </div>
              {isAdmin && daySlots.some((s) => s.class_id) && (
                <p className="text-xs text-muted">{daySlots.filter((s) => s.class_id).length} slot(s) on this day already booked.</p>
              )}
            </div>
          )}
        </Card>
      </div>

      <ClassDetailModal cls={detail} onClose={() => setDetail(null)} onChanged={load} onEdit={(c) => setEditing(c)} />
      {isAdmin && (
        <>
          <ClassFormModal open={!!editing} initial={editing?.id ? editing : null} defaultDate={selected} students={students}
            onClose={() => setEditing(null)} onSaved={load} />
          <SlotsModal open={slotsOpen} defaultDate={selected} onClose={() => setSlotsOpen(false)} onSaved={load} />
          <BookModal slot={booking} students={students} onClose={() => setBooking(null)} onBooked={load} />
        </>
      )}
      {!isAdmin && (
        <>
          <RequestModal open={requestOpen} onClose={() => setRequestOpen(false)} onSaved={load} student={activeStudent} defaultDate={selected} />
          <BookModal slot={booking} student={activeStudent} settings={settings} onClose={() => setBooking(null)} onBooked={load} />
        </>
      )}
    </>
  )
}

// Families book for their student; the teacher picks any student (notice rules don't apply to the teacher)
function BookModal({ slot, student: familyStudent, students, onClose, onBooked }) {
  const [studentId, setStudentId] = useState('')
  const [mode, setMode] = useState('home')
  const [note, setNote] = useState('')
  const [run, busy] = useAction()
  const student = familyStudent || students?.find((s) => s.id === studentId)
  useEffect(() => {
    if (!slot) return
    const first = familyStudent || students?.[0]
    setStudentId(first?.id || '')
    setMode(slot.mode === 'either' ? first?.default_mode || 'home' : slot.mode); setNote('')
  }, [slot, familyStudent, students])
  if (!slot) return null
  const book = async () => {
    const ok = await run(() => supabase.rpc('book_slot', { p_slot: slot.id, p_student: student.id, p_mode: mode, p_note: note || null }),
      familyStudent ? 'Booked! See you in class 🎉' : `Booked for ${student.full_name}`)
    if (ok) { onBooked(); onClose() }
    else onBooked()
  }
  return (
    <Modal open onClose={onClose} title={familyStudent ? 'Confirm booking' : 'Book this slot for a student'}
      footer={<><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-success" disabled={busy || !student} onClick={book}>{busy && <Spinner />} Book this slot</button></>}>
      <div className="space-y-3">
        <div className="rounded-xl bg-mint-100 p-3">
          <div className="font-extrabold text-mint-700">{fmtDay(slot.start_at)}</div>
          <div className="text-sm font-bold text-mint-700">{fmtRange(slot.start_at, slot.end_at)}</div>
          {familyStudent && <div className="mt-1 text-sm">for <b>{familyStudent.full_name}</b></div>}
        </div>
        {!familyStudent && (
          <Field label="Student">
            <select className="input" value={studentId} onChange={(e) => {
              const s = students.find((x) => x.id === e.target.value)
              setStudentId(e.target.value)
              if (slot.mode === 'either' && s) setMode(s.default_mode)
            }}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
        )}
        {slot.mode === 'either' ? (
          <div>
            <div className="label">Where</div>
            <div className="grid grid-cols-2 gap-2">
              {[['home', 'Home visit'], ['online', 'Online']].map(([v, l]) => (
                <button key={v} onClick={() => setMode(v)}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold ${mode === v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-brand-100 text-slate-500'}`}>
                  <ModeIcon mode={v} /> {l}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-bold"><ModeIcon mode={slot.mode} /> {slot.mode === 'home' ? 'Home visit' : 'Online class'}</div>
        )}
        <Field label={familyStudent ? 'Note for the teacher (optional)' : 'Note (optional)'}>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Chapter 5 doubts" />
        </Field>
      </div>
    </Modal>
  )
}
