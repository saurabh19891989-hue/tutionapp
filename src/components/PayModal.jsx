import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Smartphone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Field, Modal, Spinner, useAction, useToast } from './ui'
import { money, upiLink, ymd } from '../lib/format'

// Families: pay by UPI, then tell the teacher ("I have paid") for confirmation
export default function PayModal({ open, onClose, student, invoice, suggested, onDone }) {
  const { settings, user } = useAuth()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [method, setMethod] = useState('upi')
  const [paidOn, setPaidOn] = useState(ymd(new Date()))
  const [qr, setQr] = useState('')
  const [run, busy] = useAction()

  useEffect(() => {
    if (!open) return
    const due = invoice ? Number(invoice.amount) - Number(invoice.paid_amount || 0) : Number(suggested || 0)
    setAmount(due > 0 ? String(Math.round(due)) : '')
    setReference(''); setMethod(settings?.upi_id ? 'upi' : 'cash'); setPaidOn(ymd(new Date()))
  }, [open, invoice, suggested, settings])

  const note = `${student?.full_name || ''} ${invoice ? `Inv ${invoice.invoice_no}` : 'tuition fee'}`.trim()
  const link = settings?.upi_id ? upiLink({ upi: settings.upi_id, name: settings.upi_payee_name || settings.teacher_name, amount, note }) : ''

  useEffect(() => {
    if (!link) { setQr(''); return }
    QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: '#1f2b3d', light: '#ffffff' } }).then(setQr).catch(() => setQr(''))
  }, [link])

  async function submit() {
    if (!(Number(amount) > 0)) return toast('Please enter the amount you paid.', 'error')
    const ok = await run(() => supabase.from('payments').insert({
      student_id: student.id, invoice_id: invoice?.id || null, amount: Number(amount), method,
      reference: reference || null, paid_on: paidOn, status: 'pending', submitted_by: user.id,
    }), 'Thanks! The teacher will confirm your payment shortly.')
    if (ok) { onDone?.(); onClose() }
  }

  return (
    <Modal open={open} onClose={onClose} title={invoice ? `Pay invoice #${invoice.invoice_no}` : 'Pay fees'}
      footer={<><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-success" disabled={busy} onClick={submit}>{busy && <Spinner />} I have paid</button></>}>
      <div className="space-y-4">
        <Field label="Amount (₹)">
          <input className="input text-lg font-extrabold" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>

        {settings?.upi_id ? (
          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-center">
            <div className="text-sm font-bold text-brand-800">Step 1 · Pay by UPI</div>
            {qr && <img src={qr} alt="UPI QR code" className="mx-auto my-3 rounded-xl bg-white p-2" width={200} height={200} />}
            <div className="text-xs text-muted">Scan with GPay, PhonePe, Paytm or any UPI app</div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <a href={link} className="btn-primary btn-sm sm:hidden"><Smartphone size={15} /> Open UPI app</a>
              <button className="btn-soft btn-sm" onClick={() => { navigator.clipboard?.writeText(settings.upi_id); toast('UPI ID copied') }}>
                <Copy size={14} /> {settings.upi_id}
              </button>
            </div>
            {amount > 0 && <div className="mt-2 text-sm">Paying <b>{money(amount)}</b> to {settings.upi_payee_name || settings.teacher_name}</div>}
          </div>
        ) : (
          <p className="rounded-xl bg-sun-100 p-3 text-sm text-sun-600">Pay the teacher by cash or bank transfer, then record it below so it shows up for confirmation.</p>
        )}

        <div>
          <div className="mb-2 text-sm font-bold text-brand-800">{settings?.upi_id ? 'Step 2 · ' : ''}Tell the teacher you paid</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Paid by">
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="upi">UPI</option><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="other">Other</option>
              </select>
            </Field>
            <Field label="Date"><input type="date" className="input" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></Field>
            <Field label="UPI / transaction ref (optional)" className="col-span-2" hint="The 12-digit UTR number from your UPI app helps the teacher match it.">
              <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 431234567890" />
            </Field>
          </div>
        </div>
      </div>
    </Modal>
  )
}
