import { useEffect, useState } from 'react'
import { Save, Copy, Share2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Card, Field, PageHeader, Spinner, useAction, useToast } from '../../components/ui'
import { fmtDate } from '../../lib/format'

export default function SettingsPage() {
  const { settings, refresh } = useAuth()
  const [f, setF] = useState(null)
  const [people, setPeople] = useState([])
  const [run, busy] = useAction()
  const toast = useToast()
  const appUrl = window.location.origin + window.location.pathname

  useEffect(() => { if (settings) setF({ ...settings, admin_emails: (settings.admin_emails || []).join(', ') }) }, [settings])
  useEffect(() => {
    supabase.from('profiles').select('id, email, full_name, phone, account_type, created_at, student_members(relation, students(full_name))').order('created_at', { ascending: false })
      .then(({ data }) => setPeople(data || []))
  }, [])
  if (!f) return null
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function save() {
    const admins = f.admin_emails.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)
    if (!admins.length) return toast('Keep at least one admin email.', 'error')
    const ok = await run(() => supabase.from('app_settings').update({
      brand_name: f.brand_name, teacher_name: f.teacher_name, phone: f.phone || null, contact_email: f.contact_email || null,
      upi_id: f.upi_id?.trim() || null, upi_payee_name: f.upi_payee_name || null,
      default_class_minutes: Number(f.default_class_minutes) || 60, booking_notice_hours: Number(f.booking_notice_hours) || 0,
      cancel_notice_hours: Number(f.cancel_notice_hours) || 0, admin_emails: admins, updated_at: new Date().toISOString(),
    }).eq('id', 1), 'Settings saved')
    if (ok) refresh()
  }

  const share = async () => {
    const text = `Join ${f.brand_name} to book classes, see homework and pay fees: ${appUrl}`
    if (navigator.share) { try { await navigator.share({ title: f.brand_name, text, url: appUrl }) } catch { /* cancelled */ } }
    else { navigator.clipboard?.writeText(text); toast('Invite message copied') }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Your details, payment info and who can manage the app."
        actions={<button className="btn-primary" disabled={busy} onClick={save}>{busy ? <Spinner /> : <Save size={16} />} Save</button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-extrabold">Brand & contact</h2>
          <Field label="Name shown in the app"><input className="input" value={f.brand_name} onChange={set('brand_name')} /></Field>
          <Field label="Teacher name"><input className="input" value={f.teacher_name} onChange={set('teacher_name')} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone / WhatsApp"><input className="input" value={f.phone || ''} onChange={set('phone')} inputMode="tel" /></Field>
            <Field label="Contact email"><input className="input" value={f.contact_email || ''} onChange={set('contact_email')} /></Field>
          </div>
          <div className="rounded-xl bg-brand-50 p-3">
            <div className="label">Invite families</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 text-xs">{appUrl}</code>
              <button className="btn-soft btn-sm" onClick={() => { navigator.clipboard?.writeText(appUrl); toast('Link copied') }}><Copy size={14} /> Copy</button>
              <button className="btn-primary btn-sm" onClick={share}><Share2 size={14} /> Share</button>
            </div>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-extrabold">Payments (UPI)</h2>
          <Field label="UPI ID" hint="Families see a QR code and “Open UPI app” button for this ID. Free — no payment gateway fees.">
            <input className="input" value={f.upi_id || ''} onChange={set('upi_id')} placeholder="vivek@okicici" />
          </Field>
          <Field label="Name on UPI"><input className="input" value={f.upi_payee_name || ''} onChange={set('upi_payee_name')} /></Field>
          <h2 className="pt-2 text-lg font-extrabold">Booking rules</h2>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Class length (min)"><input type="number" className="input" value={f.default_class_minutes} onChange={set('default_class_minutes')} /></Field>
            <Field label="Book ≥ hrs ahead"><input type="number" className="input" value={f.booking_notice_hours} onChange={set('booking_notice_hours')} /></Field>
            <Field label="Cancel ≥ hrs ahead"><input type="number" className="input" value={f.cancel_notice_hours} onChange={set('cancel_notice_hours')} /></Field>
          </div>
        </Card>

        <Card className="space-y-3 p-4 lg:col-span-2">
          <h2 className="text-lg font-extrabold">Admins</h2>
          <Field label="Emails with teacher/admin access" hint="Comma separated. Add Vivek’s email here — on his next sign-in he gets this panel.">
            <input className="input" value={f.admin_emails} onChange={set('admin_emails')} />
          </Field>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Users size={19} /> Everyone who has signed up ({people.length})</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Linked to</th><th>Joined</th></tr></thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td className="font-bold">{p.full_name || '—'}{p.phone && <div className="text-xs font-normal text-muted">{p.phone}</div>}</td>
                    <td className="break-all">{p.email}</td>
                    <td className="capitalize">{p.account_type}</td>
                    <td>{p.student_members?.length ? p.student_members.map((m) => m.students?.full_name).join(', ')
                      : p.account_type === 'teacher' ? '—' : <span className="font-semibold text-sun-600">Not linked — open the student and link</span>}</td>
                    <td className="whitespace-nowrap text-muted">{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
