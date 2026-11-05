import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ymd } from '../lib/format'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// events: [{ date: Date|string, kind: 'class'|'slot'|'request' }]
export default function MonthCalendar({ month, onMonthChange, selected, onSelect, events = [] }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d))
  while (cells.length % 7) cells.push(null)

  const byDay = {}
  for (const e of events) {
    const k = ymd(e.date)
    byDay[k] ??= { class: 0, slot: 0, request: 0 }
    byDay[k][e.kind] = (byDay[k][e.kind] || 0) + 1
  }
  const today = ymd(new Date())
  const sel = selected ? ymd(selected) : null

  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <button className="btn-ghost btn-sm" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <div className="text-lg font-extrabold">
          {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </div>
        <button className="btn-ghost btn-sm" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-muted">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const k = ymd(d)
          const ev = byDay[k]
          const isSel = k === sel
          const isToday = k === today
          return (
            <button
              key={i}
              onClick={() => onSelect(d)}
              className={`flex aspect-square flex-col items-center justify-start rounded-xl pt-1.5 text-sm font-bold transition sm:aspect-[1.15] ${
                isSel ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                  : isToday ? 'bg-sun-100 text-ink ring-2 ring-sun-400'
                  : 'text-slate-700 hover:bg-brand-50'
              }`}
            >
              {d.getDate()}
              <span className="mt-auto mb-1.5 flex gap-0.5">
                {ev?.class ? <i className={`h-1.5 w-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-brand-500'}`} /> : null}
                {ev?.request ? <i className={`h-1.5 w-1.5 rounded-full ${isSel ? 'bg-sun-100' : 'bg-sun-400'}`} /> : null}
                {ev?.slot ? <i className={`h-1.5 w-1.5 rounded-full ${isSel ? 'bg-mint-100' : 'bg-mint-500'}`} /> : null}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-muted">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand-500" /> Class</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-sun-400" /> Request</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-mint-500" /> Open slot</span>
      </div>
    </div>
  )
}
