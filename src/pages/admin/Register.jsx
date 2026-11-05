import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Empty, Field, Loading, Modal, PageHeader, Spinner, useAction } from '../../components/ui'
import { CLASS_SELECT, ClassDetailModal, ClassFormModal, ClassRow } from '../../components/ClassModals'
import { addMinutes, classAmount, fmtDay, hoursOf, money, planLabel, ymd } from '../../lib/format'

const HOUR_CHIPS = [1, 1.25, 1.5, 2]
const fmtH = (h) => Number(h.toFixed(2)).toString()

export default function Register() {
  const { students } = useAuth()
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [classes, setClasses] = useState(null)
  const [cell, setCell] = useState(null) // { student, date }
  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    const from = new Date(month.getFullYear(), month.getMonth(), 1)
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 1)
    const { data } = await supabase.from('classes').select(CLASS_SELECT)
      .gte('start_at', from.toISOString()).lt('start_at', to.toISOString())
      .neq('status', 'cancelled').order('start_at')
    setClasses(data || [])
  }, [month])
  useEffect(() => { load() }, [load])

  const days = useMemo(() => {
    const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    return Array.from({ length: n }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))
  }, [month])

  // also show students who were made inactive but had classes this month
  const columns = useMemo(() => {
    const ids = new Set(students.map((s) => s.id))
    const extra = []
    for (const c of classes || []) {
      if (!ids.has(c.student_id) && c.students) { ids.add(c.student_id); extra.push(c.students) }
    }
    return [...students, ...extra]
  }, [students, classes])

  const grid = useMemo(() => {
    const g = {}
    for (const c of classes || []) {
      const k = `${c.student_id}|${ymd(c.start_at)}`
      ;(g[k] ??= []).push(c)
    }
    return g
  }, [classes])

  const totals = useMemo(() => {
    const t = {}
    for (const s of columns) t[s.id] = { hours: 0, count: 0, amount: 0, upcoming: 0 }
    for (const c of classes || []) {
      const s = columns.find((x) => x.id === c.student_id)
      if (!t[c.student_id]) continue
      if (c.status === 'completed') {
        t[c.student_id].hours += hoursOf(c)
        t[c.student_id].count += 1
        t[c.student_id].amount += classAmount(c, s)
      } else if (c.status === 'scheduled') t[c.student_id].upcoming += 1
    }
    // monthly plans: the monthly fee + any extra classes that were given their own fee
    for (const s of columns) if (s.billing_type === 'monthly') t[s.id].amount += Number(s.monthly_fee || 0)
    return t
  }, [classes, columns])

  const grand = Object.values(totals).reduce((a, t) => ({ hours: a.hours + t.hours, count: a.count + t.count, amount: a.amount + t.amount }), { hours: 0, count: 0, amount: 0 })
  const today = ymd(new Date())

  return (
    <>
      <PageHeader
        title="Monthly register"
        subtitle="Just like the paper sheet — tap a box to log the hours taught that day."
        actions={
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm">
            <button className="btn-ghost btn-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
            <span className="min-w-[120px] text-center font-extrabold">{month.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
            <button className="btn-ghost btn-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
          </div>
        }
      />

      {!columns.length ? (
        <div className="card"><Empty icon={Users} title="No students yet" text="Add your students first, then log classes here." action={<Link to="/students" className="btn-primary">Add students</Link>} /></div>
      ) : classes === null ? <Loading /> : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="card p-3"><div className="text-xs font-bold uppercase text-muted">Hours taught</div><div className="text-xl font-extrabold">{fmtH(grand.hours)}</div></div>
            <div className="card p-3"><div className="text-xs font-bold uppercase text-muted">Classes</div><div className="text-xl font-extrabold">{grand.count}</div></div>
            <div className="card p-3"><div className="text-xs font-bold uppercase text-muted">Earned</div><div className="text-xl font-extrabold text-mint-700">{money(grand.amount)}</div></div>
          </div>

          <div className="card overflow-hidden">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-20 border-b border-r border-brand-100 bg-brand-50 px-2 py-2 text-left text-xs font-extrabold uppercase text-brand-700">Date</th>
                    {columns.map((s) => (
                      <th key={s.id} className="sticky top-0 z-10 min-w-[84px] border-b border-r border-brand-100 bg-brand-50 px-2 py-2 text-center">
                        <div className="max-w-[110px] truncate text-xs font-extrabold text-ink" title={s.full_name}>{s.full_name}</div>
                        <div className="text-[10px] font-semibold text-muted">{planLabel(s)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const k = ymd(d)
                    const weekend = d.getDay() === 0
                    return (
                      <tr key={k} className={k === today ? 'bg-sun-100/60' : weekend ? 'bg-slate-50' : ''}>
                        <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-100 bg-inherit px-2 py-1.5 font-bold">
                          <div className={`flex items-center gap-1.5 ${k === today ? 'bg-sun-100' : weekend ? 'bg-slate-50' : 'bg-white'} -mx-2 -my-1.5 px-2 py-1.5`}>
                            <span className="w-5 text-right">{d.getDate()}</span>
                            <span className="text-[10px] font-semibold uppercase text-muted">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                          </div>
                        </td>
                        {columns.map((s) => {
                          const list = grid[`${s.id}|${k}`] || []
                          const done = list.filter((c) => c.status === 'completed')
                          const planned = list.filter((c) => c.status === 'scheduled' || c.status === 'requested')
                          const missed = list.filter((c) => c.status === 'missed')
                          const h = done.reduce((a, c) => a + hoursOf(c), 0)
                          return (
                            <td key={s.id} className="border-b border-r border-slate-100 p-0.5 text-center">
                              <button
                                onClick={() => setCell({ student: s, date: d, list })}
                                className="flex h-9 w-full items-center justify-center gap-1 rounded-md font-extrabold transition hover:bg-brand-50"
                                title={list.length ? `${list.length} class(es)` : 'Log a class'}
                              >
                                {done.length > 0 && (
                                  <span className={`rounded-md px-1.5 py-0.5 ${done.some((c) => c.is_trial) ? 'bg-sun-100 text-sun-600' : 'bg-mint-100 text-mint-700'}`}>
                                    {fmtH(h)}{done.some((c) => c.is_trial) ? 'T' : ''}
                                  </span>
                                )}
                                {planned.length > 0 && <span className="rounded-md border border-brand-300 px-1.5 py-0.5 text-[11px] text-brand-600">{fmtH(planned.reduce((a, c) => a + hoursOf(c), 0))}</span>}
                                {missed.length > 0 && <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[11px] text-rose-600">A</span>}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="sticky bottom-0 left-0 z-20 border-r border-t-2 border-brand-200 bg-brand-50 px-2 py-2 text-xs font-extrabold uppercase text-brand-700">Total</td>
                    {columns.map((s) => {
                      const t = totals[s.id]
                      return (
                        <td key={s.id} className="sticky bottom-0 z-10 border-r border-t-2 border-brand-100 border-t-brand-200 bg-brand-50 px-2 py-1.5 text-center">
                          <div className="text-sm font-extrabold">{fmtH(t.hours)} hrs</div>
                          <div className="text-[11px] font-bold text-mint-700">{money(t.amount)}</div>
                          <div className="text-[10px] font-semibold text-muted">{t.count} class{t.count === 1 ? '' : 'es'}{t.upcoming ? ` · +${t.upcoming} booked` : ''}</div>
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-muted">
            <span><b className="rounded bg-mint-100 px-1 text-mint-700">1.5</b> hours taught</span>
            <span><b className="rounded bg-sun-100 px-1 text-sun-600">1.5T</b> trial (free)</span>
            <span><b className="rounded border border-brand-300 px-1 text-brand-600">1</b> booked / upcoming</span>
            <span><b className="rounded bg-rose-100 px-1 text-rose-600">A</b> absent / missed</span>
            <span>Amount for monthly-plan students = their monthly fee + extra classes given their own fee.</span>
          </div>
        </>
      )}

      <CellModal cell={cell} onClose={() => setCell(null)} onSaved={load} onOpen={(c) => { setCell(null); setDetail(c) }} />
      <ClassDetailModal cls={detail} onClose={() => setDetail(null)} onChanged={load} onEdit={(c) => setEditing(c)} />
      <ClassFormModal open={!!editing} initial={editing} students={columns} onClose={() => setEditing(null)} onSaved={load} />
    </>
  )
}

function CellModal({ cell, onClose, onSaved, onOpen }) {
  const { settings } = useAuth()
  const [hours, setHours] = useState(1)
  const [custom, setCustom] = useState('')
  const [time, setTime] = useState('17:00')
  const [mode, setMode] = useState('home')
  const [trial, setTrial] = useState(false)
  const [topic, setTopic] = useState('')
  const [adding, setAdding] = useState(false)
  const [run, busy] = useAction()

  useEffect(() => {
    if (!cell) return
    const last = cell.list?.[cell.list.length - 1]
    setHours(Number(((settings?.default_class_minutes || 60) / 60).toFixed(2)))
    setCustom(''); setTrial(false); setTopic('')
    setMode(cell.student.default_mode || 'home')
    setTime(last ? (() => { const e = new Date(last.end_at); return `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}` })() : '17:00')
    setAdding(!cell.list?.length)
  }, [cell, settings])
  if (!cell) return null

  const { student, date, list } = cell
  const h = custom ? Number(custom) : hours
  const start = new Date(`${ymd(date)}T${time}`)
  const end = addMinutes(start, Math.round(h * 60))
  const isPast = start <= new Date()
  const preview = classAmount({ start_at: start, end_at: end, is_trial: trial }, student)

  async function save() {
    if (!h || h <= 0) return
    const ok = await run(() => supabase.from('classes').insert({
      student_id: student.id, start_at: start.toISOString(), end_at: end.toISOString(), mode,
      status: isPast ? 'completed' : 'scheduled', is_trial: trial, topic: topic || null,
      meeting_link: mode === 'online' ? student.meeting_link || null : null,
    }), isPast ? `Logged ${fmtH(h)} hr for ${student.full_name}` : 'Class scheduled')
    if (ok) { onSaved(); onClose() }
  }

  return (
    <Modal open onClose={onClose} title={`${student.full_name} · ${fmtDay(date)}`}
      footer={adding ? <>
        <button className="btn-ghost" onClick={onClose}>Close</button>
        <button className="btn-primary" disabled={busy || !h} onClick={save}>{busy && <Spinner />} {isPast ? 'Log class' : 'Schedule class'}</button>
      </> : null}>
      {list?.length > 0 && (
        <div className="mb-4 space-y-2">
          {list.map((c) => <ClassRow key={c.id} c={c} showStudent={false} onClick={() => onOpen(c)} />)}
          {!adding && <button className="btn-soft w-full" onClick={() => setAdding(true)}><Plus size={16} /> Add another class this day</button>}
        </div>
      )}
      {adding && (
        <div className="space-y-3">
          <div>
            <div className="label">Hours taught</div>
            <div className="flex flex-wrap gap-2">
              {HOUR_CHIPS.map((x) => (
                <button key={x} onClick={() => { setHours(x); setCustom('') }}
                  className={`min-w-[56px] rounded-xl border-2 px-3 py-2 text-lg font-extrabold ${!custom && hours === x ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-brand-100 text-slate-600'}`}>
                  {x}
                </button>
              ))}
              <input className="input w-24 text-center text-lg font-extrabold" type="number" step="0.25" min="0.25" placeholder="other" value={custom} onChange={(e) => setCustom(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time"><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
            <Field label="Where">
              <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="home">Home visit</option>
                <option value="online">Online</option>
              </select>
            </Field>
          </div>
          <Field label="Topic (optional)"><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What was taught" /></Field>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={trial} onChange={(e) => setTrial(e.target.checked)} /> Trial class (free)
          </label>
          <div className="rounded-xl bg-brand-50 p-3 text-sm">
            {isPast ? 'Will be saved as completed' : 'Future date — will be saved as scheduled'}
            {student.billing_type !== 'monthly' && <> · <b>{money(preview)}</b></>}
          </div>
        </div>
      )}
    </Modal>
  )
}
