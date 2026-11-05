import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Pin, Trash2, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card, Empty, Field, Loading, PageHeader, Spinner, useAction } from '../../components/ui'
import { fmtDate } from '../../lib/format'

export default function NoticesAdmin() {
  const [rows, setRows] = useState(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [run, busy] = useAction()
  const load = useCallback(async () => {
    const { data } = await supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false })
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const post = async () => {
    if (await run(() => supabase.from('announcements').insert({ title: title.trim(), body: body.trim() || null, pinned }), 'Notice posted')) {
      setTitle(''); setBody(''); setPinned(false); load()
    }
  }
  return (
    <>
      <PageHeader title="Notice board" subtitle="Holidays, exam tips, schedule changes — every student and parent sees these on their home screen." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card className="h-fit space-y-3 p-4">
          <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="No classes on Diwali (1–3 Nov)" /></Field>
          <Field label="Details (optional)"><textarea rows={4} className="input" value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin to top</label>
          <button className="btn-primary w-full" disabled={busy || !title.trim()} onClick={post}>{busy ? <Spinner /> : <Send size={16} />} Post notice</button>
        </Card>
        <div className="space-y-3">
          {rows === null ? <Loading /> : rows.length === 0 ? <Card><Empty icon={Megaphone} title="No notices yet" /></Card> : rows.map((n) => (
            <Card key={n.id} className={`p-4 ${n.pinned ? 'border-sun-400' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-extrabold">{n.pinned && <Pin size={14} className="mr-1 inline text-sun-600" />}{n.title}</div>
                  {n.body && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{n.body}</p>}
                  <div className="mt-1 text-xs text-muted">{fmtDate(n.created_at)}</div>
                </div>
                <div className="flex gap-1">
                  <button className="btn-ghost btn-sm" title={n.pinned ? 'Unpin' : 'Pin'} onClick={async () => { if (await run(() => supabase.from('announcements').update({ pinned: !n.pinned }).eq('id', n.id))) load() }}><Pin size={15} /></button>
                  <button className="btn-ghost btn-sm text-rose-600" title="Delete" onClick={async () => { if (confirm('Delete this notice?') && await run(() => supabase.from('announcements').delete().eq('id', n.id), 'Deleted')) load() }}><Trash2 size={15} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
