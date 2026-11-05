import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Users, Search, Phone, MapPin, Mail, Link2, Unlink, Pencil, IndianRupee, ReceiptText, MessageCircle, Trash2, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Badge, Card, Empty, Field, Loading, Modal, PageHeader, Spinner, useAction } from '../../components/ui'
import { CLASS_SELECT, ClassDetailModal, ClassRow } from '../../components/ClassModals'
import { RecordPaymentModal, InvoiceModal, AdjustmentModal } from './Billing'
import { balanceDue, money, planLabel } from '../../lib/format'

const EMPTY = {
  full_name: '', grade: '', school: '', subjects: '', student_email: '', parent_name: '', parent_email: '', phone: '', address: '',
  default_mode: 'home', billing_type: 'per_hour', hourly_rate: '', fee_per_class: '', monthly_fee: '', meeting_link: '', notes: '', active: true,
}

export function StudentFormModal({ open, onClose, initial, onSaved }) {
  const [f, setF] = useState(EMPTY)
  const [run, busy] = useAction()
  useEffect(() => {
    if (!open) return
    // saved rows have nulls for blank fields; keep the form's '' defaults for those
    const next = { ...EMPTY }
    for (const [k, v] of Object.entries(initial || {})) if (v !== null && v !== undefined) next[k] = v
    setF(next)
  }, [open, initial])
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function save() {
    const row = {
      full_name: (f.full_name || '').trim(), grade: f.grade || null, school: f.school || null, subjects: f.subjects || null,
      student_email: (f.student_email || '').trim().toLowerCase() || null, parent_name: f.parent_name || null,
      parent_email: (f.parent_email || '').trim().toLowerCase() || null, phone: f.phone || null, address: f.address || null,
      default_mode: f.default_mode, billing_type: f.billing_type,
      hourly_rate: Number(f.hourly_rate) || 0, fee_per_class: Number(f.fee_per_class) || 0, monthly_fee: Number(f.monthly_fee) || 0,
      meeting_link: f.meeting_link || null, notes: f.notes || null, active: !!f.active,
    }
    if (!row.full_name) return
    const ok = await run(() => initial?.id ? supabase.from('students').update(row).eq('id', initial.id) : supabase.from('students').insert(row),
      initial?.id ? 'Student updated' : 'Student added')
    if (ok) { onSaved?.(); onClose() }
  }

  async function remove() {
    if (!confirm(`Delete ${initial.full_name} permanently, with all their classes, bills and payments?\n\nTo keep their history, untick “Active student” instead.`)) return
    const ok = await run(() => supabase.from('students').delete().eq('id', initial.id), 'Student deleted')
    if (ok) { onSaved?.(); onClose() }
  }

  return (
    <Modal open={open} onClose={onClose} wide title={initial?.id ? `Edit ${initial.full_name}` : 'Add a student'}
      footer={<>{initial?.id && <button className="btn-danger mr-auto" disabled={busy} onClick={remove}><Trash2 size={16} /> Delete</button>}
        <button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-primary" disabled={busy || !(f.full_name || '').trim()} onClick={save}>{busy && <Spinner />} Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Student name *"><input className="input" value={f.full_name} onChange={set('full_name')} autoFocus /></Field>
        <Field label="Class / grade"><input className="input" value={f.grade || ''} onChange={set('grade')} placeholder="e.g. 8" /></Field>
        <Field label="School"><input className="input" value={f.school || ''} onChange={set('school')} placeholder="e.g. DPS" /></Field>
        <Field label="Subjects"><input className="input" value={f.subjects || ''} onChange={set('subjects')} placeholder="Maths, Science" /></Field>

        <div className="sm:col-span-2 mt-1 rounded-xl bg-brand-50 p-3 text-xs font-semibold text-brand-800">
          Emails below link logins automatically: when a parent or student signs up with one of these emails, they see this student’s classes and fees.
        </div>
        <Field label="Parent name"><input className="input" value={f.parent_name || ''} onChange={set('parent_name')} /></Field>
        <Field label="Parent email"><input className="input" type="email" value={f.parent_email || ''} onChange={set('parent_email')} /></Field>
        <Field label="Student email (optional)"><input className="input" type="email" value={f.student_email || ''} onChange={set('student_email')} /></Field>
        <Field label="Phone / WhatsApp"><input className="input" value={f.phone || ''} onChange={set('phone')} inputMode="tel" /></Field>
        <Field label="Home address" className="sm:col-span-2"><input className="input" value={f.address || ''} onChange={set('address')} /></Field>

        <Field label="Usually taught">
          <select className="input" value={f.default_mode} onChange={set('default_mode')}>
            <option value="home">At home</option><option value="online">Online</option>
          </select>
        </Field>
        <Field label="Online meeting link"><input className="input" value={f.meeting_link || ''} onChange={set('meeting_link')} placeholder="https://meet.google.com/…" /></Field>

        <Field label="Fee plan">
          <select className="input" value={f.billing_type} onChange={set('billing_type')}>
            <option value="per_hour">Per hour</option><option value="per_class">Per class</option><option value="monthly">Fixed monthly</option>
          </select>
        </Field>
        {f.billing_type === 'per_hour' && <Field label="Rate per hour (₹)"><input className="input" type="number" min="0" value={f.hourly_rate} onChange={set('hourly_rate')} /></Field>}
        {f.billing_type === 'per_class' && <Field label="Fee per class (₹)"><input className="input" type="number" min="0" value={f.fee_per_class} onChange={set('fee_per_class')} /></Field>}
        {f.billing_type === 'monthly' && <Field label="Monthly fee (₹)"><input className="input" type="number" min="0" value={f.monthly_fee} onChange={set('monthly_fee')} /></Field>}

        <Field label="Notes (visible to the family)" className="sm:col-span-2"><textarea rows={2} className="input" value={f.notes || ''} onChange={set('notes')} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!f.active} onChange={set('active')} /> Active student
        </label>
      </div>
    </Modal>
  )
}

export default function Students() {
  const { refresh } = useAuth()
  const [rows, setRows] = useState(null)
  const [balances, setBalances] = useState({})
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([
      supabase.from('students').select('*, student_members(relation, profiles(id, email, full_name))').order('full_name'),
      supabase.from('student_balances').select('*'),
    ])
    setRows(s.data || [])
    setBalances(Object.fromEntries((b.data || []).map((x) => [x.student_id, x])))
  }, [])
  useEffect(() => { load() }, [load])
  const reloadAll = () => { load(); refresh() }

  const list = useMemo(() => (rows || []).filter((s) =>
    (showInactive || s.active) &&
    (!q || [s.full_name, s.parent_name, s.school, s.subjects, s.parent_email].join(' ').toLowerCase().includes(q.toLowerCase()))), [rows, q, showInactive])

  return (
    <>
      <PageHeader title="Students" subtitle="Profiles, fee plans and family logins."
        actions={<button className="btn-primary" onClick={() => setEditing({})}><Plus size={17} /> Add student</button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search students" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-muted">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
        </label>
      </div>

      {rows === null ? <Loading /> : list.length === 0 ? (
        <Card><Empty icon={Users} title={rows.length ? 'No match' : 'No students yet'} text="Add each student with their fee plan and parent’s email." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const b = balances[s.id]
            const due = balanceDue(b)
            return (
              <button key={s.id} onClick={() => setSelected(s)} className={`card p-4 text-left transition hover:border-brand-300 ${s.active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-lg font-extrabold text-brand-700">{s.full_name[0]}</span>
                    <div>
                      <div className="font-extrabold">{s.full_name}</div>
                      <div className="text-xs text-muted">{[s.grade && `Class ${s.grade}`, s.school, s.subjects].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                  </div>
                  {!s.active && <Badge status="cancelled">Inactive</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="rounded-full bg-brand-50 px-2 py-1 text-brand-700">{planLabel(s)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{s.default_mode === 'online' ? 'Online' : 'Home'}</span>
                  <span className={`rounded-full px-2 py-1 ${s.student_members?.length ? 'bg-mint-100 text-mint-700' : 'bg-sun-100 text-sun-600'}`}>
                    {s.student_members?.length ? `${s.student_members.length} login${s.student_members.length > 1 ? 's' : ''}` : 'No login yet'}
                  </span>
                </div>
                <div className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-sm">
                  <span className="text-muted">{due >= 0 ? 'Due' : 'Advance'}</span>
                  <b className={due > 0 ? 'text-rose-600' : 'text-mint-700'}>{money(Math.abs(due))}</b>
                </div>
                {b?.pending > 0 && <div className="flex justify-between text-xs text-sun-600"><span>Reported, to verify</span><span>{money(b.pending)}</span></div>}
              </button>
            )
          })}
        </div>
      )}

      <StudentFormModal open={!!editing} initial={editing?.id ? editing : null} onClose={() => setEditing(null)} onSaved={reloadAll} />
      <StudentDetail student={selected} balance={selected ? balances[selected.id] : null} onClose={() => setSelected(null)}
        onEdit={(s) => { setSelected(null); setEditing(s) }} onChanged={reloadAll} />
    </>
  )
}

function StudentDetail({ student, balance, onClose, onEdit, onChanged }) {
  const [classes, setClasses] = useState([])
  const [profiles, setProfiles] = useState([])
  const [linkUser, setLinkUser] = useState('')
  const [linkRel, setLinkRel] = useState('parent')
  const [detail, setDetail] = useState(null)
  const [payOpen, setPayOpen] = useState(false)
  const [invOpen, setInvOpen] = useState(false)
  const [adjOpen, setAdjOpen] = useState(false)
  const [run, busy] = useAction()

  const load = useCallback(async () => {
    if (!student) return
    const [c, p] = await Promise.all([
      supabase.from('classes').select(CLASS_SELECT).eq('student_id', student.id).order('start_at', { ascending: false }).limit(10),
      supabase.from('profiles').select('id, email, full_name, account_type').neq('account_type', 'teacher').order('created_at', { ascending: false }),
    ])
    setClasses(c.data || []); setProfiles(p.data || [])
  }, [student])
  useEffect(() => { load(); setLinkUser('') }, [load])
  if (!student) return null

  const linked = student.student_members || []
  const linkedIds = new Set(linked.map((m) => m.profiles?.id))
  const due = balanceDue(balance)
  const wa = student.phone ? `https://wa.me/${student.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}` : null

  const link = async () => {
    if (await run(() => supabase.rpc('link_member', { p_student: student.id, p_user: linkUser, p_relation: linkRel }), 'Login linked')) { onChanged(); onClose() }
  }
  const unlink = async (uid) => {
    if (await run(() => supabase.from('student_members').delete().eq('student_id', student.id).eq('user_id', uid), 'Login unlinked')) { onChanged(); onClose() }
  }

  return (
    <>
      <Modal open onClose={onClose} wide title={student.full_name}
        footer={<>
          <button className="btn-soft" onClick={() => setInvOpen(true)}><ReceiptText size={16} /> Create bill</button>
          <button className="btn-soft" onClick={() => setAdjOpen(true)}><SlidersHorizontal size={16} /> Charge / discount</button>
          <button className="btn-success" onClick={() => setPayOpen(true)}><IndianRupee size={16} /> Record payment</button>
          <button className="btn-primary" onClick={() => onEdit(student)}><Pencil size={16} /> Edit</button>
        </>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-brand-50 p-3"><div className="text-xs font-bold uppercase text-muted">Plan</div><div className="font-extrabold">{planLabel(student)}</div></div>
            <div className={`rounded-xl p-3 ${due > 0 ? 'bg-rose-100' : 'bg-mint-100'}`}><div className="text-xs font-bold uppercase text-muted">{due >= 0 ? 'Balance due' : 'Advance credit'}</div><div className="font-extrabold">{money(Math.abs(due))}</div></div>
            <div className="rounded-xl bg-sun-100 p-3"><div className="text-xs font-bold uppercase text-muted">Paid so far</div><div className="font-extrabold">{money(balance?.paid)}</div></div>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {student.parent_name && <div><span className="text-muted">Parent:</span> <b>{student.parent_name}</b></div>}
            {student.phone && <div className="flex items-center gap-2"><Phone size={15} className="text-muted" /> <a className="font-bold text-brand-700" href={`tel:${student.phone}`}>{student.phone}</a>
              {wa && <a className="btn-soft btn-sm" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}</div>}
            {student.parent_email && <div className="flex items-center gap-2"><Mail size={15} className="text-muted" /> {student.parent_email}</div>}
            {student.student_email && <div className="flex items-center gap-2"><Mail size={15} className="text-muted" /> {student.student_email} (student)</div>}
            {student.address && <a className="flex items-center gap-2 text-brand-700 underline sm:col-span-2" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(student.address)}`}><MapPin size={15} /> {student.address}</a>}
            {student.notes && <div className="rounded-xl bg-slate-50 p-2 sm:col-span-2">{student.notes}</div>}
          </div>

          <div>
            <div className="label">Family logins</div>
            {linked.length ? (
              <div className="space-y-1.5">
                {linked.map((m) => (
                  <div key={m.profiles?.id} className="flex items-center justify-between rounded-xl border border-brand-100 px-3 py-2 text-sm">
                    <span><b>{m.profiles?.full_name || m.profiles?.email}</b> <span className="text-muted">· {m.profiles?.email} · {m.relation}</span></span>
                    <button className="rounded-lg p-1 text-muted hover:bg-rose-100 hover:text-rose-600" disabled={busy} onClick={() => unlink(m.profiles.id)} aria-label="Unlink"><Unlink size={15} /></button>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted">No one linked yet. Ask the parent to sign up with <b>{student.parent_email || 'the email saved above'}</b> — they’ll be linked automatically.</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <select className="input w-auto min-w-[200px] flex-1 py-2" value={linkUser} onChange={(e) => setLinkUser(e.target.value)}>
                <option value="">Link an existing login…</option>
                {profiles.filter((p) => !linkedIds.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.full_name ? `${p.full_name} — ` : ''}{p.email}</option>)}
              </select>
              <select className="input w-auto py-2" value={linkRel} onChange={(e) => setLinkRel(e.target.value)}>
                <option value="parent">as parent</option><option value="student">as student</option>
              </select>
              <button className="btn-soft" disabled={!linkUser || busy} onClick={link}><Link2 size={16} /> Link</button>
            </div>
          </div>

          <div>
            <div className="label">Recent classes</div>
            {classes.length ? <div className="space-y-2">{classes.map((c) => <ClassRow key={c.id} c={c} showStudent={false} onClick={() => setDetail(c)} />)}</div>
              : <p className="text-sm text-muted">No classes yet.</p>}
          </div>
        </div>
      </Modal>
      <ClassDetailModal cls={detail} onClose={() => setDetail(null)} onChanged={load} />
      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)} studentId={student.id} onSaved={() => { onChanged(); onClose() }} />
      <InvoiceModal open={invOpen} onClose={() => setInvOpen(false)} studentId={student.id} onSaved={() => { onChanged(); onClose() }} />
      <AdjustmentModal open={adjOpen} onClose={() => setAdjOpen(false)} studentId={student.id} onSaved={() => { onChanged(); onClose() }} />
    </>
  )
}
