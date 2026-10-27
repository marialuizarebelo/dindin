import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { defaultPeriod, GRAN_LABELS, labelOf, rangeOf, shift, todayISO, type Gran, type Period, type Range } from '../lib/period'
import { Seg } from './ui'

interface PeriodCtx { period: Period; setPeriod: (p: Period) => void; range: Range }
const Ctx = createContext<PeriodCtx | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>(defaultPeriod)
  const value = useMemo(() => ({ period, setPeriod, range: rangeOf(period) }), [period])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const usePeriod = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePeriod fora do provider')
  return c
}

const GRANS: Gran[] = ['day', 'week', 'month', 'quarter', 'semester', 'year', 'custom']
const SHORT: Record<Gran, string> = { day: 'Dia', week: 'Semana', month: 'Mês', quarter: 'Trim.', semester: 'Sem.', year: 'Ano', custom: 'Outro' }

export function PeriodBar({ grans = GRANS }: { grans?: Gran[] }) {
  const { period, setPeriod, range } = usePeriod()
  const isToday = (() => {
    const t = todayISO()
    return t >= range.start && t <= range.end
  })()
  return (
    <div className="flex flex-col gap-2.5 mb-4 fade-up">
      <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
        <Seg<Gran> value={period.gran} options={grans.map((g) => ({ value: g, label: SHORT[g] }))}
          onChange={(g) => {
            const r = rangeOf(period)
            setPeriod(g === 'custom' ? { gran: g, anchor: period.anchor, from: r.start, to: r.end } : { gran: g, anchor: period.gran === 'custom' ? todayISO() : period.anchor })
          }} />
      </div>
      <div className="flex items-center gap-2">
        <button className="btn btn-icon" aria-label="Anterior" onClick={() => setPeriod(shift(period, -1))}><ChevronLeft size={18} /></button>
        <div className="glass flex-1 sm:flex-none sm:min-w-[250px] h-[38px] rounded-xl px-4 grid place-items-center font-semibold capitalize text-[14.5px] whitespace-nowrap overflow-hidden text-ellipsis" title={GRAN_LABELS[period.gran]}>
          {labelOf(period)}
        </div>
        <button className="btn btn-icon" aria-label="Próximo" onClick={() => setPeriod(shift(period, 1))}><ChevronRight size={18} /></button>
        {!isToday && <button className="btn" onClick={() => setPeriod({ ...period, anchor: todayISO(), from: undefined, to: undefined })}>Hoje</button>}
        {period.gran === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input type="date" className="input !h-[38px] !w-[140px]" value={period.from ?? ''} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
            <span className="text-ink3">–</span>
            <input type="date" className="input !h-[38px] !w-[140px]" value={period.to ?? ''} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  )
}
