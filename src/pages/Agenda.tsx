import { useMemo, useState } from 'react'
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { useLookup } from '../lib/lookup'
import { compact, fmtDate, money } from '../lib/format'
import { solid } from '../lib/colors'
import { todayISO } from '../lib/period'
import { projectBalance } from '../lib/balances'
import { cardKeys, invoiceSummary } from '../lib/invoices'
import { expandVirtual, horizonISO } from '../lib/recurrence'
import { isDone, txTitle } from '../lib/tx'
import type { Card, Transaction } from '../lib/types'
import { LineChart } from '../components/Charts'
import { IconBadge } from '../components/Icon'
import { useTxSheet } from '../components/TxSheet'
import { Card as Panel, Empty, Money, PageTitle, Seg, Tag, TintCard } from '../components/ui'

interface DayEvent {
  id: string; date: string; title: string; amount: number; type: 'income' | 'expense' | 'invoice' | 'transfer' | 'vault'
  done: boolean; tx?: Transaction; card?: Card; key?: string; virtual?: boolean; icon: string; color: 'green' | 'red' | 'purple' | 'gray' | 'blue'
}
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export default function Agenda() {
  const [tab, setTab] = useState<'calendario' | 'previsao'>('calendario')
  return (
    <>
      <PageTitle title="Agenda" subtitle="O que vence, o que entra e como seu saldo vai ficar"
        actions={<Seg value={tab} onChange={setTab} options={[{ value: 'calendario', label: 'Calendário' }, { value: 'previsao', label: 'Previsão de saldo' }]} />} />
      {tab === 'calendario' ? <CalendarView /> : <ForecastView />}
    </>
  )
}

function CalendarView() {
  const { data, update } = useStore()
  const { edit, open } = useTxSheet()
  const { label } = useLookup()
  const today = todayISO()
  const [ym, setYm] = useState(today.slice(0, 7))
  const [sel, setSel] = useState(today)

  const first = parseISO(`${ym}-01`)
  const gridStart = startOfWeek(startOfMonth(first), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 1 })
  const days: Date[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d)
  const from = iso(gridStart), to = iso(gridEnd)

  const events = useMemo(() => {
    const out: DayEvent[] = []
    for (const t of data.transactions) {
      if (t.date < from || t.date > to || t.kind === 'yield') continue
      if ((t.kind === 'expense' || t.kind === 'transfer') && t.card_id) continue
      const l = label(t)
      const signed = t.kind === 'income' || t.kind === 'redeem' ? t.amount : t.kind === 'transfer' ? 0 : -t.amount
      out.push({
        id: t.id, date: t.date, title: txTitle(t), amount: signed, done: isDone(t, today), tx: t, icon: l.icon,
        type: t.kind === 'income' ? 'income' : t.kind === 'expense' ? 'expense' : t.kind === 'transfer' ? 'transfer' : 'vault',
        color: t.kind === 'income' ? 'green' : t.kind === 'expense' ? 'red' : t.kind === 'transfer' ? 'gray' : 'purple',
      })
    }
    for (const c of data.cards.filter((x) => !x.archived)) {
      for (const key of cardKeys(data, c, today)) {
        const s = invoiceSummary(data, c, key, today)
        if (s.total === 0 || s.due < from || s.due > to) continue
        out.push({ id: `inv-${c.id}-${key}`, date: s.due, title: `Fatura ${c.name}`, amount: -(s.remaining || s.total), type: 'invoice', done: s.status === 'paid', card: c, key, icon: c.icon, color: 'purple' })
      }
    }
    const mat = horizonISO(today)
    if (to > mat) {
      for (const r of data.recurrings) for (const o of expandVirtual(r, from > mat ? from : mat, to)) {
        out.push({ id: `v-${r.id}-${o.date}`, date: o.date, title: r.description, amount: r.kind === 'income' ? o.amount : -o.amount, type: r.kind === 'income' ? 'income' : 'expense', done: false, virtual: true, icon: 'repeat', color: r.kind === 'income' ? 'green' : 'red' })
      }
    }
    return out
  }, [data, from, to, today, label])

  const byDay = useMemo(() => {
    const m = new Map<string, DayEvent[]>()
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e])
    return m
  }, [events])
  const monthEvents = events.filter((e) => e.date.slice(0, 7) === ym)
  const toReceive = monthEvents.filter((e) => e.amount > 0 && !e.done).reduce((a, e) => a + e.amount, 0)
  const toPay = monthEvents.filter((e) => e.amount < 0 && !e.done).reduce((a, e) => a - e.amount, 0)
  const selected = (byDay.get(sel) ?? []).sort((a, b) => Number(a.done) - Number(b.done))

  const payInvoice = (e: DayEvent) => {
    if (!e.card || !e.key) return
    open({ kind: 'transfer', card_id: e.card.id, invoice_month: e.key, amount: Math.abs(e.amount), date: today, paid: true,
      account_id: e.card.pay_account_id ?? data.accounts.find((a) => !a.archived)?.id ?? null, description: `Fatura ${e.card.name}` })
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        <TintCard color="green" icon="trend" label="A receber no mês" delay={20}><div className="money num font-display kpi-num">{money(toReceive)}</div></TintCard>
        <TintCard color="red" icon="receipt" label="A pagar no mês" delay={60}><div className="money num font-display kpi-num">{money(toPay)}</div></TintCard>
      </div>

      <Panel className="!p-3 sm:!p-5 mb-4" delay={100}>
        <div className="flex items-center justify-between mb-3">
          <button className="btn btn-icon" aria-label="Mês anterior" onClick={() => setYm(format(addMonths(first, -1), 'yyyy-MM'))}><ChevronLeft size={18} /></button>
          <div className="text-center">
            <div className="font-display text-[26px] capitalize leading-none">{format(first, 'MMMM yyyy', { locale: ptBR })}</div>
            {ym !== today.slice(0, 7) && <button className="bg-transparent border-0 p-0 text-[12.5px] text-accent mt-1" onClick={() => { setYm(today.slice(0, 7)); setSel(today) }}>voltar para hoje</button>}
          </div>
          <button className="btn btn-icon" aria-label="Próximo mês" onClick={() => setYm(format(addMonths(first, 1), 'yyyy-MM'))}><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11.5px] font-semibold text-ink2 uppercase tracking-wider mb-1">
          {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const k = iso(d)
            const ev = byDay.get(k) ?? []
            const inMonth = isSameMonth(d, first)
            const isToday = k === today
            const net = ev.reduce((a, e) => a + (e.done ? 0 : e.amount), 0)
            return (
              <button key={k} onClick={() => setSel(k)} aria-label={fmtDate(k, "d 'de' MMMM")}
                className="rounded-xl text-left p-1.5 sm:p-2 border-2 min-h-[58px] sm:min-h-[96px] flex flex-col gap-1 transition-colors"
                style={{
                  opacity: inMonth ? 1 : 0.4, background: sel === k ? 'var(--accent-soft)' : 'var(--field)',
                  borderColor: isToday ? 'var(--accent)' : sel === k ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'transparent',
                }}>
                <span className={`text-[12.5px] font-semibold ${isToday ? 'text-accent' : ''}`}>{d.getDate()}</span>
                <span className="hidden sm:flex flex-col gap-0.5 overflow-hidden">
                  {ev.slice(0, 2).map((e) => (
                    <span key={e.id} className="text-[11px] leading-tight truncate flex items-center gap-1" style={{ opacity: e.done ? 0.5 : 1, textDecoration: e.done ? 'line-through' : undefined }}>
                      <i className="dot !h-1.5 !w-1.5" style={{ background: solid(e.color) }} />{e.title}
                    </span>
                  ))}
                  {ev.length > 2 && <span className="text-[10.5px] text-ink2">+{ev.length - 2}</span>}
                </span>
                <span className="flex sm:hidden gap-0.5 flex-wrap">
                  {ev.slice(0, 4).map((e) => <i key={e.id} className="dot !h-1.5 !w-1.5" style={{ background: solid(e.color), opacity: e.done ? 0.4 : 1 }} />)}
                </span>
                {net !== 0 && <span className="hidden sm:block mt-auto text-[11px] font-semibold num money" style={{ color: net > 0 ? 'var(--c-green)' : 'var(--ink-2)' }}>{net > 0 ? '+' : '−'}{compact(Math.abs(net))}</span>}
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel delay={140}>
        <div className="font-semibold text-[16px] mb-1 first-letter:uppercase">{format(parseISO(sel), "EEEE, d 'de' MMMM", { locale: ptBR })}</div>
        {selected.length === 0 ? <Empty icon="calendar" title="Nada neste dia">Toque em outro dia ou crie um lançamento com essa data.</Empty> : selected.map((e) => (
          <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-hair last:border-0">
            {e.tx && e.tx.kind !== 'transfer' && !(e.tx.kind === 'expense' && e.tx.card_id) ? (
              <button aria-label={e.done ? 'Marcar como pendente' : 'Marcar como pago'} onClick={() => update('transactions', e.tx!.id, { paid: !e.tx!.paid })}
                className="h-6 w-6 rounded-full grid place-items-center p-0 shrink-0 border-2"
                style={e.done ? { background: 'var(--c-green)', borderColor: 'var(--c-green)', color: '#fff' } : { background: 'transparent', borderColor: 'var(--ink-3)', color: 'transparent' }}>
                <Check size={13} strokeWidth={3.2} />
              </button>
            ) : <span className="w-6" />}
            <button disabled={e.virtual} onClick={() => e.tx && edit(e.tx)} className="flex-1 min-w-0 flex items-center gap-3 bg-transparent border-0 p-0 text-left">
              <IconBadge name={e.icon} color={e.color} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium" style={{ opacity: e.done ? 0.6 : 1 }}>{e.title}</span>
                <span className="flex gap-1.5 mt-0.5">{e.virtual && <Tag color="gray">previsto</Tag>}{!e.done && !e.virtual && e.date < today && <Tag color="red">atrasado</Tag>}{e.done && <Tag color="green">{e.type === 'income' ? 'recebido' : 'pago'}</Tag>}</span>
              </span>
              <Money v={e.amount} sign className={`text-[14.5px] font-semibold ${e.amount > 0 ? 'text-income' : ''}`} />
            </button>
            {e.type === 'invoice' && !e.done && <button className="btn btn-sm btn-primary" onClick={() => payInvoice(e)}>Pagar</button>}
          </div>
        ))}
      </Panel>
    </>
  )
}

function ForecastView() {
  const { data } = useStore()
  const today = todayISO()
  const [days, setDays] = useState(60)
  const p = useMemo(() => projectBalance(data, today, days), [data, today, days])
  const end = p.points[p.points.length - 1]
  const running = useMemo(() => {
    let b = p.start
    return p.events.map((e) => ({ ...e, after: (b += e.delta) }))
  }, [p])
  const neg = p.firstNegative
  const hasAccounts = data.accounts.some((a) => !a.archived)

  return (
    <>
      {!hasAccounts && <Panel className="mb-4"><Empty icon="wallet" title="Cadastre suas contas">Para prever o saldo, o app precisa saber quanto você tem hoje em cada conta.</Empty></Panel>}
      <div className="flex justify-end mb-3"><Seg value={String(days)} onChange={(v) => setDays(Number(v))} options={[{ value: '30', label: '30 dias' }, { value: '60', label: '60 dias' }, { value: '90', label: '90 dias' }]} /></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <TintCard color="blue" icon="wallet" label="Saldo hoje" delay={20}><div className="money num font-display kpi-num">{money(p.start)}</div></TintCard>
        <TintCard color={end.balance < 0 ? 'red' : 'green'} icon="trend" label={`Em ${days} dias`} delay={60}><div className="money num font-display kpi-num">{money(end.balance)}</div><div className="text-[12.5px] text-ink2 mt-2.5">{fmtDate(end.date)}</div></TintCard>
        <TintCard color={p.min.balance < 0 ? 'red' : 'yellow'} icon="target" label="Menor saldo" delay={100} className="col-span-2 lg:col-span-1"><div className="money num font-display kpi-num">{money(p.min.balance)}</div><div className="text-[12.5px] text-ink2 mt-2.5">em {fmtDate(p.min.date)}</div></TintCard>
      </div>

      <div className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-3 fade-up text-[14px]" style={{ background: `color-mix(in srgb, ${neg ? 'var(--c-red)' : 'var(--c-green)'} 15%, transparent)` }}>
        {neg ? <AlertTriangle size={20} className="shrink-0 mt-0.5" /> : <Check size={20} className="shrink-0 mt-0.5" />}
        <span>
          {neg
            ? <>Atenção: pelo que está agendado, seu saldo fica <b>negativo em {fmtDate(neg.date)}</b> e chega a <b className="money num">{money(p.min.balance)}</b> em {fmtDate(p.min.date)}. Dá tempo de ajustar: adiar uma conta, antecipar um recebimento ou transferir de outra conta.</>
            : <>Tudo certo: seu saldo não fica negativo nos próximos {days} dias. O ponto mais baixo é <b className="money num">{money(p.min.balance)}</b> em {fmtDate(p.min.date)}.</>}
        </span>
      </div>

      <Panel className="mb-4" delay={140}>
        <div className="font-semibold text-[16px] mb-3">Saldo previsto dia a dia</div>
        <LineChart fit height={260} labels={p.points.map((x) => format(parseISO(x.date), 'dd/MM'))} series={[{ name: 'Saldo previsto', color: solid(neg ? 'red' : 'green'), values: p.points.map((x) => x.balance) }]} />
        <div className="text-[12.5px] text-ink2 mt-2">Considera saldos de hoje, lançamentos pendentes, parcelas, faturas (no vencimento) e fixos que se repetem.</div>
      </Panel>

      <Panel delay={180}>
        <div className="font-semibold text-[16px] mb-1">O que vai mexer no saldo</div>
        {running.length === 0 ? <Empty icon="check" title="Nada agendado">Lançamentos futuros e fixos aparecem aqui.</Empty> : running.slice(0, 25).map((e, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-hair last:border-0 text-[14px]">
            <span className="w-[54px] text-ink2 text-[12.5px] shrink-0">{fmtDate(e.date, 'dd/MM')}</span>
            <span className="flex-1 min-w-0 truncate">{e.label}</span>
            <Money v={e.delta} sign className={`font-semibold ${e.delta > 0 ? 'text-income' : ''}`} />
            <span className="hidden sm:block w-[110px] text-right text-ink2 text-[12.5px] money num">saldo {money(e.after)}</span>
          </div>
        ))}
      </Panel>
    </>
  )
}
