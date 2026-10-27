import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDays, addMonths, endOfMonth, format, getDate, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight, Bell, CalendarClock, Check, CircleAlert, Compass, CreditCard, Equal, Leaf, Sun, TrendingUp } from 'lucide-react'
import { Icon, IconBadge } from '../components/Icon'
import { useName } from '../lib/prefs'
import { useStore } from '../lib/store'
import { useLookup } from '../lib/lookup'
import { buckets, inRange, lastMonths, monthKey, previousRange, todayISO, rangeOf } from '../lib/period'
import { debtBalance, delta, goalSaved, summarize, txIn } from '../lib/stats'
import { accountBalance, allVaultsStats, commitments, projectBalance, totalAvailable } from '../lib/balances'
import { cardKeys, invoiceSummary, invoiceKeyOf } from '../lib/invoices'
import { isDone, txTitle } from '../lib/tx'
import { fmtDate, money, moneyInt, percent } from '../lib/format'
import { solid } from '../lib/colors'
import { BarChart, Donut, LineChart } from '../components/Charts'
import { PeriodBar, usePeriod } from '../components/PeriodBar'
import { useTxSheet } from '../components/TxSheet'
import { Card, Delta, Empty, Money, PageTitle, Progress, Seg, Tag, TintCard } from '../components/ui'
import type { Card as CardT, Transaction } from '../lib/types'

interface DueItem { id: string; date: string; title: string; amount: number; icon: string; color: 'red' | 'purple' | 'orange'; tx?: Transaction; card?: CardT; key?: string }

export default function Dashboard() {
  const { data, demo, loadDemo, update } = useStore()
  const name = useName()
  const nav = useNavigate()
  const { period, range } = usePeriod()
  const { label, groups } = useLookup()
  const { edit, open } = useTxSheet()
  const today = todayISO()
  const [chartMode, setChartMode] = useState<'fluxo' | 'evolucao'>('fluxo')

  const txs = data.transactions
  const cur = useMemo(() => summarize(txIn(txs, range), today), [txs, range, today])
  const prev = useMemo(() => summarize(txIn(txs, previousRange(period)), today), [txs, period, today])

  const flow = useMemo(() => {
    const bs = buckets(period)
    const rows = bs.map((b) => summarize(txIn(txs, b), today))
    return {
      labels: bs.map((b) => b.label),
      series: [
        { name: 'Recebido', color: solid('green'), values: rows.map((r) => r.income) },
        { name: 'Gasto', color: solid('red'), values: rows.map((r) => r.expense) },
        { name: 'Investido', color: solid('purple'), values: rows.map((r) => r.investment) },
      ],
    }
  }, [txs, period, today])

  const evolution = useMemo(() => {
    const ms = lastMonths(range.end, 12)
    const before = summarize(txs.filter((t) => t.date < ms[0].start), today)
    let saldo = before.left
    let invest = before.investment
    const saldoV: number[] = []
    const invV: number[] = []
    for (const m of ms) {
      const s = summarize(txIn(txs, m), today)
      saldo += s.left
      invest += s.investment
      saldoV.push(saldo)
      invV.push(invest)
    }
    return {
      labels: ms.map((m) => m.label),
      series: [
        { name: 'Sobra acumulada', color: solid('green'), values: saldoV },
        { name: 'Investido acumulado', color: solid('purple'), values: invV },
      ],
    }
  }, [txs, range.end, today])

  const rank = (kind: 'expense' | 'income', key: (t: Transaction) => string | null, meta: (t: Transaction) => { name: string; icon: string; color: string }) => {
    const m = new Map<string, { name: string; icon: string; color: string; value: number }>()
    for (const t of txIn(txs, range)) {
      if (t.kind !== kind || !isDone(t, today)) continue
      const k = key(t) ?? '_'
      const e = m.get(k) ?? { ...meta(t), value: 0 }
      e.value += t.amount
      m.set(k, e)
    }
    return [...m.values()].sort((a, b) => b.value - a.value)
  }
  const byCategory = useMemo(() => {
    const all = rank('expense', (t) => t.category_id, (t) => { const l = label(t); return { name: l.name, icon: l.icon, color: solid(l.color) } })
    const top = all.slice(0, 6)
    const rest = all.slice(6).reduce((a, b) => a + b.value, 0)
    if (rest > 0) top.push({ name: 'Outras', icon: 'circle', color: solid('gray'), value: rest })
    return top
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, range, label, today])
  const bySource = useMemo(() => rank('income', (t) => t.source_id, (t) => { const l = label(t); return { name: l.name, icon: l.icon, color: solid(l.color) } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txs, range, label, today])
  const byGroup = useMemo(() => rank('expense', (t) => t.group_id, (t) => {
    const g = t.group_id ? groups.get(t.group_id) : null
    return g ? { name: g.name, icon: g.icon, color: solid(g.color) } : { name: 'Sem grupo', icon: 'circle', color: solid('gray') }
  }), // eslint-disable-next-line react-hooks/exhaustive-deps
  [txs, range, groups, today])

  // a pagar: lancamentos pendentes (fora do cartao) + faturas ate 30 dias
  const dues = useMemo(() => {
    const out: DueItem[] = []
    for (const t of txs) {
      if (isDone(t, today) || t.kind === 'income' || t.kind === 'yield' || t.kind === 'redeem' || t.kind === 'transfer') continue
      if (t.kind === 'expense' && t.card_id) continue
      const l = label(t)
      out.push({ id: t.id, date: t.date, title: txTitle(t), amount: t.amount, icon: l.icon, color: t.debt_id ? 'orange' : 'red', tx: t })
    }
    const lim = format(addDays(new Date(), 30), 'yyyy-MM-dd')
    for (const c of data.cards.filter((x) => !x.archived)) {
      for (const key of cardKeys(data, c, today)) {
        const s = invoiceSummary(data, c, key, today)
        if (s.remaining <= 0.004 || s.due > lim) continue
        out.push({ id: `inv-${c.id}-${key}`, date: s.due, title: `Fatura ${c.name}`, amount: s.remaining, icon: c.icon, color: 'purple', card: c, key })
      }
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 6)
  }, [txs, data, today, label])
  const recent = useMemo(
    () => txIn(txs, range).filter((t) => isDone(t, today) && t.kind !== 'yield').sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6),
    [txs, range, today],
  )

  const accounts = data.accounts.filter((a) => !a.archived)
  const cards = data.cards.filter((c) => !c.archived)
  const vaults = useMemo(() => allVaultsStats(data, today), [data, today])
  const total = totalAvailable(data, today)
  const commit = useMemo(() => commitments(data, today, 6), [data, today])
  const empty = txs.length === 0
  const totalCat = byCategory.reduce((a, b) => a + b.value, 0)
  const totalGroup = byGroup.reduce((a, b) => a + b.value, 0)
  const [hoverCat, setHoverCat] = useState<number | null>(null)
  const activeDebts = data.debts.filter((d) => d.status !== 'paid')
  const totalDebt = activeDebts.reduce((a, d) => a + debtBalance(data, d.id), 0)

  const payInvoice = (c: CardT, key: string, amount: number) =>
    open({ kind: 'transfer', card_id: c.id, invoice_month: key, amount, date: today, paid: true, account_id: c.pay_account_id ?? accounts[0]?.id ?? null, description: `Fatura ${c.name}` })

  return (
    <>
      <PageTitle title={name ? `Oi, ${name}` : 'Visão geral'} subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })} />
      <PeriodBar />

      {empty && (
        <Card className="mb-4">
          <Empty icon="sprout" title="Vamos começar">
            Adicione seu primeiro lançamento com o botão <b>+</b>, ou cadastre suas contas, cartões e despesas fixas.
            {demo && <div className="mt-3"><button className="btn btn-primary" onClick={() => void loadDemo()}>Carregar dados de exemplo</button></div>}
            <div className="mt-3"><button className="btn" onClick={() => open()}>Novo lançamento</button></div>
          </Empty>
        </Card>
      )}

      {!empty && <Insights />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi icon="trend" title="Recebido" value={cur.income} d={delta(cur.income, prev.income)} color="green" delay={40}
          foot={cur.pendingIncome > 0 ? `${money(cur.pendingIncome)} ainda a receber` : 'tudo recebido'} />
        <Kpi icon="card" title="Gasto" value={cur.expense} d={delta(cur.expense, prev.expense)} invert color="red" delay={80}
          foot={cur.income > 0 ? `${percent(cur.expense / cur.income)} do que recebeu` : undefined} />
        <Kpi icon="piggy" title="Investido" value={cur.investment} d={delta(cur.investment, prev.investment)} color="purple" delay={120}
          foot={cur.yield ? `+ ${money(cur.yield)} de rendimento` : cur.income > 0 ? `${percent(cur.investment / cur.income)} da renda` : undefined} />
        <Kpi icon="wallet" title="Sobrou" value={cur.left} d={delta(cur.left, prev.left)} color={cur.left >= 0 ? 'yellow' : 'red'} delay={160} strong
          foot={cur.pendingExpense > 0 ? `${money(cur.pendingExpense)} ainda a pagar` : 'tudo em dia'} />
      </div>

      {!empty && (
        <div className="grid gap-4 lg:grid-cols-3 mb-4">
          <Card delay={180}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-[16px]">Minhas contas</div>
              <Link to="/contas" className="text-[13px] text-accent no-underline flex items-center gap-1">abrir <ArrowRight size={13} /></Link>
            </div>
            <div className="money num font-display text-[30px] leading-none mb-3">{money(total)}</div>
            <div className="flex flex-col gap-1">
              {accounts.length === 0 ? <div className="text-ink2 text-sm">Cadastre suas contas em Contas e cartões.</div> : accounts.map((a) => {
                const b = accountBalance(data, a, today)
                return (
                  <button key={a.id} onClick={() => nav(`/lancamentos?conta=${a.id}`)} className="flex items-center gap-3 py-1.5 bg-transparent border-0 text-left">
                    <IconBadge name={a.icon} color={a.color} size={32} />
                    <span className="flex-1 truncate text-[14px]">{a.name}</span>
                    <Money v={b} className="text-[14px] font-semibold" />
                  </button>
                )
              })}
            </div>
          </Card>

          <Card delay={200}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-[16px]">Cartões</div>
              <Link to="/contas" className="text-[13px] text-accent no-underline flex items-center gap-1">faturas <ArrowRight size={13} /></Link>
            </div>
            {cards.length === 0 ? <div className="text-ink2 text-sm">Cadastre seus cartões para acompanhar fatura e limite.</div> : (
              <div className="flex flex-col gap-4">
                {cards.map((c) => {
                  const s = invoiceSummary(data, c, invoiceKeyOf(c, today), today)
                  return (
                    <div key={c.id}>
                      <div className="flex items-center gap-3">
                        <IconBadge name={c.icon} color={c.color} size={32} />
                        <span className="flex-1 min-w-0"><span className="block truncate text-[14px] font-medium">{c.name}</span><span className="text-[12px] text-ink2">vence {fmtDate(s.due)}</span></span>
                        <Money v={s.total} className="text-[15px] font-semibold" />
                      </div>
                      <div className="mt-1.5"><Progress value={c.limit_amount ? s.total / c.limit_amount : 0} color={c.color} /></div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card delay={220}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-[16px]">Caixinhas</div>
              <Link to="/caixinhas" className="text-[13px] text-accent no-underline flex items-center gap-1">abrir <ArrowRight size={13} /></Link>
            </div>
            {vaults.list.length === 0 ? <div className="text-ink2 text-sm">Crie caixinhas para ver quanto guardou e rendeu.</div> : (
              <>
                <div className="money num font-display text-[30px] leading-none">{money(vaults.balance)}</div>
                <div className="grid grid-cols-2 gap-2 mt-3 mb-3 text-[13px]">
                  <div className="rounded-xl bg-[var(--field)] px-3 py-2"><div className="text-ink2 text-[11.5px]">Investido</div><div className="money num font-semibold">{moneyInt(vaults.netInvested)}</div></div>
                  <div className="rounded-xl px-3 py-2" style={{ background: 'color-mix(in srgb, var(--c-green) 16%, transparent)' }}><div className="text-ink2 text-[11.5px]">Rendimento</div><div className="money num font-semibold">{moneyInt(vaults.yields)}</div></div>
                </div>
                {vaults.list.slice(0, 3).map((s) => (
                  <div key={s.vault.id} className="flex items-center gap-2 py-1 text-[13.5px]"><Icon name={s.vault.icon} size={15} className="text-ink2" /><span className="flex-1 truncate">{s.vault.name}</span><Money v={s.balance} className="font-medium" /></div>
                ))}
              </>
            )}
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card className="lg:col-span-2" delay={240}>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="font-semibold text-[16px]">{chartMode === 'fluxo' ? 'Entradas e saídas' : 'Evolução em 12 meses'}</div>
            <Seg value={chartMode} onChange={setChartMode} options={[{ value: 'fluxo', label: 'Fluxo' }, { value: 'evolucao', label: 'Evolução' }]} />
          </div>
          {chartMode === 'fluxo' ? <BarChart labels={flow.labels} series={flow.series} height={290} /> : <LineChart labels={evolution.labels} series={evolution.series} height={290} />}
          <Legend items={(chartMode === 'fluxo' ? flow : evolution).series.map((s) => ({ name: s.name, color: s.color }))} />
        </Card>

        <Card delay={260}>
          <div className="font-semibold text-[16px] mb-3">Para onde foi</div>
          {byCategory.length === 0 ? <Empty icon="leaf" title="Sem gastos no período" /> : (
            <div className="flex flex-col items-center gap-4">
              <Donut size={168} thickness={20} slices={byCategory.map((c) => ({ label: c.name, value: c.value, color: c.color }))} onHover={setHoverCat}>
                <div>
                  <div className="text-[12px] text-ink2">{hoverCat !== null ? byCategory[hoverCat].name : 'Total gasto'}</div>
                  <div className="money num text-[18px] font-bold">{money(hoverCat !== null ? byCategory[hoverCat].value : totalCat)}</div>
                </div>
              </Donut>
              <div className="w-full flex flex-col gap-1.5">
                {byCategory.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2 text-[13.5px]" style={{ opacity: hoverCat === null || hoverCat === i ? 1 : 0.5 }}>
                    <i className="dot" style={{ background: c.color }} />
                    <span className="flex-1 truncate flex items-center gap-2"><Icon name={c.icon} size={15} className="text-ink2 shrink-0" />{c.name}</span>
                    <span className="text-ink2 num">{percent(c.value / totalCat)}</span>
                    <span className="money num font-medium w-[88px] text-right">{money(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card className="lg:col-span-2" delay={280}>
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div className="font-semibold text-[16px]">Já comprometido nos próximos meses</div>
            <Link to="/agenda" className="text-[13px] text-accent no-underline flex items-center gap-1">previsão de saldo <ArrowRight size={13} /></Link>
          </div>
          <div className="text-[12.5px] text-ink2 mb-3">Parcelas, fixos e contas já agendadas. Quanto do seu mês futuro já tem dono.</div>
          <BarChart height={220} labels={commit.map((c) => c.label)} series={[
            { name: 'Parcelas', color: solid('purple'), values: commit.map((c) => c.installments) },
            { name: 'Fixos', color: solid('blue'), values: commit.map((c) => c.recurring) },
            { name: 'Outros', color: solid('orange'), values: commit.map((c) => c.other) },
          ]} />
          <Legend items={[{ name: 'Parcelas', color: solid('purple') }, { name: 'Fixos', color: solid('blue') }, { name: 'Outros agendados', color: solid('orange') }]} />
        </Card>

        <Card delay={300}>
          <div className="font-semibold text-[16px] mb-3">Por grupo</div>
          {byGroup.length === 0 || totalGroup === 0 ? <Empty icon="users" title="Sem gastos no período">Marque os lançamentos com grupos (Casa, Minhas, Lucas…) para ver aqui.</Empty> : (
            <div className="flex flex-col gap-3.5">
              {byGroup.map((g) => (
                <div key={g.name}>
                  <div className="flex justify-between text-[13.5px] mb-1.5">
                    <span className="flex items-center gap-2"><Icon name={g.icon} size={15} className="text-ink2" />{g.name}</span>
                    <span><span className="text-ink2 num mr-2">{percent(g.value / totalGroup)}</span><span className="money num font-medium">{money(g.value)}</span></span>
                  </div>
                  <div className="progress"><i style={{ width: `${(g.value / totalGroup) * 100}%`, background: g.color }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card delay={320}>
          <div className="font-semibold text-[16px] mb-3">De onde veio</div>
          {bySource.length === 0 ? <Empty icon="wallet" title="Nenhuma receita no período" /> : (
            <div className="flex flex-col gap-3">
              {bySource.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-[13.5px] mb-1.5">
                    <span className="flex items-center gap-2"><Icon name={s.icon} size={15} className="text-ink2" />{s.name}</span>
                    <span className="money num font-medium">{money(s.value)}</span>
                  </div>
                  <div className="progress"><i style={{ width: `${(s.value / cur.income) * 100}%`, background: s.color }} /></div>
                </div>
              ))}
            </div>
          )}
          <hr className="hair my-4" />
          <div className="text-[13px] text-ink2 mb-2">Fixas × variáveis</div>
          {cur.expense > 0 ? (
            <>
              <div className="flex h-3 rounded-full overflow-hidden gap-[3px]">
                <i style={{ width: `${(cur.fixed / cur.expense) * 100}%`, background: solid('purple') }} className="rounded-full" />
                <i style={{ width: `${(cur.variable / cur.expense) * 100}%`, background: solid('orange') }} className="rounded-full" />
              </div>
              <div className="flex justify-between text-[13px] mt-2">
                <span><i className="dot mr-1.5" style={{ background: solid('purple') }} />Fixas <b className="money num">{moneyInt(cur.fixed)}</b></span>
                <span><i className="dot mr-1.5" style={{ background: solid('orange') }} />Variáveis <b className="money num">{moneyInt(cur.variable)}</b></span>
              </div>
            </>
          ) : <div className="text-ink3 text-sm">—</div>}
        </Card>

        <Card delay={340}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[16px]">A pagar</div>
            <Link to="/agenda" className="text-[13px] text-accent no-underline flex items-center gap-1">agenda <ArrowRight size={13} /></Link>
          </div>
          {dues.length === 0 ? <Empty icon="check" title="Nada pendente" /> : (
            <div className="flex flex-col">
              {dues.map((d) => (
                <div key={d.id} className="flex items-center gap-3 py-2.5 border-b border-hair last:border-0">
                  {d.tx ? (
                    <button aria-label="Marcar como pago" onClick={() => update('transactions', d.tx!.id, { paid: true })} className="h-6 w-6 rounded-full border-2 border-[var(--ink-3)] grid place-items-center bg-transparent hover:border-[var(--c-green)] hover:text-[var(--c-green)] text-transparent p-0 shrink-0"><Check size={13} strokeWidth={3} /></button>
                  ) : <span className="h-6 w-6 grid place-items-center text-ink3 shrink-0"><CreditCard size={16} /></span>}
                  <button onClick={() => (d.tx ? edit(d.tx) : d.card && d.key && payInvoice(d.card, d.key, d.amount))} className="flex-1 min-w-0 flex items-center gap-3 bg-transparent border-0 p-0 text-left">
                    <IconBadge name={d.icon} color={d.color} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium">{d.title}</span>
                      <span className="block text-[12.5px]" style={{ color: d.date < today ? 'var(--c-red)' : undefined }}>{d.date < today ? 'atrasado · ' : ''}{fmtDate(d.date)}</span>
                    </span>
                    <Money v={-d.amount} sign className="text-[14.5px] font-semibold" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card delay={360}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[16px]">Metas e dívidas</div>
            <Link to="/metas" className="text-[13px] text-accent no-underline flex items-center gap-1">abrir <ArrowRight size={13} /></Link>
          </div>
          {data.goals.length === 0 && activeDebts.length === 0 ? <Empty icon="target" title="Sem metas ainda">Crie uma meta pra acompanhar seus aportes.</Empty> : (
            <div className="flex flex-col gap-3.5">
              {data.goals.slice(0, 3).map((g) => {
                const saved = goalSaved(data, g.id)
                return (
                  <div key={g.id}>
                    <div className="flex justify-between text-[13.5px] mb-1.5">
                      <span className="flex items-center gap-2"><Icon name={g.icon} size={15} className="text-ink2" />{g.name}</span>
                      <span className="text-ink2 num">{percent(Math.min(saved / g.target, 1))}</span>
                    </div>
                    <Progress value={saved / g.target} color={g.color} />
                  </div>
                )
              })}
              {activeDebts.length > 0 && (
                <Link to="/dividas" className="no-underline text-ink flex items-center justify-between rounded-2xl bg-[var(--field)] px-3.5 py-3 mt-1">
                  <span className="text-[13.5px] flex items-center gap-2"><Icon name="card" size={15} className="text-ink2" />Dívidas em aberto</span>
                  <span className="money num font-semibold">{money(totalDebt)}</span>
                </Link>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card delay={400}>
        <div className="font-semibold text-[16px] mb-1">Últimos lançamentos</div>
        {recent.length === 0 ? <Empty icon="pen" title="Nada por aqui" /> : (
          <div className="flex flex-col">
            {recent.map((t) => {
              const l = label(t)
              const signedAmt = t.kind === 'income' || t.kind === 'redeem' ? t.amount : t.kind === 'transfer' ? t.amount : -t.amount
              return (
                <button key={t.id} onClick={() => edit(t)} className="flex items-center gap-3 py-2.5 border-0 border-b border-hair last:border-0 bg-transparent text-left">
                  <IconBadge name={l.icon} color={l.color} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{txTitle(t)}</span>
                    <span className="block text-[12.5px] text-ink2">{fmtDate(t.date)} · {l.name}</span>
                  </span>
                  <Money v={signedAmt} sign={t.kind !== 'transfer'} className={`text-[14.5px] font-semibold ${t.kind === 'income' || t.kind === 'redeem' ? 'text-income' : t.kind === 'investment' ? 'text-invest' : ''}`} />
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </>
  )
}

function Kpi({ title, value, d, color, icon, foot, invert, strong, delay }: {
  title: string; value: number; d: number | null; color: 'green' | 'red' | 'blue' | 'purple' | 'yellow'; icon: string; foot?: string; invert?: boolean; strong?: boolean; delay: number
}) {
  return (
    <TintCard color={color} label={title} icon={icon} delay={delay} right={<Delta value={d} invert={invert} />}>
      <div className={`money num font-display kpi-num ${strong ? 'strong' : ''}`}>{money(value)}</div>
      {foot && <div className="text-[12.5px] text-ink2 mt-2.5">{foot}</div>}
    </TintCard>
  )
}

function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex gap-4 flex-wrap mt-2 text-[12.5px] text-ink2">
      {items.map((i) => <span key={i.name} className="flex items-center gap-1.5"><i className="dot" style={{ background: i.color }} />{i.name}</span>)}
    </div>
  )
}

/** "Como estou?": leituras do mes atual em linguagem simples. */
function Insights() {
  const { data, hidden } = useStore()
  const lines = useMemo(() => {
    const today = todayISO()
    const ym = monthKey(today)
    const daysIn = getDate(endOfMonth(parseISO(today)))
    const day = getDate(parseISO(today))
    const daysLeft = daysIn - day + 1
    const month = data.transactions.filter((t) => monthKey(t.date) === ym)
    const s = summarize(month, today)
    const out: { icon: React.ReactNode; text: React.ReactNode; tone: 'good' | 'warn' | 'bad' | 'info' }[] = []

    // saldo previsto negativo (o aviso mais importante)
    if (data.accounts.some((a) => !a.archived)) {
      const p = projectBalance(data, today, 45)
      if (p.firstNegative) out.push({ icon: <CircleAlert size={17} />, tone: 'bad', text: <>Atenção: pelo que está agendado, seu saldo pode <b>ficar negativo em {fmtDate(p.firstNegative.date)}</b> (até <b className="money">{money(p.min.balance)}</b>). Veja a previsão na Agenda.</> })
    }
    // faturas perto de vencer
    for (const c of data.cards.filter((x) => !x.archived)) {
      for (const key of cardKeys(data, c, today)) {
        const inv = invoiceSummary(data, c, key, today)
        if (inv.remaining <= 0.004) continue
        const inDays = Math.round((parseISO(inv.due).getTime() - parseISO(today).getTime()) / 86400000)
        if (inDays <= 7) out.push({ icon: <CreditCard size={17} />, tone: inDays < 0 ? 'bad' : 'warn', text: <>A fatura do <b>{c.name}</b> ({`${inDays < 0 ? 'venceu' : inDays === 0 ? 'vence hoje' : `vence em ${inDays} ${inDays === 1 ? 'dia' : 'dias'}`}`}): <b className="money">{money(inv.remaining)}</b>.</> })
      }
    }

    // ritmo dos gastos variaveis vs. media dos ultimos 3 meses (mesma janela de dias)
    let avg = 0
    let counted = 0
    for (let i = 1; i <= 3; i++) {
      const r = rangeOf({ gran: 'month', anchor: format(addMonths(parseISO(today), -i), 'yyyy-MM-dd') })
      const upTo = `${r.start.slice(0, 8)}${String(day).padStart(2, '0')}`
      const spent = data.transactions
        .filter((t) => t.kind === 'expense' && isDone(t, today) && t.nature !== 'fixed' && !t.debt_id && !t.installment_total && t.date >= r.start && t.date <= upTo)
        .reduce((a, t) => a + t.amount, 0)
      if (spent > 0) { avg += spent; counted++ }
    }
    avg = counted ? avg / counted : 0
    const varSoFar = month.filter((t) => t.kind === 'expense' && isDone(t, today) && t.nature !== 'fixed' && !t.debt_id && !t.installment_total).reduce((a, t) => a + t.amount, 0)
    if (avg > 100) {
      const ratio = varSoFar / avg - 1
      if (ratio > 0.1) out.push({ icon: <TrendingUp size={17} />, tone: 'warn', text: <>Seus gastos variáveis estão <b>{percent(ratio)} acima</b> do seu ritmo normal para este ponto do mês.</> })
      else if (ratio < -0.1) out.push({ icon: <Leaf size={17} />, tone: 'good', text: <>Você está gastando <b>{percent(-ratio)} menos</b> que o seu normal. Segue assim!</> })
      else out.push({ icon: <Equal size={17} />, tone: 'info', text: <>Seus gastos variáveis estão <b>no ritmo de sempre</b>.</> })
    }

    // quanto posso gastar por dia
    const expectedIncome = s.income + s.pendingIncome
    const fixedAll = month.filter((t) => t.kind === 'expense' && (t.nature === 'fixed' || t.debt_id || t.installment_total)).reduce((a, t) => a + t.amount, 0)
    const investAll = month.filter((t) => t.kind === 'investment').reduce((a, t) => a + t.amount, 0)
    const varAll = month.filter((t) => t.kind === 'expense' && t.nature !== 'fixed' && !t.debt_id && !t.installment_total).reduce((a, t) => a + t.amount, 0)
    if (expectedIncome > 0) {
      const free = expectedIncome - fixedAll - investAll - varAll
      const perDay = free / daysLeft
      if (free > 0) out.push({ icon: <Sun size={17} />, tone: 'good', text: <>Depois de fixas, parcelas e aportes, dá pra gastar cerca de <b className="money">{money(perDay)} por dia</b> até o fim do mês.</> })
      else out.push({ icon: <CircleAlert size={17} />, tone: 'bad', text: <>Pelo que já foi lançado, o mês passa <b className="money">{money(-free)}</b> da sua renda. Vale segurar os gastos variáveis.</> })
      const pace = day > 0 ? varSoFar / day : 0
      const projVar = Math.max(varAll, pace * daysIn)
      const projLeft = expectedIncome - fixedAll - investAll - projVar
      if (day >= 5) out.push({ icon: projLeft >= 0 ? <Compass size={17} /> : <CircleAlert size={17} />, tone: projLeft >= 0 ? 'info' : 'warn', text: <>No ritmo atual, o mês fecha {projLeft >= 0 ? 'com sobra de' : 'faltando'} <b className="money">{money(Math.abs(projLeft))}</b>.</> })
    }

    // vencimentos proximos (fora do cartao)
    const in7 = format(addDays(parseISO(today), 7), 'yyyy-MM-dd')
    const soon = data.transactions.filter((t) => !isDone(t, today) && (t.kind === 'expense' && !t.card_id) && inRange(t.date, { start: '0000-00-00', end: in7 }))
    if (soon.length) {
      const total = soon.reduce((a, t) => a + t.amount, 0)
      const late = soon.filter((t) => t.date < today).length
      out.push({ icon: late ? <Bell size={17} /> : <CalendarClock size={17} />, tone: late ? 'bad' : 'info', text: <>{late ? <><b>{late} em atraso</b> e </> : null}<b>{soon.length} {soon.length === 1 ? 'conta' : 'contas'}</b> a pagar nos próximos 7 dias: <b className="money">{money(total)}</b>.</> })
    }
    return out.slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, hidden])

  if (!lines.length) return null
  const tones = { good: 'green', warn: 'orange', bad: 'red', info: 'blue' } as const
  return (
    <Card className="mb-4" delay={0}>
      <div className="flex items-center gap-2 mb-3">
        <div className="font-semibold text-[16px]">Como você está este mês</div>
        <Tag color="purple" className="hidden sm:inline-flex">em linguagem simples</Tag>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {lines.map((l, i) => (
          <div key={i} className="flex gap-3 items-start rounded-2xl px-3.5 py-3 text-[14px] leading-snug"
            style={{ background: `color-mix(in srgb, ${solid(tones[l.tone])} 12%, transparent)` }}>
            <span className="mt-[1px] grid place-items-center h-7 w-7 rounded-full shrink-0" style={{ background: `color-mix(in srgb, ${solid(tones[l.tone])} 30%, transparent)`, color: `color-mix(in srgb, ${solid(tones[l.tone])} 75%, var(--ink))` }}>{l.icon}</span>
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
