import { addMonths, format, parseISO } from 'date-fns'
import { clampDay, nextMonthKey } from './period'
import { isDone } from './tx'
import type { Card, Data, Transaction } from './types'

const prevMonthKey = (ym: string) => format(addMonths(parseISO(`${ym}-01`), -1), 'yyyy-MM')

type Cycle = Pick<Card, 'closing_day' | 'due_day'>

/**
 * A fatura e identificada pelo MES DE VENCIMENTO (yyyy-MM): "fatura de novembro" vence em novembro.
 * Compra a partir do dia do fechamento entra na fatura seguinte.
 */
export function invoiceKeyOf(card: Cycle, dateISO: string): string {
  const ym = dateISO.slice(0, 7)
  const closeMonth = dateISO >= clampDay(ym, card.closing_day) ? nextMonthKey(ym) : ym
  return card.due_day > card.closing_day ? closeMonth : nextMonthKey(closeMonth)
}

export const dueDateOf = (card: Cycle, key: string) => clampDay(key, card.due_day)

export function closingDateOf(card: Cycle, key: string): string {
  const closeMonth = card.due_day > card.closing_day ? key : prevMonthKey(key)
  return clampDay(closeMonth, card.closing_day)
}

export type InvoiceStatus = 'empty' | 'open' | 'closed' | 'paid' | 'overdue'

export interface InvoiceSummary {
  key: string
  items: Transaction[]
  payments: Transaction[]
  total: number
  paid: number
  remaining: number
  closing: string
  due: string
  status: InvoiceStatus
}

const round = (v: number) => Math.round(v * 100) / 100

export const cardPurchases = (data: Data, card: Pick<Card, 'id'>) =>
  data.transactions.filter((t) => t.kind === 'expense' && t.card_id === card.id)
export const cardPayments = (data: Data, card: Pick<Card, 'id'>, today: string) =>
  data.transactions.filter((t) => t.kind === 'transfer' && t.card_id === card.id && isDone(t, today))

export function invoiceSummary(data: Data, card: Card, key: string, today: string): InvoiceSummary {
  const items = cardPurchases(data, card).filter((t) => invoiceKeyOf(card, t.date) === key)
  const payments = cardPayments(data, card, today).filter((t) => t.invoice_month === key)
  const total = round(items.reduce((a, t) => a + t.amount, 0))
  const paid = round(payments.reduce((a, t) => a + t.amount, 0))
  const remaining = Math.max(0, round(total - paid))
  const closing = closingDateOf(card, key)
  const due = dueDateOf(card, key)
  let status: InvoiceStatus
  if (total === 0) status = 'empty'
  else if (remaining <= 0.004) status = 'paid'
  else if (today > due) status = 'overdue'
  else if (today >= closing) status = 'closed'
  else status = 'open'
  return { key, items, payments, total, paid, remaining, closing, due, status }
}

/** Todas as faturas com compra + a fatura de hoje, em ordem. */
export function cardKeys(data: Data, card: Card, today: string): string[] {
  const keys = new Set<string>([invoiceKeyOf(card, today)])
  for (const t of cardPurchases(data, card)) keys.add(invoiceKeyOf(card, t.date))
  return [...keys].sort()
}

/** Quanto do limite esta usado: tudo que foi comprado (inclusive parcelas futuras) menos o que ja foi pago. */
export function cardOutstanding(data: Data, card: Card, today: string): number {
  const bought = cardPurchases(data, card).reduce((a, t) => a + t.amount, 0)
  const paid = cardPayments(data, card, today).reduce((a, t) => a + t.amount, 0)
  return Math.max(0, round(bought - paid))
}
