import { addDays, addMonths, addWeeks, addYears, endOfMonth, format, parseISO } from 'date-fns'
import { makeTx } from './tx'
import type { Frequency, Recurring, Transaction } from './types'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** Data da k-esima ocorrencia (k=0 e a primeira). Conta sempre a partir do inicio, entao nao "desliza" (31/jan -> 28/fev -> 31/mar). */
export function occurrenceDate(r: Pick<Recurring, 'start_date' | 'frequency' | 'interval_n'>, k: number): string {
  const d = parseISO(r.start_date)
  const n = Math.max(1, r.interval_n) * k
  switch (r.frequency) {
    case 'daily': return iso(addDays(d, n))
    case 'weekly': return iso(addWeeks(d, n))
    case 'monthly': return iso(addMonths(d, n))
    case 'yearly': return iso(addYears(d, n))
  }
}

/** Gera ate o fim do proximo mes. */
export const horizonISO = (today: string) => iso(endOfMonth(addMonths(parseISO(today), 1)))

const within = (r: Recurring, k: number, date: string) =>
  (r.count === null || k < r.count) && (!r.end_date || date <= r.end_date)

/**
 * Cria os lancamentos que faltam. O indice `generated` so avanca, entao o que voce apagar de proposito nao volta.
 * Valor variavel (estimado) nasce pendente; os demais nascem pagos quando a data ja passou.
 */
export function generateFor(r: Recurring, today: string): { txs: Transaction[]; generated: number } {
  const txs: Transaction[] = []
  let k = r.generated
  if (!r.active) return { txs, generated: k }
  const horizon = horizonISO(today)
  for (let guard = 0; guard < 400; guard++) {
    const date = occurrenceDate(r, k)
    if (date > horizon || !within(r, k, date)) break
    txs.push(makeTx({
      kind: r.kind, date, amount: r.amount, description: r.description, category_id: r.category_id, source_id: r.source_id,
      nature: r.nature, goal_id: r.goal_id, debt_id: r.debt_id, group_id: r.group_id, vault_id: r.vault_id,
      account_id: r.account_id, card_id: r.card_id, tags: r.tags, note: r.note,
      recurring_id: r.id, paid: !r.variable && date <= today,
    }))
    k++
  }
  return { txs, generated: k }
}

/** Ocorrencias ainda nao geradas ate `toISO` (so para projetar o futuro; nada e gravado). */
export function expandVirtual(r: Recurring, fromISO: string, toISO: string): { date: string; amount: number }[] {
  const out: { date: string; amount: number }[] = []
  if (!r.active) return out
  let k = r.generated
  for (let guard = 0; guard < 800; guard++) {
    const date = occurrenceDate(r, k)
    if (date > toISO || !within(r, k, date)) break
    if (date >= fromISO) out.push({ date, amount: r.amount })
    k++
  }
  return out
}

const UNIT: Record<Frequency, [string, string]> = { daily: ['dia', 'dias'], weekly: ['semana', 'semanas'], monthly: ['mês', 'meses'], yearly: ['ano', 'anos'] }

export function describeRecurrence(r: Pick<Recurring, 'frequency' | 'interval_n' | 'count' | 'end_date'>): string {
  const [one, many] = UNIT[r.frequency]
  const base = r.interval_n === 1
    ? ({ daily: 'Todo dia', weekly: 'Toda semana', monthly: 'Todo mês', yearly: 'Todo ano' })[r.frequency]
    : `A cada ${r.interval_n} ${many}`
  void one
  if (r.count) return `${base}, ${r.count}x`
  if (r.end_date) return `${base}, até ${format(parseISO(r.end_date), 'dd/MM/yyyy')}`
  return base
}
