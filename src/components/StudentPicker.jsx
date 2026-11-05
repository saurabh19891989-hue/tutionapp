import { useAuth } from '../lib/auth'

// For parents with more than one child: choose whose classes to show
export default function StudentPicker() {
  const { isAdmin, students, activeStudent, setActiveStudentId } = useAuth()
  if (isAdmin || students.length < 2) return null
  return (
    <select className="input w-auto py-2 font-bold" value={activeStudent?.id || ''} onChange={(e) => setActiveStudentId(e.target.value)} aria-label="Choose student">
      {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
    </select>
  )
}
