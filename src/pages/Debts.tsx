import { useMemo, useState } from 'react'
import { addMonths, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import { Icon, IconBadge } from '../components/Icon'
import { useStore } from '../lib/store'
import { todayISO } from '../lib/period'
import { debtBalance } from '../lib/stats'
import { money, parseMoney } from '../lib/format'
import { solid, COLOR_KEYS } from '../lib/colors'
import { simulatePayoff, type Strategy } from '../lib/debt'
import { LineChart } from '../components/Charts'
import { useTxSheet } from '../components/TxSheet'
import { Card, ColorPick, TintCard, ConfirmButton, Empty, IconPick, Field, PageTitle, Seg, Sheet, Tag } from '../components/ui'
import type { ColorKey, Debt } from '../lib/types'

const monthName = (n: number) => format(addMonths(new Date(), n), 'MMM yyyy', { locale: ptBR })

export default function Debts() {
  const { data } = useStore()
  const { open } = useTxSheet()
  const [editing, setEditing] = useState<Debt | 'new' | null>(null)
  const [strategy, setStrategy] = useState<Strategy>('avalanche')

  const live = useMemo(() => data.debts.map((d) => ({ d, bal: debtBalance(data, d.id) })), [data])
  const open_ = live.filter((x) => x.bal > 0.005)
  const total = open_.reduce((a, x) => a + x.bal, 0)
  const minTotal = open_.reduce((a, x) => a + x.d.min_payment, 0)
  const [extra, setExtra] = useState('')
  const budget = minTotal + (parseMoney(extra) || 0)

  const inputs = open_.map((x) => ({ id: x.d.id, name: x.d.name, balance: x.bal, rate: x.d.interest_monthly, minPayment: x.d.min_payment }))
  const av = useMemo(() => simulatePayoff(inputs, budget, 'avalanche'), [inputs, budget])
  const sn = useMemo(() => simulatePayoff(inputs, budget, 'snowball'), [inputs, budget])
  const chosen = strategy === 'avalanche' ? av : sn
  const nameOf = (id: string) => data.debts.find((d) => d.id === id)

  const series = (r: typeof av) => r.series.slice(0, Math.min(r.series.length, 61))
  const len = Math.max(series(av).length, series(sn).length)
  const pad = (a: number[]) => Array.from({ length: len }, (_, i) => a[i] ?? 0)

  return (
    <>
      <PageTitle title="Dívidas" subtitle="Veja o caminho até zerar"
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nova dívida</button>} />

      {data.debts.length === 0 ? (
        <Card><Empty icon="bird" title="Sem dívidas cadastradas">Se tiver cartão, empréstimo ou parcelamento, cadastre aqui e simule a melhor forma de quitar.</Empty></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <Stat title="Em aberto" v={money(total)} delay={20} color="red" icon="card" />
            <Stat title="Mínimos por mês" v={money(minTotal)} delay={60} color="orange" icon="receipt" />
            <Stat title="Livre das dívidas" v={chosen.feasible && chosen.months > 0 ? monthName(chosen.months) : chosen.feasible ? 'Tudo quitado' : 'Não quita'} delay={100} color="green" icon="sprout" />
            <Stat title="Juros até lá" v={chosen.feasible ? money(chosen.totalInterest) : '—'} delay={140} color="purple" icon="trend" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mb-4">
            {live.map(({ d, bal }, i) => (
              <Card key={d.id} delay={180 + i * 40}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <IconBadge name={d.icon} color={d.color} size={44} />
                    <div><div className="font-semibold">{d.name}</div>
                      <div className="flex gap-1.5 mt-0.5 flex-wrap"><Tag color={d.interest_monthly > 5 ? 'red' : d.interest_monthly > 0 ? 'orange' : 'green'}>{String(d.interest_monthly).replace('.', ',')}% a.m.</Tag>{d.due_day && <Tag color="gray">vence dia {d.due_day}</Tag>}</div></div>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditing(d)}>Editar</button>
                </div>
                <div className="flex items-baseline justify-between mt-4">
                  <div><div className="text-[12px] text-ink2">Saldo devedor</div><div className="money num text-[24px] font-bold">{money(bal)}</div></div>
                  <div className="text-right"><div className="text-[12px] text-ink2">Mínimo</div><div className="money num font-semibold">{money(d.min_payment)}</div></div>
                </div>
                <button className="btn w-full mt-3" disabled={bal === 0}
                  onClick={() => open({ kind: 'expense', nature: 'fixed', debt_id: d.id, amount: Math.min(d.min_payment, bal), description: `Pgto ${d.name}`, category_id: data.categories.find((c) => c.name === 'Dívidas')?.id ?? null })}>
                  Registrar pagamento
                </button>
              </Card>
            ))}
          </div>

          {open_.length > 0 && (
            <Card delay={300}>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
                <div className="font-semibold text-[16px]">Simulador de quitação</div>
                <Seg<Strategy> value={strategy} onChange={setStrategy} options={[{ value: 'avalanche', label: 'Maior juros primeiro' }, { value: 'snowball', label: 'Menor saldo primeiro' }]} />
              </div>
              <p className="text-ink2 text-[13.5px] mt-0 mb-4">Pagando os mínimos em tudo e jogando o que sobrar na dívida prioritária.</p>

              <div className="grid gap-4 md:grid-cols-[260px_1fr] items-start">
                <div className="flex flex-col gap-3">
                  <Field label="Quanto a mais por mês consigo pagar?">
                    <input className="input" inputMode="decimal" placeholder="0,00" value={extra} onChange={(e) => setExtra(e.target.value)} />
                  </Field>
                  <div className="text-[13px] text-ink2">Total por mês nas dívidas: <b className="money num text-ink">{money(budget)}</b></div>
                  <div className="rounded-2xl bg-[var(--field)] p-3 text-[13px]">
                    {av.feasible && sn.feasible ? (
                      av.totalInterest < sn.totalInterest - 1
                        ? <>Maior juros primeiro economiza <b className="money num">{money(sn.totalInterest - av.totalInterest)}</b> em juros. Menor saldo primeiro dá vitórias rápidas: <b>{nameOf(sn.order[0])?.name}</b> some em {monthName(sn.payoffMonth[sn.order[0]])}.</>
                        : <>As duas estratégias dão resultado parecido com esses números.</>
                    ) : <>Com esse valor, os juros crescem mais rápido que os pagamentos. Aumente o valor mensal.</>}
                  </div>
                </div>
                <div>
                  <LineChart height={210} labels={Array.from({ length: len }, (_, i) => (i % 6 === 0 ? monthName(i) : ''))}
                    series={[
                      { name: 'Maior juros primeiro', color: solid('red'), values: pad(series(av)) },
                      { name: 'Menor saldo primeiro', color: solid('blue'), values: pad(series(sn)) },
                    ]} />
                </div>
              </div>

              <hr className="hair my-4" />
              <div className="text-[13px] font-semibold text-ink2 mb-2">Ordem de quitação ({strategy === 'avalanche' ? 'maior juros primeiro' : 'menor saldo primeiro'})</div>
              <div className="flex flex-col gap-2">
                {chosen.order.map((id, i) => {
                  const d = nameOf(id)!
                  return (
                    <div key={id} className="flex items-center gap-3 text-[14px]">
                      <span className="h-6 w-6 rounded-full grid place-items-center text-[12px] font-bold text-white" style={{ background: solid(d.color) }}>{i + 1}</span>
                      <span className="flex-1 flex items-center gap-2"><Icon name={d.icon} size={15} className="text-ink2" />{d.name}</span>
                      <span className="text-ink2">quita em <b className="text-ink capitalize">{monthName(chosen.payoffMonth[id])}</b></span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}
      {editing && <DebtForm debt={editing === 'new' ? undefined : editing} current={editing !== 'new' && editing ? debtBalance(data, editing.id) : undefined} onClose={() => setEditing(null)} />}
    </>
  )
}

function Stat({ title, v, delay, color, icon }: { title: string; v: string; delay: number; color: ColorKey; icon: string }) {
  return (
    <TintCard color={color} icon={icon} label={title} delay={delay}>
      <div className="money num font-display kpi-num capitalize">{v}</div>
    </TintCard>
  )
}

function DebtForm({ debt, current, onClose }: { debt?: Debt; current?: number; onClose: () => void }) {
  const { add, update, remove, notify } = useStore()
  const [name, setName] = useState(debt?.name ?? '')
  const [creditor, setCreditor] = useState(debt?.creditor ?? '')
  const [icon, setIcon] = useState(debt?.icon ?? 'card')
  const [color, setColor] = useState<ColorKey>(debt?.color ?? 'red')
  const [balance, setBalance] = useState(current !== undefined ? String(current).replace('.', ',') : '')
  const [rate, setRate] = useState(debt ? String(debt.interest_monthly).replace('.', ',') : '')
  const [min, setMin] = useState(debt ? String(debt.min_payment).replace('.', ',') : '')
  const [due, setDue] = useState(debt?.due_day ? String(debt.due_day) : '')
  const [err, setErr] = useState('')
  const save = () => {
    const b = parseMoney(balance)
    if (!name.trim()) return setErr('Dê um nome')
    if (!(b >= 0)) return setErr('Informe o saldo devedor')
    const row = {
      name: name.trim(), creditor: creditor.trim(), icon, color, balance: b, balance_date: todayISO(),
      interest_monthly: parseMoney(rate) || 0, min_payment: parseMoney(min) || 0, due_day: due ? Math.min(Math.max(parseInt(due, 10), 1), 31) : null,
    }
    if (debt) update('debts', debt.id, row)
    else add('debts', row)
    notify('Dívida salva')
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={debt ? 'Editar dívida' : 'Nova dívida'}
      footer={<>{debt && <ConfirmButton className="mr-auto" onConfirm={() => { remove('debts', [debt.id]); onClose() }}>Apagar</ConfirmButton>}<button className="btn btn-primary" onClick={save}>Salvar</button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cartão, empréstimo" /></Field>
        <Field label="Credor (opcional)"><input className="input" value={creditor} onChange={(e) => setCreditor(e.target.value)} /></Field>
        <Field label="Saldo devedor hoje (R$)"><input className="input" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
          {debt && <div className="text-[12px] text-ink2 mt-1">Atualize aqui quando o banco informar um novo saldo (já com juros). Pagamentos registrados antes de hoje deixam de contar.</div>}</Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Juros % a.m."><input className="input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" /></Field>
          <Field label="Mínimo (R$)"><input className="input" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0,00" /></Field>
          <Field label="Vence dia"><input className="input" type="number" min={1} max={31} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        {err && <div className="text-[13px]" style={{ color: 'var(--c-red)' }}>{err}</div>}
        <Field label="Ícone"><IconPick value={icon} onChange={setIcon} /></Field>
        <Field label="Cor"><ColorPick value={color} onChange={setColor} keys={COLOR_KEYS} /></Field>
      </div>
    </Sheet>
  )
}

