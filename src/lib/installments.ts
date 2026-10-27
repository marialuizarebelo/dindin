import { addMonths, format, parseISO } from 'date-fns'
import { uid } from './format'
import { makeTx, type NewTx } from './tx'
import type { Transaction } from './types'

/** Divide `total` em n parcelas em centavos exatos; as sobras (1 centavo) vao para as primeiras. */
export function splitAmount(total: number, n: number): number[] {
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / n)
  const extra = cents - base * n
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / 100)
}

/** Data da parcela i (0 = primeira), mantendo o dia (ou o ultimo dia do mes, se nao existir). */
export const installmentDate = (startISO: string, i: number) => format(addMonths(parseISO(startISO), i), 'yyyy-MM-dd')

export type InstallmentMode = 'parcela' | 'total'

/**
 * Cria as n parcelas de uma compra. `mode` diz se o valor digitado e o da parcela ou o total.
 * `amounts` permite parcelas de valores diferentes (irregulares).
 */
export function buildInstallments(
  base: Omit<NewTx, 'date' | 'amount'>, startISO: string, amount: number, n: number, mode: InstallmentMode,
  today: string, amounts?: number[],
): Transaction[] {
  const per = amounts && amounts.length === n ? amounts : mode === 'total' ? splitAmount(amount, n) : Array.from({ length: n }, () => amount)
  const group = uid()
  return per.map((value, i) => {
    const date = installmentDate(startISO, i)
    return makeTx({
      ...base, date, amount: value, paid: base.card_id ? date <= today : date <= today && (base.paid ?? true),
      installment_group: group, installment_no: i + 1, installment_total: n, recurring_id: null,
    })
  })
}

/** Quanto falta pagar de uma compra parcelada (parcelas a partir de hoje). */
export const remainingOf = (parts: Transaction[], today: string) =>
  parts.filter((p) => p.date > today).reduce((a, p) => a + p.amount, 0)
