import { useCallback, useEffect, useState } from 'react'
import { BookOpenCheck, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Empty, Loading, PageHeader, Tabs } from '../components/ui'
import { CLASS_SELECT, ClassDetailModal, ClassFormModal, ClassRow } from '../components/ClassModals'
import StudentPicker from '../components/StudentPicker'

export default function ClassesPage() {
  const { isAdmin, students, activeStudent } = useAuth()
  const [tab, setTab] = useState('upcoming')
  const [studentFilter, setStudentFilter] = useState('')
  const [rows, setRows] = useState(null)
  const [requests, setRequests] = useState(0)
  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setRows(null)
    const now = new Date().toISOString()
    let q = supabase.from('classes').select(CLASS_SELECT)
    if (tab === 'upcoming') q = q.in('status', ['scheduled', 'requested']).gte('end_at', now).order('start_at')
    else if (tab === 'requests') q = q.eq('status', 'requested').order('start_at')
    else if (tab === 'due') q = q.eq('status', 'scheduled').lt('end_at', now).order('start_at', { ascending: false })
    else q = q.or(`status.in.(completed,cancelled,missed),end_at.lt.${now}`).order('start_at', { ascending: false }).limit(200)
    const sid = isAdmin ? studentFilter : activeStudent?.id
    if (sid) q = q.eq('student_id', sid)
    const [{ data }, rq] = await Promise.all([
      q,
      isAdmin ? supabase.from('classes').select('id', { count: 'exact', head: true }).eq('status', 'requested') : Promise.resolve({ count: 0 }),
    ])
    setRows(data || [])
    setRequests(rq.count || 0)
  }, [tab, studentFilter, isAdmin, activeStudent])

  useEffect(() => { load() }, [load])

  const tabs = isAdmin
    ? [{ value: 'upcoming', label: 'Upcoming' }, { value: 'requests', label: 'Requests', count: requests }, { value: 'due', label: 'To mark' }, { value: 'past', label: 'Past' }]
    : [{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past & homework' }]

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle={isAdmin ? 'Approve requests, mark attendance and add notes.' : 'Your upcoming classes, topics and homework.'}
        actions={isAdmin ? (
          <>
            <select className="input w-auto py-2" value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
              <option value="">All students</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <button className="btn-primary" onClick={() => setEditing({})}><Plus size={17} /> Add class</button>
          </>
        ) : <StudentPicker />}
      />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'due' && <p className="mb-3 text-sm text-muted">These classes have finished but are still “scheduled”. Open each to mark it completed or missed.</p>}
      {rows === null ? <Loading /> : rows.length === 0 ? (
        <div className="card"><Empty icon={BookOpenCheck} title={tab === 'requests' ? 'No pending requests' : 'No classes here yet'} /></div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((c) => <ClassRow key={c.id} c={c} showStudent={isAdmin || students.length > 1} onClick={() => setDetail(c)} />)}
        </div>
      )}
      <ClassDetailModal cls={detail} onClose={() => setDetail(null)} onChanged={load} onEdit={(c) => setEditing(c)} />
      {isAdmin && <ClassFormModal open={!!editing} initial={editing?.id ? editing : null} students={students} onClose={() => setEditing(null)} onSaved={load} />}
    </>
  )
}
