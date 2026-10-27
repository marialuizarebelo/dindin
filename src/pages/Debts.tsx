import { useMemo, useState } from 'react'
import { addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { fmtDate, money, parseMoney, percent } from '../lib/format'
import { solid, COLOR_KEYS } from '../lib/colors'
import { todayISO } from '../lib/period'
import { debtBalance, debtPaidTotal } from '../lib/stats'
import { buildInstallments } from '../lib/installments'
import { simulatePayoff, type Strategy } from '../lib/debt'
import { DEBT_KIND, DEBT_STATUS } from '../lib/labels'
import { isDone } from '../lib/tx'
import type { ColorKey, Debt, DebtKind, DebtStatus } from '../lib/types'
import { LineChart } from '../components/Charts'
import { Icon, IconBadge } from '../components/Icon'
import { fmtInput, WherePicker } from '../components/TxFields'
import { useTxSheet } from '../components/TxSheet'
import { Card, ColorPick, ConfirmButton, Empty, Field, IconPick, PageTitle, Progress, Seg, Sheet, Tag, TintCard } from '../components/ui'

const monthName = (n: number) => { const t = format(addMonths(new Date(), n), 'MMM yyyy', { locale: ptBR }); return t.charAt(0).toUpperCase() + t.slice(1) }

export default function Debts() {
  const { data, update, remove, notify } = useStore()
  const { open } = useTxSheet()
  const today = todayISO()
  const [tab, setTab] = useState<DebtStatus | null>(null)
  const [editing, setEditing] = useState<Debt | 'new' | null>(null)
  const [negotiate, setNegotiate] = useState<Debt | null>(null)
  const [strategy, setStrategy] = useState<Strategy>('avalanche')
  const [extra, setExtra] = useState('')

  const byStatus = (s: DebtStatus) => data.debts.filter((d) => d.status === s)
  const counts = { open: byStatus('open').length, paying: byStatus('paying').length, paid: byStatus('paid').length }
  const current: DebtStatus = tab ?? (counts.paying ? 'paying' : counts.open ? 'open' : counts.paid ? 'paid' : 'paying')
  const active = data.debts.filter((d) => d.status !== 'paid')
  const live = active.map((d) => ({ d, bal: debtBalance(data, d.id) })).filter((x) => x.bal > 0.005)
  const total = live.reduce((a, x) => a + x.bal, 0)
  const monthly = byStatus('paying').reduce((a, d) => a + d.min_payment, 0)
  const paidHistory = byStatus('paid').reduce((a, d) => a + debtPaidTotal(data, d.id), 0)

  const inputs = live.map((x) => ({ id: x.d.id, name: x.d.name, balance: x.bal, rate: x.d.interest_monthly, minPayment: x.d.min_payment }))
  const minTotal = inputs.reduce((a, x) => a + x.minPayment, 0)
  const budget = minTotal + (parseMoney(extra) || 0)
  const monthlyInterest = inputs.reduce((a, x) => a + x.balance * (x.rate / 100), 0)
  const av = useMemo(() => simulatePayoff(inputs, budget, 'avalanche'), [inputs, budget])
  const sn = useMemo(() => simulatePayoff(inputs, budget, 'snowball'), [inputs, budget])
  const chosen = strategy === 'avalanche' ? av : sn
  const nameOf = (id: string) => data.debts.find((d) => d.id === id)
  const series = (r: typeof av) => r.series.slice(0, Math.min(r.series.length, 61))
  const len = Math.max(series(av).length, series(sn).length)
  const pad = (a: number[]) => Array.from({ length: len }, (_, i) => a[i] ?? 0)

  const pay = (d: Debt) => {
    const bal = debtBalance(data, d.id)
    const cat = data.categories.find((c) => c.name === 'Dívidas')?.id ?? null
    open({ kind: 'expense', nature: 'fixed', debt_id: d.id, amount: Math.min(d.min_payment || bal, bal), description: `Pgto ${d.name}`, category_id: cat })
  }
  const settle = (d: Debt) => {
    const future = data.transactions.filter((t) => t.debt_id === d.id && !isDone(t, today) && t.date >= today)
    remove('transactions', future.map((t) => t.id))
    for (const r of data.recurrings.filter((x) => x.debt_id === d.id && x.active)) update('recurrings', r.id, { active: false })
    update('debts', d.id, { status: 'paid', paid_at: today })
    notify(future.length ? `Quitada! ${future.length} parcelas futuras canceladas` : 'Dívida quitada. Foi para o histórico')
  }

  const list = byStatus(current)

  return (
    <>
      <PageTitle title="Dívidas" subtitle="Do que ainda não negociou até o histórico das quitadas"
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nova dívida</button>} />

      {data.debts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          <TintCard color="red" icon="card" label="Total devido" delay={20}><div className="money num font-display kpi-num">{money(total)}</div></TintCard>
          <TintCard color="orange" icon="receipt" label="Parcelas por mês" delay={60}><div className="money num font-display kpi-num">{money(monthly)}</div></TintCard>
          <TintCard color="green" icon="sprout" label="Livre das dívidas" delay={100}>
            <div className="money num font-display kpi-num">{chosen.feasible && chosen.months > 0 ? monthName(chosen.months) : chosen.feasible ? 'Tudo quitado' : 'Precisa pagar mais'}</div>
            {!chosen.feasible && <div className="text-[12.5px] text-ink2 mt-2.5">só os juros somam {money(monthlyInterest)}/mês</div>}
          </TintCard>
          <TintCard color="purple" icon="shield" label="Já quitado (histórico)" delay={140}><div className="money num font-display kpi-num">{money(paidHistory)}</div><div className="text-[12.5px] text-ink2 mt-2.5">{counts.paid} {counts.paid === 1 ? 'dívida' : 'dívidas'}</div></TintCard>
        </div>
      )}

      {data.debts.length === 0 ? (
        <Card><Empty icon="bird" title="Sem dívidas cadastradas">Cadastre o que deve, mesmo sem ter começado a negociar. Depois você negocia, acompanha os pagamentos e guarda as quitadas no histórico.</Empty></Card>
      ) : (
        <>
          <div className="overflow-x-auto no-scrollbar mb-4">
            <Seg<DebtStatus> value={current} onChange={setTab} options={(['open', 'paying', 'paid'] as DebtStatus[]).map((s) => ({ value: s, label: `${DEBT_STATUS[s]} · ${counts[s]}` }))} />
          </div>

          {list.length === 0 ? (
            <Card className="mb-4"><Empty icon={current === 'paid' ? 'shield' : 'check'} title={current === 'open' ? 'Nada a negociar' : current === 'paying' ? 'Nenhuma dívida em pagamento' : 'Nenhuma quitada ainda'}>
              {current === 'paid' ? 'Quando você quitar uma dívida, ela fica aqui como histórico.' : 'Cadastre uma dívida para acompanhar.'}</Empty></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 mb-5">
              {list.map((d, i) => {
                const bal = debtBalance(data, d.id)
                const paidSoFar = d.status === 'paid' ? debtPaidTotal(data, d.id) : Math.max(0, d.balance - bal)
                const ratio = d.status === 'paid' ? 1 : d.balance > 0 ? paidSoFar / d.balance : 0
                const payments = data.transactions.filter((t) => t.debt_id === d.id && t.kind === 'expense' && isDone(t, today) && (d.status === 'paid' || t.date >= d.balance_date)).length
                const next = data.transactions.filter((t) => t.debt_id === d.id && !isDone(t, today)).sort((a, b) => (a.date < b.date ? -1 : 1))[0]
                return (
                  <Card key={d.id} delay={180 + i * 40}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <IconBadge name={d.icon} color={d.color} size={44} />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{d.name}</div>
                          <div className="flex gap-1.5 mt-0.5 flex-wrap">
                            <Tag color="gray">{d.creditor || DEBT_KIND[d.kind]}</Tag>
                            {d.interest_monthly > 0 ? <Tag color={d.interest_monthly > 5 ? 'red' : 'orange'}>{String(d.interest_monthly).replace('.', ',')}% a.m.</Tag> : <Tag color="green">sem juros</Tag>}
                            {d.status === 'paying' && d.due_day && <Tag color="gray">vence dia {d.due_day}</Tag>}
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(d)}>Editar</button>
                    </div>

                    {d.status === 'open' && (
                      <>
                        <div className="mt-4"><div className="text-[12px] text-ink2">Valor da dívida</div><div className="money num font-display text-[28px] leading-none mt-1">{money(bal)}</div></div>
                        {d.note && <div className="text-[13px] text-ink2 mt-2">{d.note}</div>}
                        <div className="flex gap-2 mt-4">
                          <button className="btn btn-primary flex-1" onClick={() => setNegotiate(d)}>Negociar</button>
                          <button className="btn flex-1" onClick={() => pay(d)}>Pagar algo</button>
                        </div>
                      </>
                    )}

                    {d.status === 'paying' && (
                      <>
                        <div className="flex items-baseline justify-between mt-4">
                          <div><div className="text-[12px] text-ink2">Falta pagar</div><div className="money num font-display text-[28px] leading-none mt-1">{money(bal)}</div></div>
                          <div className="text-right"><div className="text-[12px] text-ink2">Parcela</div><div className="money num font-semibold">{money(d.min_payment)}</div></div>
                        </div>
                        <div className="mt-3">
                          <Progress value={ratio} color={d.color} />
                          <div className="flex justify-between text-[12.5px] text-ink2 mt-1.5">
                            <span>{percent(Math.min(ratio, 1))} pago{d.installments_total ? ` · ${Math.min(payments, d.installments_total)} de ${d.installments_total} parcelas` : ` · ${payments} pagamentos`}</span>
                            {next && <span>próxima {fmtDate(next.date)}</span>}
                          </div>
                        </div>
                        {bal <= 0.005 ? (
                          <div className="mt-3 rounded-xl px-3 py-2.5 text-[13.5px] flex items-center justify-between gap-2" style={{ background: 'color-mix(in srgb, var(--c-green) 18%, transparent)' }}>
                            <span>Zerou! Mover para quitadas?</span>
                            <button className="btn btn-sm btn-primary" onClick={() => settle(d)}>Quitar</button>
                          </div>
                        ) : (
                          <div className="flex gap-2 mt-4">
                            <button className="btn flex-1" onClick={() => pay(d)}>Registrar pagamento</button>
                            <ConfirmButton className="btn-sm" onConfirm={() => settle(d)}>Quitar</ConfirmButton>
                          </div>
                        )}
                      </>
                    )}

                    {d.status === 'paid' && (
                      <>
                        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                          {[['Valor original', money(d.original_amount)], ['Total pago', money(paidSoFar)], ['Quitada em', d.paid_at ? fmtDate(d.paid_at, 'dd/MM/yy') : '—']].map(([l, v]) => (
                            <div key={l} className="rounded-xl bg-[var(--field)] py-2"><div className="text-[11px] text-ink2">{l}</div><div className="money num font-semibold text-[13.5px]">{v}</div></div>
                          ))}
                        </div>
                        <div className="text-[12.5px] text-ink2 mt-2">{payments} pagamentos registrados{d.note ? ` · ${d.note}` : ''}</div>
                        <button className="btn btn-sm w-full mt-3" onClick={() => update('debts', d.id, { status: 'paying', paid_at: null, balance_date: today, balance: Math.max(d.balance - paidSoFar, 0) || d.balance })}>Reabrir</button>
                      </>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          {live.length > 0 && (
            <Card delay={300}>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
                <div className="font-semibold text-[16px]">Simulador de quitação</div>
                <Seg<Strategy> value={strategy} onChange={setStrategy} options={[{ value: 'avalanche', label: 'Maior juros primeiro' }, { value: 'snowball', label: 'Menor saldo primeiro' }]} />
              </div>
              <p className="text-ink2 text-[13.5px] mt-0 mb-4">Considera as dívidas a negociar e em pagamento. Paga o mínimo de cada uma e joga o que sobrar na prioritária.</p>
              <div className="grid gap-4 md:grid-cols-[260px_1fr] items-start">
                <div className="flex flex-col gap-3">
                  <Field label="Quanto a mais por mês consigo pagar?"><input className="input" inputMode="decimal" placeholder="0,00" value={extra} onChange={(e) => setExtra(e.target.value)} /></Field>
                  <div className="text-[13px] text-ink2">Total por mês nas dívidas: <b className="money num text-ink">{money(budget)}</b></div>
                  <div className="rounded-2xl bg-[var(--field)] p-3 text-[13px]">
                    {av.feasible && sn.feasible
                      ? av.totalInterest < sn.totalInterest - 1
                        ? <>Maior juros primeiro economiza <b className="money num">{money(sn.totalInterest - av.totalInterest)}</b> em juros. Menor saldo primeiro dá vitórias rápidas: <b>{nameOf(sn.order[0])?.name}</b> some em {monthName(sn.payoffMonth[sn.order[0]])}.</>
                        : <>As duas estratégias dão resultado parecido com esses números.</>
                      : <>Com esse valor, os juros (cerca de <b className="money num">{money(monthlyInterest)}</b> por mês) crescem mais rápido que os pagamentos. Para a dívida parar de crescer, pague <b>mais de {money(monthlyInterest)}</b> por mês no total.</>}
                  </div>
                </div>
                <LineChart height={210} labels={Array.from({ length: len }, (_, i) => (i % 6 === 0 ? monthName(i) : ''))} series={[
                  { name: 'Maior juros primeiro', color: solid('red'), values: pad(series(av)) },
                  { name: 'Menor saldo primeiro', color: solid('blue'), values: pad(series(sn)) },
                ]} />
              </div>
              <hr className="hair my-4" />
              <div className="text-[13px] font-semibold text-ink2 mb-2">Ordem de quitação</div>
              <div className="flex flex-col gap-2">
                {chosen.order.map((id, i) => {
                  const d = nameOf(id)!
                  return (
                    <div key={id} className="flex items-center gap-3 text-[14px]">
                      <span className="h-6 w-6 rounded-full grid place-items-center text-[12px] font-bold text-white" style={{ background: solid(d.color) }}>{i + 1}</span>
                      <span className="flex-1 flex items-center gap-2"><Icon name={d.icon} size={15} className="text-ink2" />{d.name}</span>
                      <span className="text-ink2">quita em <b className="text-ink">{monthName(chosen.payoffMonth[id])}</b></span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}
      {editing && <DebtForm debt={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {negotiate && <NegotiateSheet debt={negotiate} onClose={() => setNegotiate(null)} />}
    </>
  )
}

function NegotiateSheet({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const { data, update, addMany, addRecurring, notify } = useStore()
  const today = todayISO()
  const cat = data.categories.find((c) => c.name === 'Dívidas')?.id ?? null
  const [mode, setMode] = useState<'installments' | 'monthly'>('installments')
  const [total, setTotal] = useState(fmtInput(debt.balance))
  const [n, setN] = useState(12)
  const [monthlyAmount, setMonthlyAmount] = useState(debt.min_payment ? fmtInput(debt.min_payment) : '')
  const [first, setFirst] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'))
  const [where, setWhere] = useState<{ accountId: string | null; cardId: string | null }>({ accountId: data.accounts.find((a) => !a.archived)?.id ?? null, cardId: null })
  const [create, setCreate] = useState(true)
  const [err, setErr] = useState('')
  const totalNum = parseMoney(total)
  const per = totalNum > 0 ? Math.round((totalNum / n) * 100) / 100 : 0

  const save = () => {
    const base = { kind: 'expense' as const, description: debt.name, category_id: cat, nature: 'fixed' as const, debt_id: debt.id, account_id: where.cardId ? null : where.accountId, card_id: where.cardId }
    if (mode === 'installments') {
      if (!(totalNum > 0)) return setErr('Informe o valor negociado')
      const parts = buildInstallments(base, first, totalNum, n, 'total', today)
      if (create) addMany('transactions', parts)
      update('debts', debt.id, { status: 'paying', balance: totalNum, balance_date: first < today ? first : today, min_payment: parts[0].amount, installments_total: n, negotiated_at: today, due_day: parseISO(first).getDate() })
      notify(create ? `Negociada: ${n} parcelas na agenda` : 'Dívida marcada como em pagamento')
    } else {
      const v = parseMoney(monthlyAmount)
      if (!(v > 0)) return setErr('Informe o valor mensal')
      if (create) {
        addRecurring({ kind: 'expense', description: `Pagamento ${debt.name}`, amount: v, variable: false, frequency: 'monthly', interval_n: 1, start_date: first, count: null, end_date: null,
          category_id: cat, source_id: null, nature: 'fixed', goal_id: null, debt_id: debt.id, group_id: null, vault_id: null, account_id: base.account_id, card_id: base.card_id, tags: [], note: '', active: true })
      }
      update('debts', debt.id, { status: 'paying', balance: debt.balance, balance_date: first < today ? first : today, min_payment: v, installments_total: null, negotiated_at: today, due_day: parseISO(first).getDate() })
      notify(create ? 'Pagamento mensal criado até quitar' : 'Dívida marcada como em pagamento')
    }
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={`Negociar: ${debt.name}`} footer={<button className="btn btn-primary" onClick={save}>Confirmar negociação</button>}>
      <div className="flex flex-col gap-4">
        <div className="text-[13.5px] text-ink2">Dívida original: <b className="money num text-ink">{money(debt.balance)}</b>. Informe como ficou o acordo.</div>
        <Seg full value={mode} onChange={setMode} options={[{ value: 'installments', label: 'Parcelas fixas' }, { value: 'monthly', label: 'Todo mês até quitar' }]} />
        {mode === 'installments' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor negociado (R$)"><input className="input" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} /></Field>
              <Field label="Nº de parcelas"><input className="input" type="number" min={1} max={120} value={n} onChange={(e) => setN(Math.max(1, Number(e.target.value) || 1))} /></Field>
            </div>
            {per > 0 && <div className="text-[13.5px]"><b>{n}x de {money(per)}</b>{debt.balance > totalNum && totalNum > 0 && <span className="text-income"> · desconto de {money(debt.balance - totalNum)}</span>}</div>}
          </>
        ) : (
          <Field label="Valor mensal (R$)"><input className="input" inputMode="decimal" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} placeholder="Ex: 250,00" /></Field>
        )}
        <Field label="1º vencimento"><input type="date" className="input" value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
        <WherePicker label="Pago com" accounts={data.accounts} cards={data.cards} accountId={where.accountId} cardId={where.cardId} onPick={setWhere} />
        <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={create} onChange={(e) => setCreate(e.target.checked)} /> Colocar as parcelas na agenda (aparecem em vencimentos e na previsão de saldo)</label>
        {err && <div className="text-[13px] text-expense">{err}</div>}
      </div>
    </Sheet>
  )
}

function DebtForm({ debt, onClose }: { debt?: Debt; onClose: () => void }) {
  const { data, add, update, remove, notify } = useStore()
  const today = todayISO()
  const cur = debt ? debtBalance(data, debt.id) : 0
  const [name, setName] = useState(debt?.name ?? '')
  const [creditor, setCreditor] = useState(debt?.creditor ?? '')
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? 'bank')
  const [status, setStatus] = useState<DebtStatus>(debt?.status ?? 'open')
  const [original, setOriginal] = useState(debt ? fmtInput(debt.original_amount) : '')
  const [balance, setBalance] = useState(debt ? fmtInput(debt.status === 'paid' ? debt.original_amount : cur) : '')
  const [rate, setRate] = useState(debt ? String(debt.interest_monthly).replace('.', ',') : '')
  const [min, setMin] = useState(debt ? fmtInput(debt.min_payment) : '')
  const [due, setDue] = useState(debt?.due_day ? String(debt.due_day) : '')
  const [inst, setInst] = useState(debt?.installments_total ? String(debt.installments_total) : '')
  const [paidAt, setPaidAt] = useState(debt?.paid_at ?? today)
  const [note, setNote] = useState(debt?.note ?? '')
  const [icon, setIcon] = useState(debt?.icon ?? 'card')
  const [color, setColor] = useState<ColorKey>(debt?.color ?? 'red')
  const [err, setErr] = useState('')
  const save = () => {
    const b = parseMoney(balance)
    const o = parseMoney(original) || b
    if (!name.trim()) return setErr('Dê um nome')
    if (status !== 'paid' && !(b >= 0)) return setErr('Informe o saldo devedor')
    const changed = !debt || Math.abs(b - (debt.status === 'paid' ? debt.original_amount : cur)) > 0.004 || status !== debt.status
    const row = {
      name: name.trim(), creditor: creditor.trim(), kind, status, icon, color, original_amount: o || 0, interest_monthly: parseMoney(rate) || 0,
      min_payment: parseMoney(min) || 0, due_day: due ? Math.min(Math.max(parseInt(due, 10), 1), 31) : null, installments_total: inst ? parseInt(inst, 10) : null,
      paid_at: status === 'paid' ? paidAt : null, note: note.trim(),
      ...(changed && status !== 'paid' ? { balance: b || 0, balance_date: today } : {}),
    }
    if (debt) update('debts', debt.id, row)
    else add('debts', { negotiated_at: null, balance: b || o || 0, balance_date: today, ...row })
    notify('Dívida salva')
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={debt ? 'Editar dívida' : 'Nova dívida'}
      footer={<>{debt && <ConfirmButton className="mr-auto" onConfirm={() => { remove('debts', [debt.id]); onClose() }}>Apagar</ConfirmButton>}<button className="btn btn-primary" onClick={save}>Salvar</button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Em que etapa está?">
          <Seg full value={status} onChange={setStatus} options={(['open', 'paying', 'paid'] as DebtStatus[]).map((s) => ({ value: s, label: DEBT_STATUS[s] }))} />
        </Field>
        <Field label="Nome"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cartão do banco, empréstimo da mãe" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quem é o credor?"><input className="input" value={creditor} onChange={(e) => setCreditor(e.target.value)} placeholder="Banco, loja, Mãe…" /></Field>
          <Field label="Tipo">
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as DebtKind)}>
              {(Object.keys(DEBT_KIND) as DebtKind[]).map((k) => <option key={k} value={k}>{DEBT_KIND[k]}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor original (R$)"><input className="input" inputMode="decimal" value={original} onChange={(e) => setOriginal(e.target.value)} placeholder="0,00" /></Field>
          {status !== 'paid' && (
            <Field label={status === 'open' ? 'Saldo devedor hoje (R$)' : 'Falta pagar hoje (R$)'}><input className="input" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0,00" /></Field>
          )}
          {status === 'paid' && <Field label="Quitada em"><input type="date" className="input" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></Field>}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Juros % a.m."><input className="input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" /></Field>
          <Field label="Parcela (R$)"><input className="input" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0,00" /></Field>
          <Field label="Vence dia"><input className="input" type="number" min={1} max={31} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        <Field label="Nº de parcelas (se tiver)"><input className="input" type="number" min={1} value={inst} onChange={(e) => setInst(e.target.value)} /></Field>
        <Field label="Observação"><textarea className="input !h-auto py-2.5" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: ainda não procurei o banco" /></Field>
        {debt && status !== 'paid' && <div className="text-[12px] text-ink2">Ao mudar o saldo, os pagamentos de antes de hoje deixam de ser descontados (use quando o banco informar o saldo atualizado).</div>}
        {err && <div className="text-[13px] text-expense">{err}</div>}
        <Field label="Ícone"><IconPick value={icon} onChange={setIcon} /></Field>
        <Field label="Cor"><ColorPick value={color} onChange={setColor} keys={COLOR_KEYS} /></Field>
      </div>
    </Sheet>
  )
}
