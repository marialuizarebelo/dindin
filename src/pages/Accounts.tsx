import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeftRight, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { useLookup } from '../lib/lookup'
import { fmtDate, money, moneyInt, percent } from '../lib/format'
import { todayISO } from '../lib/period'
import { accountBalance, totalAvailable } from '../lib/balances'
import { cardOutstanding, cardKeys, invoiceKeyOf, invoiceSummary } from '../lib/invoices'
import { ACCOUNT_KIND, INVOICE_STATUS } from '../lib/labels'
import { txTitle } from '../lib/tx'
import type { Account, Card } from '../lib/types'
import { AccountForm, CardForm } from '../components/EntityForms'
import { Icon, IconBadge } from '../components/Icon'
import { useTxSheet } from '../components/TxSheet'
import { Card as Panel, Empty, Money, PageTitle, Progress, Sheet, Tag, TintCard } from '../components/ui'

export default function Accounts() {
  const { data } = useStore()
  const { open } = useTxSheet()
  const nav = useNavigate()
  const { groups } = useLookup()
  const today = todayISO()
  const [accEdit, setAccEdit] = useState<Account | 'new' | null>(null)
  const [cardEdit, setCardEdit] = useState<Card | 'new' | null>(null)
  const [invoice, setInvoice] = useState<{ card: Card; key: string } | null>(null)

  const accounts = data.accounts.filter((a) => !a.archived)
  const cards = data.cards.filter((c) => !c.archived)
  const total = totalAvailable(data, today)
  const toPay = useMemo(() => {
    let sum = 0
    for (const c of cards) {
      const cur = invoiceKeyOf(c, today)
      for (const k of cardKeys(data, c, today)) if (k <= cur) sum += invoiceSummary(data, c, k, today).remaining
    }
    return sum
  }, [data, cards, today])
  const limitLeft = cards.reduce((a, c) => a + Math.max(0, c.limit_amount - cardOutstanding(data, c, today)), 0)

  return (
    <>
      <PageTitle title="Contas e cartões" subtitle="Onde está o seu dinheiro e o que você deve nos cartões"
        actions={
          <div className="flex gap-2 flex-wrap">
            <button className="btn" onClick={() => open({ kind: 'transfer' })}><ArrowLeftRight size={16} /> Transferir</button>
            <button className="btn btn-primary" onClick={() => setAccEdit('new')}><Plus size={16} /> Conta</button>
            <button className="btn btn-primary" onClick={() => setCardEdit('new')}><Plus size={16} /> Cartão</button>
          </div>
        } />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <TintCard color="green" icon="wallet" label="Disponível agora" delay={20}><div className="money num font-display kpi-num">{money(total)}</div><div className="text-[12.5px] text-ink2 mt-2.5">{accounts.length} {accounts.length === 1 ? 'conta' : 'contas'}</div></TintCard>
        <TintCard color="purple" icon="card" label="Faturas a pagar" delay={60}><div className="money num font-display kpi-num">{money(toPay)}</div><div className="text-[12.5px] text-ink2 mt-2.5">até a fatura atual</div></TintCard>
        <TintCard color="blue" icon="shield" label="Limite livre" delay={100} className="col-span-2 lg:col-span-1"><div className="money num font-display kpi-num">{money(limitLeft)}</div><div className="text-[12.5px] text-ink2 mt-2.5">somando os cartões</div></TintCard>
      </div>

      <div className="font-semibold text-[16px] mb-3">Contas</div>
      {accounts.length === 0 ? (
        <Panel className="mb-5"><Empty icon="wallet" title="Nenhuma conta ainda">Crie conta corrente, vale-alimentação, carteira… cada uma com seu saldo.</Empty></Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {accounts.map((a, i) => {
            const bal = accountBalance(data, a, today)
            return (
              <Panel key={a.id} delay={140 + i * 30}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <IconBadge name={a.icon} color={a.color} size={44} />
                    <div className="min-w-0"><div className="font-semibold truncate">{a.name}</div><div className="text-[12.5px] text-ink2">{ACCOUNT_KIND[a.kind]}</div></div>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => setAccEdit(a)}>Editar</button>
                </div>
                <div className="money num font-display text-[30px] leading-none mt-4" style={{ color: bal < 0 ? 'var(--c-red)' : undefined }}>{money(bal)}</div>
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-sm flex-1" onClick={() => open({ kind: 'expense', account_id: a.id })}>Lançar</button>
                  <button className="btn btn-sm flex-1" onClick={() => nav(`/lancamentos?conta=${a.id}`)}>Extrato</button>
                </div>
              </Panel>
            )
          })}
        </div>
      )}

      <div className="font-semibold text-[16px] mb-3">Cartões de crédito</div>
      {cards.length === 0 ? (
        <Panel><Empty icon="card" title="Nenhum cartão ainda">Cadastre o fechamento e o vencimento: o app joga cada compra (e cada parcela) na fatura certa. Pode ter o seu e o de outra pessoa.</Empty></Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((c, i) => {
            const cur = invoiceKeyOf(c, today)
            const s = invoiceSummary(data, c, cur, today)
            const prevKeys = cardKeys(data, c, today).filter((k) => k < cur)
            const late = prevKeys.map((k) => invoiceSummary(data, c, k, today)).filter((x) => x.remaining > 0.004)
            const used = cardOutstanding(data, c, today)
            const group = c.group_id ? groups.get(c.group_id) : null
            return (
              <Panel key={c.id} delay={200 + i * 30}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <IconBadge name={c.icon} color={c.color} size={44} />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="flex gap-1.5 mt-0.5 flex-wrap">
                        <Tag color="gray">fecha {c.closing_day} · vence {c.due_day}</Tag>
                        {group && <Tag color={group.color}>{group.name}</Tag>}
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => setCardEdit(c)}>Editar</button>
                </div>
                <div className="flex items-baseline justify-between mt-4">
                  <div><div className="text-[12px] text-ink2">Fatura atual · vence {fmtDate(s.due)}</div><div className="money num font-display text-[28px] leading-none mt-1">{money(s.total)}</div></div>
                  <Tag color={INVOICE_STATUS[s.status].color}>{INVOICE_STATUS[s.status].label}</Tag>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-[12.5px] text-ink2 mb-1.5"><span>Limite usado <b className="text-ink money num">{moneyInt(used)}</b></span><span>de <span className="money num">{moneyInt(c.limit_amount)}</span> · {c.limit_amount > 0 ? percent(Math.min(used / c.limit_amount, 1)) : '—'}</span></div>
                  <Progress value={c.limit_amount > 0 ? used / c.limit_amount : 0} color={used / (c.limit_amount || 1) > 0.85 ? 'red' : c.color} />
                </div>
                {late.map((x) => (
                  <button key={x.key} onClick={() => setInvoice({ card: c, key: x.key })} className="mt-3 w-full text-left text-[13px] rounded-xl px-3 py-2 border-0 flex justify-between gap-2"
                    style={{ background: `color-mix(in srgb, ${x.status === 'overdue' ? 'var(--c-red)' : 'var(--c-orange)'} 16%, transparent)` }}>
                    <span>{x.status === 'overdue' ? 'Fatura atrasada' : 'Fatura fechada'} de {format(parseISO(`${x.key}-01`), 'MMM', { locale: ptBR })} · {x.status === 'overdue' ? 'venceu' : 'vence'} {fmtDate(x.due)}</span>
                    <b className="money num">{money(x.remaining)}</b>
                  </button>
                ))}
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-sm flex-1" onClick={() => setInvoice({ card: c, key: cur })}>Ver faturas</button>
                  <button className="btn btn-sm flex-1" onClick={() => open({ kind: 'expense', card_id: c.id, account_id: null })}>Lançar compra</button>
                </div>
              </Panel>
            )
          })}
        </div>
      )}

      {accEdit && <AccountForm account={accEdit === 'new' ? undefined : accEdit} onClose={() => setAccEdit(null)} />}
      {cardEdit && <CardForm card={cardEdit === 'new' ? undefined : cardEdit} onClose={() => setCardEdit(null)} />}
      {invoice && <InvoiceSheet card={invoice.card} initialKey={invoice.key} onClose={() => setInvoice(null)} />}
    </>
  )
}

function InvoiceSheet({ card, initialKey, onClose }: { card: Card; initialKey: string; onClose: () => void }) {
  const { data } = useStore()
  const { edit, open } = useTxSheet()
  const { label, groups } = useLookup()
  const today = todayISO()
  const [key, setKey] = useState(initialKey)
  const s = invoiceSummary(data, card, key, today)
  const shift = (n: number) => setKey(format(addMonths(parseISO(`${key}-01`), n), 'yyyy-MM'))
  const byDate = useMemo(() => {
    const m = new Map<string, typeof s.items>()
    for (const t of [...s.items].sort((a, b) => (a.date < b.date ? -1 : 1))) m.set(t.date, [...(m.get(t.date) ?? []), t])
    return [...m.entries()]
  }, [s.items])
  const st = INVOICE_STATUS[s.status]
  const pay = () => {
    onClose()
    setTimeout(() => open({
      kind: 'transfer', card_id: card.id, invoice_month: key, amount: s.remaining || s.total, date: today, paid: true,
      account_id: card.pay_account_id ?? data.accounts.find((a) => !a.archived)?.id ?? null, description: `Fatura ${card.name}`,
    }), 50)
  }
  return (
    <Sheet open onClose={onClose} wide title={<span className="flex items-center gap-2"><Icon name={card.icon} size={18} /> {card.name}</span>}
      footer={<>
        <button className="btn" onClick={() => { onClose(); setTimeout(() => open({ kind: 'expense', card_id: card.id, account_id: null }), 50) }}>Lançar compra</button>
        <button className="btn btn-primary" disabled={s.total === 0 || s.remaining <= 0.004} onClick={pay}>Pagar fatura · {money(s.remaining)}</button>
      </>}>
      <div className="flex items-center justify-between mb-4">
        <button className="btn btn-icon" aria-label="Fatura anterior" onClick={() => shift(-1)}><ChevronLeft size={18} /></button>
        <div className="text-center">
          <div className="font-display text-[26px] capitalize leading-none">{format(parseISO(`${key}-01`), 'MMMM yyyy', { locale: ptBR })}</div>
          <div className="mt-1.5 flex items-center justify-center gap-2"><Tag color={st.color}>{st.label}</Tag><span className="text-[12.5px] text-ink2">fecha {fmtDate(s.closing)} · vence {fmtDate(s.due)}</span></div>
        </div>
        <button className="btn btn-icon" aria-label="Próxima fatura" onClick={() => shift(1)}><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        {[['Total', s.total], ['Pago', s.paid], ['Falta', s.remaining]].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl bg-[var(--field)] py-2.5"><div className="text-[11.5px] text-ink2">{l}</div><div className="money num font-semibold">{money(v as number)}</div></div>
        ))}
      </div>
      {byDate.length === 0 ? <Empty icon="card" title="Sem compras nesta fatura" /> : (
        <div className="flex flex-col">
          {byDate.map(([date, items]) => (
            <div key={date}>
              <div className="text-[12px] font-semibold text-ink2 uppercase tracking-wider pt-3 pb-1">{fmtDate(date, "EEE, d 'de' MMM")}</div>
              {items.map((t) => {
                const l = label(t)
                const g = t.group_id ? groups.get(t.group_id) : null
                return (
                  <button key={t.id} onClick={() => { onClose(); setTimeout(() => edit(t), 50) }} className="w-full flex items-center gap-3 py-2 bg-transparent border-0 border-b border-hair text-left">
                    <IconBadge name={l.icon} color={l.color} size={34} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[14.5px] font-medium">{txTitle(t)}</span>
                      <span className="flex gap-1.5 items-center text-[12px] text-ink2">{l.name}{g && <Tag color={g.color}>{g.name}</Tag>}</span>
                    </span>
                    <Money v={t.amount} className="font-semibold text-[14.5px]" />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
      {s.payments.length > 0 && (
        <div className="mt-4">
          <div className="text-[12px] font-semibold text-ink2 uppercase tracking-wider pb-1">Pagamentos</div>
          {s.payments.map((p) => (
            <button key={p.id} onClick={() => { onClose(); setTimeout(() => edit(p), 50) }} className="w-full flex justify-between py-2 bg-transparent border-0 border-b border-hair text-left text-[14px]">
              <span>{fmtDate(p.date)}</span><Money v={p.amount} className="font-semibold text-income" />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
