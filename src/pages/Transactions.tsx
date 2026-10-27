import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { useStore } from '../lib/store'
import { useLookup } from '../lib/lookup'
import { summarize, txIn } from '../lib/stats'
import { fmtDay, money } from '../lib/format'
import { PeriodBar, usePeriod } from '../components/PeriodBar'
import { useTxSheet } from '../components/TxSheet'
import { IconBadge } from '../components/Icon'
import { Card, Empty, Money, PageTitle, Seg, Tag } from '../components/ui'
import type { Kind } from '../lib/types'

type KindFilter = 'all' | Kind
type StatusFilter = 'all' | 'pending'

export default function Transactions() {
  const { data, update } = useStore()
  const { range } = usePeriod()
  const { label } = useLookup()
  const { edit, open } = useTxSheet()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [cat, setCat] = useState('')

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return txIn(data.transactions, range)
      .filter((t) => kind === 'all' || t.kind === kind)
      .filter((t) => status === 'all' || !t.paid)
      .filter((t) => !cat || t.category_id === cat || t.source_id === cat)
      .filter((t) => !needle || t.description.toLowerCase().includes(needle) || label(t).name.toLowerCase().includes(needle))
      .sort((a, b) => (a.date === b.date ? (a.description < b.description ? -1 : 1) : a.date < b.date ? 1 : -1))
  }, [data.transactions, range, q, kind, status, cat, label])

  const sum = useMemo(() => summarize(list), [list])
  const groups = useMemo(() => {
    const m = new Map<string, typeof list>()
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t])
    return [...m.entries()]
  }, [list])

  const options = [...data.categories.map((c) => ({ id: c.id, name: c.name })), ...data.sources.map((s) => ({ id: s.id, name: s.name }))]

  return (
    <>
      <PageTitle title="Lançamentos" subtitle={`${list.length} no período`}
        actions={<button className="btn btn-primary hidden sm:inline-flex" onClick={() => open()}>+ Novo</button>} />
      <PeriodBar />

      <Card className="mb-4 !p-3 sm:!p-4" delay={40}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
            <input className="input !pl-9" placeholder="Buscar descrição ou categoria" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input md:!w-[210px]" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap items-center justify-between">
          <div className="overflow-x-auto no-scrollbar">
            <Seg<KindFilter> value={kind} onChange={setKind} options={[
              { value: 'all', label: 'Tudo' }, { value: 'expense', label: 'Despesas' },
              { value: 'income', label: 'Receitas' }, { value: 'investment', label: 'Invest.' },
            ]} />
          </div>
          <Seg<StatusFilter> value={status} onChange={setStatus} options={[{ value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendentes' }]} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <Mini label="Recebido" v={sum.income} c="var(--c-green)" />
          <Mini label="Gasto" v={sum.expense} c="var(--c-red)" />
          <Mini label="Investido" v={sum.investment} c="var(--c-blue)" />
        </div>
      </Card>

      {groups.length === 0 ? (
        <Card><Empty icon="search" title="Nada encontrado">Ajuste o período ou os filtros — ou adicione um lançamento.</Empty></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([date, items], gi) => {
            const total = items.reduce((a, t) => a + (t.kind === 'income' ? t.amount : -t.amount), 0)
            return (
              <Card key={date} className="!p-0 overflow-hidden" delay={Math.min(gi, 8) * 30}>
                <div className="flex justify-between items-center px-5 py-2.5 bg-[var(--field)] text-[12.5px] font-semibold text-ink2 capitalize">
                  <span>{fmtDay(date)}</span>
                  <span className="money num">{money(total)}</span>
                </div>
                {items.map((t) => {
                  const l = label(t)
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 border-b border-hair last:border-0 hover:bg-[var(--field)] transition-colors">
                      <button aria-label={t.paid ? 'Marcar como pendente' : 'Marcar como pago'} onClick={() => update('transactions', t.id, { paid: !t.paid })}
                        className="h-6 w-6 rounded-full grid place-items-center p-0 shrink-0 border-2"
                        style={t.paid ? { background: 'var(--c-green)', borderColor: 'var(--c-green)', color: '#fff' } : { background: 'transparent', borderColor: 'var(--ink-3)', color: 'transparent' }}>
                        <Check size={13} strokeWidth={3.2} />
                      </button>
                      <button onClick={() => edit(t)} className="flex-1 min-w-0 flex items-center gap-3 bg-transparent border-0 p-0 text-left">
                        <IconBadge name={l.icon} color={l.color} size={38} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-medium" style={{ opacity: t.paid ? 1 : 0.7 }}>{t.description}</span>
                          <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Tag color={l.color}>{l.name}</Tag>
                            {t.nature === 'fixed' && <Tag color="purple">Fixa</Tag>}
                            {t.recurring_id && <span className="text-[12px] text-ink3">↻</span>}
                            {!t.paid && <Tag color="orange">Pendente</Tag>}
                          </span>
                        </span>
                        <Money v={t.kind === 'income' ? t.amount : -t.amount} sign
                          className={`text-[15px] font-semibold ${t.kind === 'income' ? 'text-income' : t.kind === 'investment' ? 'text-invest' : ''}`} />
                      </button>
                    </div>
                  )
                })}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

function Mini({ label, v, c }: { label: string; v: number; c: string }) {
  return (
    <div className="rounded-2xl bg-[var(--field)] py-2 px-1">
      <div className="text-[11.5px] text-ink2 flex items-center justify-center gap-1.5"><i className="dot" style={{ background: c }} />{label}</div>
      <div className="money num font-semibold text-[14px] sm:text-[15px]">{money(v)}</div>
    </div>
  )
}
