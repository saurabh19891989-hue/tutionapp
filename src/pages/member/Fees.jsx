import { useCallback, useEffect, useState } from 'react'
import { Wallet, Receipt, IndianRupee, Clock4 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Badge, Card, Empty, Loading, PageHeader, Stat, useAction } from '../../components/ui'
import PayModal from '../../components/PayModal'
import StudentPicker from '../../components/StudentPicker'
import { balanceDue, fmtDate, invoiceState, money, planLabel } from '../../lib/format'

export default function Fees() {
  const { activeStudent, user } = useAuth()
  const [data, setData] = useState(null)
  const [pay, setPay] = useState(null) // { invoice? }
  const [run, busy] = useAction()

  const load = useCallback(async () => {
    if (!activeStudent) return
    const id = activeStudent.id
    const [b, inv, p] = await Promise.all([
      supabase.from('student_balances').select('*').eq('student_id', id).maybeSingle(),
      supabase.from('invoice_summary').select('*').eq('student_id', id).neq('status', 'void').order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('student_id', id).order('paid_on', { ascending: false }),
    ])
    setData({ balance: b.data, invoices: inv.data || [], payments: p.data || [] })
  }, [activeStudent])
  useEffect(() => { load() }, [load])

  if (!activeStudent) return <Empty icon={Wallet} title="No student linked yet" text="Ask the teacher to add your email to the student’s profile." />
  if (!data) return <Loading />

  const bal = data.balance || { billed: 0, paid: 0, pending: 0, unbilled: 0 }
  const due = balanceDue(bal)

  return (
    <>
      <PageHeader title="Fees & payments" subtitle={`Plan: ${planLabel(activeStudent)}`}
        actions={<><StudentPicker /><button className="btn-success" onClick={() => setPay({})}><IndianRupee size={17} /> Pay now</button></>} />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat icon={Wallet} tone={due > 0 ? 'rose' : 'mint'} label={due >= 0 ? 'Balance to pay' : 'Advance credit'} value={money(Math.abs(due))}
          hint={due <= 0 ? 'All clear — thank you!' : 'For classes taken so far'} />
        <Stat icon={Clock4} tone="sun" label="Awaiting confirmation" value={money(bal.pending)} hint="Payments you reported" />
        <Stat icon={Receipt} tone="brand" label="Paid so far" value={money(bal.paid)} hint={Number(bal.unbilled) > 0 ? `${money(bal.unbilled)} of classes not yet on a bill` : 'Confirmed by the teacher'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-lg font-extrabold">Bills</h2>
          {data.invoices.length === 0 ? <Empty icon={Receipt} title="No bills yet" /> : (
            <div className="space-y-2">
              {data.invoices.map((inv) => {
                const st = invoiceState(inv)
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-brand-100 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><b>#{inv.invoice_no}</b><Badge status={st} /></div>
                      <div className="truncate text-sm">{inv.title}</div>
                      <div className="text-xs text-muted">{inv.due_date ? `Due ${fmtDate(inv.due_date)}` : fmtDate(inv.created_at)}{Number(inv.paid_amount) > 0 && st !== 'paid' ? ` · paid ${money(inv.paid_amount)}` : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold">{money(inv.amount)}</div>
                      {(st === 'due' || st === 'partial') && <button className="btn-success btn-sm mt-1" onClick={() => setPay({ invoice: inv })}>Pay</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-lg font-extrabold">Payment history</h2>
          {data.payments.length === 0 ? <Empty icon={IndianRupee} title="No payments yet" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Amount</th><th>Via</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap">{fmtDate(p.paid_on)}</td>
                      <td className="font-bold">{money(p.amount)}</td>
                      <td className="uppercase text-muted">{p.method}</td>
                      <td><Badge status={p.status} /></td>
                      <td className="text-right">
                        {p.status === 'pending' && p.submitted_by === user?.id && (
                          <button className="btn-ghost btn-sm text-rose-600" disabled={busy} title="Reported by mistake? Take it back."
                            onClick={async () => { if (confirm(`Withdraw your ${money(p.amount)} payment report?`) && await run(() => supabase.from('payments').delete().eq('id', p.id), 'Report withdrawn')) load() }}>
                            Withdraw
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <PayModal open={!!pay} onClose={() => setPay(null)} student={activeStudent} invoice={pay?.invoice} suggested={Math.max(0, due - Number(bal.pending || 0))} onDone={load} />
    </>
  )
}
