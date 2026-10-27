import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, addMonths, endOfMonth, format, getDate, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight, Bell, CalendarClock, Check, CircleAlert, Compass, Leaf, Sun, TrendingUp, Equal } from 'lucide-react'
import { Icon, IconBadge } from '../components/Icon'
import { useName } from '../lib/prefs'
import { useStore } from '../lib/store'
import { useLookup } from '../lib/lookup'
import { buckets, inRange, lastMonths, monthKey, previousRange, todayISO, rangeOf } from '../lib/period'
import { debtBalance, delta, goalSaved, summarize, txIn } from '../lib/stats'
import { fmtDate, money, moneyInt, percent } from '../lib/format'
import { solid } from '../lib/colors'
import { BarChart, Donut, LineChart } from '../components/Charts'
import { PeriodBar, usePeriod } from '../components/PeriodBar'
import { useTxSheet } from '../components/TxSheet'
import { Card, Delta, Empty, Money, PageTitle, Progress, Seg, Tag } from '../components/ui'
import type { Transaction } from '../lib/types'

export default function Dashboard() {
  const { data, demo, loadDemo } = useStore()
  const name = useName()
  const { period, range } = usePeriod()
  const { label } = useLookup()
  const { edit, open } = useTxSheet()
  const { update } = useStore()
  const [chartMode, setChartMode] = useState<'fluxo' | 'evolucao'>('fluxo')

  const txs = data.transactions
  const cur = useMemo(() => summarize(txIn(txs, range)), [txs, range])
  const prev = useMemo(() => summarize(txIn(txs, previousRange(period))), [txs, period])

  const flow = useMemo(() => {
    const bs = buckets(period)
    const rows = bs.map((b) => summarize(txIn(txs, b)))
    return {
      labels: bs.map((b) => b.label),
      series: [
        { name: 'Recebido', color: solid('green'), values: rows.map((r) => r.income) },
        { name: 'Gasto', color: solid('red'), values: rows.map((r) => r.expense) },
        { name: 'Investido', color: solid('purple'), values: rows.map((r) => r.investment) },
      ],
    }
  }, [txs, period])

  const evolution = useMemo(() => {
    const ms = lastMonths(range.end, 12)
    const before = summarize(txs.filter((t) => t.date < ms[0].start))
    let saldo = before.left
    let invest = before.investment
    const saldoV: number[] = []
    const invV: number[] = []
    for (const m of ms) {
      const s = summarize(txIn(txs, m))
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
  }, [txs, range.end])

  const byCategory = useMemo(() => {
    const m = new Map<string, { name: string; icon: string; color: string; value: number }>()
    for (const t of txIn(txs, range)) {
      if (t.kind !== 'expense' || !t.paid) continue
      const l = label(t)
      const k = t.category_id ?? '_'
      const e = m.get(k) ?? { name: l.name, icon: l.icon, color: solid(l.color), value: 0 }
      e.value += t.amount
      m.set(k, e)
    }
    const all = [...m.values()].sort((a, b) => b.value - a.value)
    const top = all.slice(0, 6)
    const rest = all.slice(6).reduce((a, b) => a + b.value, 0)
    if (rest > 0) top.push({ name: 'Outras', icon: 'circle', color: solid('gray'), value: rest })
    return top
  }, [txs, range, label])

  const bySource = useMemo(() => {
    const m = new Map<string, { name: string; icon: string; color: string; value: number }>()
    for (const t of txIn(txs, range)) {
      if (t.kind !== 'income' || !t.paid) continue
      const l = label(t)
      const k = t.source_id ?? '_'
      const e = m.get(k) ?? { name: l.name, icon: l.icon, color: solid(l.color), value: 0 }
      e.value += t.amount
      m.set(k, e)
    }
    return [...m.values()].sort((a, b) => b.value - a.value)
  }, [txs, range, label])

  const upcoming = useMemo(
    () => txs.filter((t) => !t.paid && t.kind !== 'income').sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 6),
    [txs],
  )
  const recent = useMemo(
    () => txIn(txs, range).filter((t) => t.paid).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6),
    [txs, range],
  )

  const empty = txs.length === 0
  const totalCat = byCategory.reduce((a, b) => a + b.value, 0)
  const [hoverCat, setHoverCat] = useState<number | null>(null)
  const totalDebt = data.debts.reduce((a, d) => a + debtBalance(data, d.id), 0)

  return (
    <>
      <PageTitle title={name ? `Oi, ${name}` : 'Visão geral'} subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })} />
      <PeriodBar />

      {empty && (
        <Card className="mb-4">
          <Empty icon="sprout" title="Vamos começar">
            Adicione seu primeiro lançamento com o botão <b>+</b>, ou cadastre suas despesas fixas em Planejamento.
            {demo && (
              <div className="mt-3"><button className="btn btn-primary" onClick={() => void loadDemo()}>Carregar dados de exemplo</button></div>
            )}
            <div className="mt-3"><button className="btn" onClick={() => open()}>Novo lançamento</button></div>
          </Empty>
        </Card>
      )}

      {!empty && <Insights />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi title="Recebido" value={cur.income} d={delta(cur.income, prev.income)} color="green" delay={40}
          foot={cur.pendingIncome > 0 ? `${money(cur.pendingIncome)} ainda a receber` : 'tudo recebido'} />
        <Kpi title="Gasto" value={cur.expense} d={delta(cur.expense, prev.expense)} invert color="red" delay={80}
          foot={cur.income > 0 ? `${percent(cur.expense / cur.income)} do que recebeu` : undefined} />
        <Kpi title="Investido" value={cur.investment} d={delta(cur.investment, prev.investment)} color="purple" delay={120}
          foot={cur.income > 0 ? `${percent(cur.investment / cur.income)} da renda` : undefined} />
        <Kpi title="Sobrou" value={cur.left} d={delta(cur.left, prev.left)} color={cur.left >= 0 ? 'blue' : 'red'} delay={160} strong
          foot={cur.pendingExpense > 0 ? `${money(cur.pendingExpense)} ainda a pagar` : 'tudo em dia'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card className="lg:col-span-2" delay={200}>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="font-semibold text-[16px]">{chartMode === 'fluxo' ? 'Entradas e saídas' : 'Evolução em 12 meses'}</div>
            <Seg value={chartMode} onChange={setChartMode} options={[{ value: 'fluxo', label: 'Fluxo' }, { value: 'evolucao', label: 'Evolução' }]} />
          </div>
          {chartMode === 'fluxo' ? <BarChart labels={flow.labels} series={flow.series} height={300} /> : <LineChart labels={evolution.labels} series={evolution.series} height={300} />}
          <Legend items={(chartMode === 'fluxo' ? flow : evolution).series.map((s) => ({ name: s.name, color: s.color }))} />
        </Card>

        <Card delay={240}>
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
        <Card delay={280}>
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

        <Card delay={320}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[16px]">A pagar</div>
            <Link to="/lancamentos" className="text-[13px] text-accent no-underline flex items-center gap-1">ver tudo <ArrowRight size={13} /></Link>
          </div>
          {upcoming.length === 0 ? <Empty icon="check" title="Nada pendente" /> : (
            <div className="flex flex-col">
              {upcoming.map((t) => <TxRow key={t.id} t={t} onOpen={() => edit(t)} onToggle={() => update('transactions', t.id, { paid: true })} />)}
            </div>
          )}
        </Card>

        <Card delay={360}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[16px]">Metas e dívidas</div>
            <Link to="/metas" className="text-[13px] text-accent no-underline flex items-center gap-1">abrir <ArrowRight size={13} /></Link>
          </div>
          {data.goals.length === 0 && data.debts.length === 0 ? <Empty icon="target" title="Sem metas ainda">Crie uma meta pra acompanhar seus aportes.</Empty> : (
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
              {data.debts.length > 0 && (
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
            {recent.map((t) => <TxRow key={t.id} t={t} onOpen={() => edit(t)} />)}
          </div>
        )}
      </Card>
    </>
  )

  function TxRow({ t, onOpen, onToggle }: { t: Transaction; onOpen: () => void; onToggle?: () => void }) {
    const l = label(t)
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-hair last:border-0">
        {onToggle && (
          <button aria-label="Marcar como pago" onClick={onToggle} className="h-6 w-6 rounded-full border-2 border-[var(--ink-3)] grid place-items-center bg-transparent hover:border-[var(--c-green)] hover:text-[var(--c-green)] text-transparent p-0 shrink-0">
            <Check size={13} strokeWidth={3} />
          </button>
        )}
        <button onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 bg-transparent border-0 p-0 text-left">
          <IconBadge name={l.icon} color={l.color} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-medium">{t.description}</span>
            <span className="block text-[12.5px] text-ink2">{fmtDate(t.date)} · {l.name}</span>
          </span>
          <Money v={t.kind === 'income' ? t.amount : -t.amount} sign className={`text-[14.5px] font-semibold ${t.kind === 'income' ? 'text-income' : t.kind === 'investment' ? 'text-invest' : ''}`} />
        </button>
      </div>
    )
  }
}

function Kpi({ title, value, d, color, foot, invert, strong, delay }: {
  title: string; value: number; d: number | null; color: 'green' | 'red' | 'blue' | 'purple'; foot?: string; invert?: boolean; strong?: boolean; delay: number
}) {
  return (
    <Card delay={delay} className="!p-4 sm:!p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-[13px] text-ink2 font-medium"><i className="dot" style={{ background: solid(color) }} />{title}</span>
        <Delta value={d} invert={invert} />
      </div>
      <div className={`money num font-semibold tracking-tight ${strong ? 'text-[26px] sm:text-[30px]' : 'text-[22px] sm:text-[26px]'}`}>{money(value)}</div>
      {foot && <div className="text-[12.5px] text-ink2 mt-1">{foot}</div>}
    </Card>
  )
}

function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex gap-4 flex-wrap mt-2 text-[12.5px] text-ink2">
      {items.map((i) => <span key={i.name} className="flex items-center gap-1.5"><i className="dot" style={{ background: i.color }} />{i.name}</span>)}
    </div>
  )
}

/** "Como estou?" — leituras do mes atual em linguagem simples. */
function Insights() {
  const { data } = useStore()
  const lines = useMemo(() => {
    const today = todayISO()
    const ym = monthKey(today)
    const daysIn = getDate(endOfMonth(parseISO(today)))
    const day = getDate(parseISO(today))
    const daysLeft = daysIn - day + 1
    const month = data.transactions.filter((t) => monthKey(t.date) === ym)
    const s = summarize(month)
    const out: { icon: React.ReactNode; text: React.ReactNode; tone: 'good' | 'warn' | 'bad' | 'info' }[] = []

    // ritmo dos gastos variaveis vs. media dos ultimos 3 meses (mesma janela de dias)
    let avg = 0
    let counted = 0
    for (let i = 1; i <= 3; i++) {
      const r = rangeOf({ gran: 'month', anchor: format(addMonths(parseISO(today), -i), 'yyyy-MM-dd') })
      const upTo = `${r.start.slice(0, 8)}${String(day).padStart(2, '0')}`
      const spent = data.transactions
        .filter((t) => t.kind === 'expense' && t.paid && t.nature !== 'fixed' && !t.debt_id && t.date >= r.start && t.date <= upTo)
        .reduce((a, t) => a + t.amount, 0)
      if (spent > 0) { avg += spent; counted++ }
    }
    avg = counted ? avg / counted : 0
    const varSoFar = month.filter((t) => t.kind === 'expense' && t.paid && t.nature !== 'fixed' && !t.debt_id).reduce((a, t) => a + t.amount, 0)
    if (avg > 100) {
      const ratio = varSoFar / avg - 1
      if (ratio > 0.1) out.push({ icon: <TrendingUp size={17} />, tone: 'warn', text: <>Seus gastos variáveis estão <b>{percent(ratio)} acima</b> do seu ritmo normal para este ponto do mês.</> })
      else if (ratio < -0.1) out.push({ icon: <Leaf size={17} />, tone: 'good', text: <>Você está gastando <b>{percent(-ratio)} menos</b> que o seu normal. Segue assim!</> })
      else out.push({ icon: <Equal size={17} />, tone: 'info', text: <>Seus gastos variáveis estão <b>no ritmo de sempre</b>.</> })
    }

    // quanto posso gastar por dia
    const expectedIncome = s.income + s.pendingIncome
    const fixedAll = month.filter((t) => t.kind === 'expense' && (t.nature === 'fixed' || t.debt_id)).reduce((a, t) => a + t.amount, 0)
    const investAll = month.filter((t) => t.kind === 'investment').reduce((a, t) => a + t.amount, 0)
    const varAll = month.filter((t) => t.kind === 'expense' && t.nature !== 'fixed' && !t.debt_id).reduce((a, t) => a + t.amount, 0)
    if (expectedIncome > 0) {
      const free = expectedIncome - fixedAll - investAll - varAll
      const perDay = free / daysLeft
      if (free > 0) out.push({ icon: <Sun size={17} />, tone: 'good', text: <>Depois de fixas e aportes, dá pra gastar cerca de <b className="money">{money(perDay)} por dia</b> até o fim do mês.</> })
      else out.push({ icon: <CircleAlert size={17} />, tone: 'bad', text: <>Pelo que já foi lançado, o mês passa <b className="money">{money(-free)}</b> da sua renda. Vale segurar os gastos variáveis.</> })

      // projecao
      const pace = day > 0 ? varSoFar / day : 0
      const projVar = Math.max(varAll, pace * daysIn)
      const projLeft = expectedIncome - fixedAll - investAll - projVar
      if (day >= 5) out.push({ icon: projLeft >= 0 ? <Compass size={17} /> : <CircleAlert size={17} />, tone: projLeft >= 0 ? 'info' : 'warn', text: <>No ritmo atual, o mês fecha {projLeft >= 0 ? 'com sobra de' : 'faltando'} <b className="money">{money(Math.abs(projLeft))}</b>.</> })
    }

    // vencimentos proximos
    const in7 = format(addDays(parseISO(today), 7), 'yyyy-MM-dd')
    const soon = data.transactions.filter((t) => !t.paid && t.kind !== 'income' && inRange(t.date, { start: '0000-00-00', end: in7 }))
    if (soon.length) {
      const total = soon.reduce((a, t) => a + t.amount, 0)
      const late = soon.filter((t) => t.date < today).length
      out.push({ icon: late ? <Bell size={17} /> : <CalendarClock size={17} />, tone: late ? 'bad' : 'info', text: <>{late ? <><b>{late} em atraso</b> e </> : null}<b>{soon.length} {soon.length === 1 ? 'conta' : 'contas'}</b> a pagar nos próximos 7 dias: <b className="money">{money(total)}</b>.</> })
    }
    return out
  }, [data.transactions])

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

