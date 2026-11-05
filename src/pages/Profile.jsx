import { useEffect, useState } from 'react'
import { LogOut, Save, KeyRound, MonitorSmartphone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Card, Field, PageHeader, Spinner, useAction } from '../components/ui'
import { Notices } from './member/Home'

export default function Profile() {
  const { profile, user, isAdmin, refresh, signOut, students } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pw, setPw] = useState('')
  const [run, busy] = useAction()
  useEffect(() => { setName(profile?.full_name || ''); setPhone(profile?.phone || '') }, [profile])

  const save = async () => { if (await run(() => supabase.from('profiles').update({ full_name: name.trim() || null, phone: phone.trim() || null }).eq('id', user.id), 'Profile saved')) refresh() }
  const setPassword = async () => { if (await run(() => supabase.auth.updateUser({ password: pw }), 'Password set — you can now sign in with it')) setPw('') }

  return (
    <>
      <PageHeader title="My profile" subtitle={user.email} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-extrabold">Your details</h2>
          <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Phone"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></Field>
          <div className="text-sm text-muted">
            Account: <b className="text-ink">{isAdmin ? 'Teacher (admin)' : profile?.account_type === 'student' ? 'Student' : 'Parent'}</b>
            {!isAdmin && students.length > 0 && <> · Linked to <b className="text-ink">{students.map((s) => s.full_name).join(', ')}</b></>}
          </div>
          <button className="btn-primary" disabled={busy} onClick={save}>{busy ? <Spinner /> : <Save size={16} />} Save</button>
        </Card>
        <Card className="space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><KeyRound size={18} /> Password (optional)</h2>
          <p className="text-sm text-muted">You can always sign in with an email code. Set a password if you prefer that instead.</p>
          <Field label="New password" hint="At least 6 characters"><input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
          <button className="btn-soft" disabled={busy || pw.length < 6} onClick={setPassword}>Set password</button>
          <div className="flex flex-wrap gap-2 border-t border-brand-100 pt-3">
            <button className="btn-danger" onClick={signOut}><LogOut size={16} /> Sign out</button>
            <button className="btn-ghost" onClick={() => supabase.auth.signOut({ scope: 'global' })}><MonitorSmartphone size={16} /> Sign out on all devices</button>
          </div>
        </Card>
        {!isAdmin && <div className="lg:col-span-2"><Notices limit={10} /></div>}
      </div>
    </>
  )
}
