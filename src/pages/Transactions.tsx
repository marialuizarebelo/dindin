import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CreditCard, Search } from 'lucide-react'
import { useStore } from '../lib/store'
import { useLookup } from '../lib/lookup'
import { summarize, txIn } from '../lib/stats'
import { fmtDay, money } from '../lib/format'
import { isDone, txTitle } from '../lib/tx'
import { todayISO } from '../lib/period'
import { PeriodBar, usePeriod } from '../components/PeriodBar'
import { IconBadge } from '../components/Icon'
import { useTxSheet } from '../components/TxSheet'
import { Card, Empty, Money, PageTitle, Seg, Tag } from '../components/ui'
import type { Transaction } from '../lib/types'

type KindFilter = 'all' | 'expense' | 'income' | 'vault' | 'transfer'
type StatusFilter = 'all' | 'pending'

const signed = (t: Transaction) =>
  t.kind === 'income' || t.kind === 'redeem' ? t.amount : t.kind === 'yield' ? t.amount : t.kind === 'transfer' ? t.amount : -t.amount
const amountClass = (t: Transaction) =>
  t.kind === 'income' || t.kind === 'yield' ? 'text-income' : t.kind === 'investment' || t.kind === 'redeem' ? 'text-invest' : t.kind === 'transfer' ? 'text-ink2' : ''

export default function Transactions() {
  const { data, update } = useStore()
  const { range } = usePeriod()
  const { label, where, groups, accounts, cards } = useLookup()
  const { edit, open } = useTxSheet()
  const today = todayISO()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [cat, setCat] = useState('')
  const wherePick = sp.get('conta') ? `a:${sp.get('conta')}` : sp.get('cartao') ? `c:${sp.get('cartao')}` : ''
  const groupPick = sp.get('grupo') ?? ''
  const tagPick = sp.get('tag') ?? ''
  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }

  const allTags = useMemo(() => [...new Set(data.transactions.flatMap((t) => t.tags))].sort(), [data.transactions])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return txIn(data.transactions, range)
      .filter((t) => kind === 'all' || (kind === 'vault' ? ['investment', 'redeem', 'yield'].includes(t.kind) : t.kind === kind))
      .filter((t) => status === 'all' || !isDone(t, today))
      .filter((t) => !cat || t.category_id === cat || t.source_id === cat || t.vault_id === cat)
      .filter((t) => !wherePick || (wherePick.startsWith('a:') ? t.account_id === wherePick.slice(2) || t.to_account_id === wherePick.slice(2) : t.card_id === wherePick.slice(2)))
      .filter((t) => !groupPick || t.group_id === groupPick)
      .filter((t) => !tagPick || t.tags.includes(tagPick))
      .filter((t) => !needle || txTitle(t).toLowerCase().includes(needle) || label(t).name.toLowerCase().includes(needle) || t.tags.some((x) => x.toLowerCase().includes(needle)) || t.note.toLowerCase().includes(needle))
      .sort((a, b) => (a.date === b.date ? (a.description < b.description ? -1 : 1) : a.date < b.date ? 1 : -1))
  }, [data.transactions, range, q, kind, status, cat, wherePick, groupPick, tagPick, label, today])

  const sum = useMemo(() => summarize(list, today), [list, today])
  const groupsByDay = useMemo(() => {
    const m = new Map<string, Transaction[]>()
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t])
    return [...m.entries()]
  }, [list])

  const options = [
    ...data.categories.map((c) => ({ id: c.id, name: c.name })),
    ...data.sources.map((s) => ({ id: s.id, name: s.name })),
    ...data.vaults.map((v) => ({ id: v.id, name: `Caixinha: ${v.name}` })),
  ]

  return (
    <>
      <PageTitle title="Lançamentos" subtitle={`${list.length} no período`}
        actions={<button className="btn btn-primary hidden sm:inline-flex" onClick={() => open()}>+ Novo</button>} />
      <PeriodBar />

      <Card className="mb-4 !p-3 sm:!p-4" delay={40}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
            <input className="input !pl-9" placeholder="Buscar descrição, categoria, tag ou observação" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input md:!w-[190px]" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <select className="input" value={wherePick} aria-label="Conta ou cartão" onChange={(e) => {
            const v = e.target.value; const n = new URLSearchParams(sp); n.delete('conta'); n.delete('cartao')
            if (v.startsWith('a:')) n.set('conta', v.slice(2)); else if (v.startsWith('c:')) n.set('cartao', v.slice(2)); setSp(n, { replace: true })
          }}>
            <option value="">Todas as contas e cartões</option>
            {[...accounts.values()].map((a) => <option key={a.id} value={`a:${a.id}`}>{a.name}</option>)}
            {[...cards.values()].map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name} (cartão)</option>)}
          </select>
          <select className="input" value={groupPick} aria-label="Grupo" onChange={(e) => setParam('grupo', e.target.value)}>
            <option value="">Todos os grupos</option>
            {[...groups.values()].map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="input" value={tagPick} aria-label="Tag" onChange={(e) => setParam('tag', e.target.value)}>
            <option value="">Todas as tags</option>
            {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap items-center justify-between">
          <div className="overflow-x-auto no-scrollbar">
            <Seg<KindFilter> value={kind} onChange={setKind} options={[
              { value: 'all', label: 'Tudo' }, { value: 'expense', label: 'Despesas' }, { value: 'income', label: 'Receitas' },
              { value: 'vault', label: 'Caixinhas' }, { value: 'transfer', label: 'Transf.' },
            ]} />
          </div>
          <Seg<StatusFilter> value={status} onChange={setStatus} options={[{ value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendentes' }]} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <Mini label="Recebido" v={sum.income} c="var(--c-green)" />
          <Mini label="Gasto" v={sum.expense} c="var(--c-red)" />
          <Mini label="Investido" v={sum.investment} c="var(--c-purple)" />
        </div>
      </Card>

      {groupsByDay.length === 0 ? (
        <Card><Empty icon="search" title="Nada encontrado">Ajuste o período ou os filtros, ou adicione um lançamento.</Empty></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groupsByDay.map(([date, items], gi) => {
            const total = items.reduce((a, t) => a + (t.kind === 'transfer' || t.kind === 'yield' || t.kind === 'redeem' ? 0 : t.kind === 'income' ? t.amount : -t.amount), 0)
            return (
              <Card key={date} className="!p-0 overflow-hidden" delay={Math.min(gi, 8) * 30}>
                <div className="flex justify-between items-center px-5 py-2.5 bg-[var(--field)] text-[12.5px] font-semibold text-ink2">
                  <span className="first-letter:uppercase">{fmtDay(date)}</span>
                  <span className="money num">{money(total)}</span>
                </div>
                {items.map((t) => {
                  const l = label(t)
                  const w = where(t)
                  const g = t.group_id ? groups.get(t.group_id) : null
                  const done = isDone(t, today)
                  const cardExpense = t.kind === 'expense' && t.card_id
                  const toAcc = t.to_account_id ? accounts.get(t.to_account_id) : null
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 border-b border-hair last:border-0 hover:bg-[var(--field)] transition-colors">
                      {cardExpense ? (
                        <span className="h-6 w-6 grid place-items-center shrink-0 text-ink3" title="Compra no cartão: vai para a fatura"><CreditCard size={16} /></span>
                      ) : t.kind === 'yield' ? <span className="w-6 shrink-0" /> : (
                        <button aria-label={done ? 'Marcar como pendente' : 'Marcar como pago'} onClick={() => update('transactions', t.id, { paid: !t.paid })}
                          className="h-6 w-6 rounded-full grid place-items-center p-0 shrink-0 border-2"
                          style={done ? { background: 'var(--c-green)', borderColor: 'var(--c-green)', color: '#fff' } : { background: 'transparent', borderColor: 'var(--ink-3)', color: 'transparent' }}>
                          <Check size={13} strokeWidth={3.2} />
                        </button>
                      )}
                      <button onClick={() => edit(t)} className="flex-1 min-w-0 flex items-center gap-3 bg-transparent border-0 p-0 text-left">
                        <IconBadge name={l.icon} color={l.color} size={38} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-medium" style={{ opacity: done ? 1 : 0.7 }}>{txTitle(t)}</span>
                          <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {t.kind === 'transfer' ? (
                              <Tag color="gray">{t.card_id ? 'Pagamento de fatura' : `${w?.name ?? 'Conta'} → ${toAcc?.name ?? '?'}`}</Tag>
                            ) : (
                              <Tag color={l.color}>{l.name}</Tag>
                            )}
                            {w && t.kind !== 'transfer' && <Tag color="gray">{w.name}</Tag>}
                            {g && <Tag color={g.color}>{g.name}</Tag>}
                            {t.nature === 'fixed' && !t.debt_id && <Tag color="purple">Fixa</Tag>}
                            {t.debt_id && <Tag color="orange">Dívida</Tag>}
                            {t.recurring_id && <span className="text-[12px] text-ink3">↻</span>}
                            {t.kind === 'redeem' && <Tag color="orange">Resgate</Tag>}
                            {t.kind === 'yield' && <Tag color="green">Rendimento</Tag>}
                            {t.kind === 'investment' && <Tag color="purple">Aporte</Tag>}
                            {t.tags.map((x) => <span key={x} className="text-[12px] text-ink3">#{x}</span>)}
                            {!done && <Tag color="orange">Pendente</Tag>}
                          </span>
                        </span>
                        <Money v={signed(t)} sign={t.kind !== 'transfer'} className={`text-[15px] font-semibold ${amountClass(t)}`} />
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
