import { useCallback, useEffect, useState } from 'react'
import { ReceiptText, IndianRupee, Layers, MessageCircle, Ban, Trash2, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Badge, Card, Empty, Field, Loading, Modal, PageHeader, Spinner, Stat, Tabs, useAction, useToast } from '../../components/ui'
import { PendingPayments } from './Dashboard'
import { balanceDue, fmtDate, invoiceState, money, planLabel, ymd } from '../../lib/format'

const lastMonthRange = () => {
  const n = new Date()
  const s = new Date(n.getFullYear(), n.getMonth() - (n.getDate() < 10 ? 1 : 0), 1)
  const e = new Date(s.getFullYear(), s.getMonth() + 1, 0)
  return [ymd(s), ymd(e)]
}

export function RecordPaymentModal({ open, onClose, studentId, onSaved }) {
  const { students } = useAuth()
  const [f, setF] = useState({})
  const [invoices, setInvoices] = useState([])
  const [run, busy] = useAction()
  useEffect(() => {
    if (open) setF({ student_id: studentId || students[0]?.id || '', amount: '', method: 'cash', reference: '', paid_on: ymd(new Date()), invoice_id: '', note: '' })
  }, [open, studentId, students])
  useEffect(() => {
    if (!open || !f.student_id) return
    supabase.from('invoice_summary').select('*').eq('student_id', f.student_id).eq('status', 'issued').order('created_at', { ascending: false })
      .then(({ data }) => setInvoices((data || []).filter((i) => Number(i.paid_amount) < Number(i.amount))))
  }, [open, f.student_id])
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  async function save() {
    const ok = await run(() => supabase.from('payments').insert({
      student_id: f.student_id, amount: Number(f.amount), method: f.method, reference: f.reference || null,
      paid_on: f.paid_on, invoice_id: f.invoice_id || null, note: f.note || null, status: 'confirmed',
    }), 'Payment recorded')
    if (ok) { onSaved?.(); onClose() }
  }
  return (
    <Modal open={open} onClose={onClose} title="Record a payment"
      footer={<><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-success" disabled={busy || !(Number(f.amount) > 0) || !f.student_id} onClick={save}>{busy && <Spinner />} Save payment</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Student" className="col-span-2">
          <select className="input" value={f.student_id} onChange={set('student_id')} disabled={!!studentId}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </Field>
        <Field label="Amount (₹)"><input className="input text-lg font-extrabold" type="number" min="1" value={f.amount} onChange={set('amount')} autoFocus /></Field>
        <Field label="Received on"><input className="input" type="date" value={f.paid_on} onChange={set('paid_on')} /></Field>
        <Field label="Method">
          <select className="input" value={f.method} onChange={set('method')}>
            <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option><option value="card">Card</option><option value="other">Other</option>
          </select>
        </Field>
        <Field label="Reference"><input className="input" value={f.reference} onChange={set('reference')} placeholder="optional" /></Field>
        <Field label="Against bill" className="col-span-2" hint="Leave as advance if paying ahead for upcoming classes.">
          <select className="input" value={f.invoice_id} onChange={set('invoice_id')}>
            <option value="">General / advance payment</option>
            {invoices.map((i) => <option key={i.id} value={i.id}>#{i.invoice_no} · {i.title} · {money(Number(i.amount) - Number(i.paid_amount))} left</option>)}
          </select>
        </Field>
        <Field label="Note" className="col-span-2"><input className="input" value={f.note} onChange={set('note')} placeholder="e.g. advance for 8 classes" /></Field>
      </div>
    </Modal>
  )
}

export function InvoiceModal({ open, onClose, studentId, onSaved }) {
  const { students } = useAuth()
  const [f, setF] = useState({})
  const [run, busy] = useAction()
  const toast = useToast()
  useEffect(() => {
    if (!open) return
    const [s, e] = lastMonthRange()
    setF({ student_id: studentId || '', all: !studentId, start: s, end: e, due: '', manual: false, title: '', amount: '' })
  }, [open, studentId])
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function save() {
    if (f.manual) {
      const ok = await run(() => supabase.from('invoices').insert({
        student_id: f.student_id, title: f.title || 'Tuition fee', amount: Number(f.amount), period_start: f.start || null, period_end: f.end || null, due_date: f.due || null,
      }), 'Bill created')
      if (ok) { onSaved?.(); onClose() }
      return
    }
    const ids = f.all ? students.map((s) => s.id) : [f.student_id]
    let made = 0
    const ok = await run(async () => {
      for (const id of ids) {
        const { data, error } = await supabase.rpc('generate_invoice', { p_student: id, p_start: f.start, p_end: f.end, p_due: f.due || null })
        if (error) return { error }
        if (data) made++
      }
      return {}
    })
    if (ok) {
      toast(made ? `${made} bill(s) created` : 'Nothing to bill — no unbilled completed classes in that period.', made ? 'success' : 'error')
      if (made) { onSaved?.(); onClose() }
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create bill"
      footer={<><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-primary" disabled={busy || (!f.all && !f.student_id) || (f.manual && !(Number(f.amount) > 0))} onClick={save}>{busy && <Spinner />} Create</button></>}>
      <div className="space-y-3">
        {!studentId && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!f.all} onChange={(e) => setF((x) => ({ ...x, all: e.target.checked, manual: false }))} /> Bill all active students
          </label>
        )}
        {!f.all && !studentId && (
          <Field label="Student">
            <select className="input" value={f.student_id} onChange={set('student_id')}>
              <option value="">Choose…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({planLabel(s)})</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><input type="date" className="input" value={f.start || ''} onChange={set('start')} /></Field>
          <Field label="To"><input type="date" className="input" value={f.end || ''} onChange={set('end')} /></Field>
          <Field label="Due date" hint="Default: 7 days after period"><input type="date" className="input" value={f.due || ''} onChange={set('due')} /></Field>
        </div>
        {!f.all && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!f.manual} onChange={set('manual')} /> Enter amount manually (e.g. advance package)
          </label>
        )}
        {f.manual ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title" className="col-span-2"><input className="input" value={f.title} onChange={set('title')} placeholder="e.g. Package of 8 classes" /></Field>
            <Field label="Amount (₹)"><input type="number" min="1" className="input" value={f.amount} onChange={set('amount')} /></Field>
          </div>
        ) : (
          <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
            Per-hour and per-class students are billed for <b>completed, not-yet-billed</b> classes in this period (trial classes are free). Monthly-plan students get their monthly fee.
          </p>
        )}
      </div>
    </Modal>
  )
}

export default function Billing() {
  const { settings, students } = useAuth()
  const [tab, setTab] = useState('balances')
  const [data, setData] = useState(null)
  const [payFor, setPayFor] = useState(null) // studentId | ''
  const [invFor, setInvFor] = useState(null)
  const [run, busy] = useAction()

  const load = useCallback(async () => {
    const [b, i, p] = await Promise.all([
      supabase.from('student_balances').select('*').order('full_name'),
      supabase.from('invoice_summary').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('payments').select('*, students(full_name)').order('paid_on', { ascending: false }).order('created_at', { ascending: false }).limit(200),
    ])
    setData({ balances: b.data || [], invoices: i.data || [], payments: p.data || [] })
  }, [])
  useEffect(() => { load() }, [load])

  const pending = data?.payments.filter((p) => p.status === 'pending') || []
  const totals = (data?.balances || []).reduce((a, b) => ({
    due: a.due + Math.max(0, balanceDue(b)), unbilled: a.unbilled + Number(b.unbilled), paid: a.paid + Number(b.paid),
  }), { due: 0, unbilled: 0, paid: 0 })

  const reminder = (b) => {
    const s = students.find((x) => x.id === b.student_id)
    if (!s?.phone) return null
    const due = balanceDue(b)
    const msg = `Namaste${s.parent_name ? ` ${s.parent_name}` : ''}, a gentle reminder from ${settings?.brand_name || 'ShikshaGram'}: ₹${Math.round(due)} is due for ${s.full_name}'s tuition.` +
      (settings?.upi_id ? ` UPI: ${settings.upi_id}.` : '') + ` You can see details and pay here: ${window.location.origin + window.location.pathname}. Thank you!`
    return `https://wa.me/${s.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(msg)}`
  }

  return (
    <>
      <PageHeader title="Billing" subtitle="Bills, payments and who owes what."
        actions={<>
          <button className="btn-soft" onClick={() => setInvFor('')}><Layers size={17} /> Create bills</button>
          <button className="btn-success" onClick={() => setPayFor('')}><IndianRupee size={17} /> Record payment</button>
        </>} />

      {!data ? <Loading /> : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Stat icon={Wallet} tone="rose" label="To collect" value={money(totals.due)} hint="Billed + not-yet-billed − paid" />
            <Stat icon={ReceiptText} tone="sun" label="Not yet billed" value={money(totals.unbilled)} hint="Completed classes waiting for a bill" />
            <Stat icon={IndianRupee} tone="mint" label="Received (all time)" value={money(totals.paid)} />
          </div>

          <Tabs value={tab} onChange={setTab} tabs={[
            { value: 'balances', label: 'Balances' }, { value: 'verify', label: 'To verify', count: pending.length },
            { value: 'invoices', label: 'Bills' }, { value: 'payments', label: 'Payments' },
          ]} />

          {tab === 'balances' && (
            <Card className="table-wrap">
              <table className="table">
                <thead><tr><th>Student</th><th className="text-right">Billed</th><th className="text-right">Not billed</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th /></tr></thead>
                <tbody>
                  {data.balances.filter((b) => b.active || balanceDue(b) !== 0).map((b) => {
                    const due = balanceDue(b)
                    const wa = due > 0 ? reminder(b) : null
                    return (
                      <tr key={b.student_id}>
                        <td className="font-bold">{b.full_name}{Number(b.pending) > 0 && <div className="text-xs font-semibold text-sun-600">{money(b.pending)} to verify</div>}</td>
                        <td className="text-right">{money(b.billed)}</td>
                        <td className="text-right text-muted">{money(b.unbilled)}</td>
                        <td className="text-right">{money(b.paid)}</td>
                        <td className={`text-right font-extrabold ${due > 0 ? 'text-rose-600' : 'text-mint-700'}`}>{due < 0 ? `+${money(-due)}` : money(due)}</td>
                        <td className="whitespace-nowrap text-right">
                          <div className="flex justify-end gap-1">
                            {Number(b.unbilled) > 0 && <button className="btn-soft btn-sm" onClick={() => setInvFor(b.student_id)}>Bill</button>}
                            <button className="btn-success btn-sm" onClick={() => setPayFor(b.student_id)}>Paid</button>
                            {wa && <a className="btn-ghost btn-sm" href={wa} target="_blank" rel="noreferrer" title="WhatsApp reminder"><MessageCircle size={15} /></a>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!data.balances.length && <Empty title="No students yet" />}
              <p className="px-3 py-2 text-xs text-muted">Balance = classes taken (billed or not) − payments received. “+” means advance credit (paid ahead). Bills are optional — use them if a family wants a formal monthly statement.</p>
            </Card>
          )}

          {tab === 'verify' && <Card className="p-4"><PendingPayments rows={pending} onChanged={load} /></Card>}

          {tab === 'invoices' && (
            <Card className="table-wrap">
              {data.invoices.length === 0 ? <Empty icon={ReceiptText} title="No bills yet" text="Use “Create bills” at the end of each month." /> : (
                <table className="table">
                  <thead><tr><th>#</th><th>Student</th><th>For</th><th className="text-right">Amount</th><th>Status</th><th>Due</th><th /></tr></thead>
                  <tbody>
                    {data.invoices.map((i) => (
                      <tr key={i.id} className={i.status === 'void' ? 'opacity-50' : ''}>
                        <td className="font-bold">{i.invoice_no}</td>
                        <td className="font-bold">{i.student_name}</td>
                        <td className="min-w-[180px]">{i.title}</td>
                        <td className="text-right font-extrabold">{money(i.amount)}{Number(i.paid_amount) > 0 && invoiceState(i) !== 'paid' && <div className="text-xs font-semibold text-muted">paid {money(i.paid_amount)}</div>}</td>
                        <td><Badge status={invoiceState(i)} /></td>
                        <td className="whitespace-nowrap text-muted">{i.due_date ? fmtDate(i.due_date) : '—'}</td>
                        <td className="text-right">
                          {i.status !== 'void' && (
                            <button className="btn-ghost btn-sm" title="Void bill (classes become unbilled again)" disabled={busy}
                              onClick={async () => {
                                if (!confirm(`Void bill #${i.invoice_no}? Its classes become unbilled again.`)) return
                                if (await run(async () => {
                                  const r = await supabase.from('classes').update({ invoice_id: null }).eq('invoice_id', i.id)
                                  if (r.error) return r
                                  return supabase.from('invoices').update({ status: 'void' }).eq('id', i.id)
                                }, 'Bill voided')) load()
                              }}><Ban size={15} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {tab === 'payments' && (
            <Card className="table-wrap">
              {data.payments.length === 0 ? <Empty icon={IndianRupee} title="No payments yet" /> : (
                <table className="table">
                  <thead><tr><th>Date</th><th>Student</th><th className="text-right">Amount</th><th>Via</th><th>Ref / note</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap">{fmtDate(p.paid_on)}</td>
                        <td className="font-bold">{p.students?.full_name}</td>
                        <td className="text-right font-extrabold">{money(p.amount)}</td>
                        <td className="uppercase text-muted">{p.method}</td>
                        <td className="text-muted">{[p.reference, p.note].filter(Boolean).join(' · ') || '—'}</td>
                        <td><Badge status={p.status} /></td>
                        <td className="text-right">
                          <button className="btn-ghost btn-sm" disabled={busy} title="Delete"
                            onClick={async () => { if (confirm('Delete this payment record?') && await run(() => supabase.from('payments').delete().eq('id', p.id), 'Payment deleted')) load() }}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </>
      )}

      <RecordPaymentModal open={payFor !== null} studentId={payFor || undefined} onClose={() => setPayFor(null)} onSaved={load} />
      <InvoiceModal open={invFor !== null} studentId={invFor || undefined} onClose={() => setInvFor(null)} onSaved={load} />
    </>
  )
}
