import type { Data, Kind, Transaction } from './types'
import { inRange, type Range } from './period'

export interface Summary {
  income: number
  expense: number
  investment: number
  fixed: number
  variable: number
  pendingIncome: number
  pendingExpense: number
  /** recebido - gasto */
  result: number
  /** recebido - gasto - investido */
  left: number
  savingsRate: number
  count: number
}

export const txIn = (txs: Transaction[], r: Range) => txs.filter((t) => inRange(t.date, r))

/** Soma realizada (pago/recebido) e pendente de um conjunto de lancamentos. */
export function summarize(txs: Transaction[]): Summary {
  const s: Summary = {
    income: 0, expense: 0, investment: 0, fixed: 0, variable: 0,
    pendingIncome: 0, pendingExpense: 0, result: 0, left: 0, savingsRate: 0, count: txs.length,
  }
  for (const t of txs) {
    if (!t.paid) {
      if (t.kind === 'income') s.pendingIncome += t.amount
      else s.pendingExpense += t.amount
      continue
    }
    if (t.kind === 'income') s.income += t.amount
    else if (t.kind === 'investment') s.investment += t.amount
    else {
      s.expense += t.amount
      if (t.nature === 'fixed') s.fixed += t.amount
      else s.variable += t.amount
    }
  }
  s.result = s.income - s.expense
  s.left = s.income - s.expense - s.investment
  s.savingsRate = s.income > 0 ? (s.income - s.expense) / s.income : 0
  return s
}

export function groupSum(
  txs: Transaction[], kind: Kind, key: (t: Transaction) => string | null, onlyPaid = true,
): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of txs) {
    if (t.kind !== kind || (onlyPaid && !t.paid)) continue
    const k = key(t) ?? '_none'
    m.set(k, (m.get(k) ?? 0) + t.amount)
  }
  return m
}

export const goalSaved = (data: Data, goalId: string) => {
  const g = data.goals.find((x) => x.id === goalId)
  const added = data.transactions
    .filter((t) => t.goal_id === goalId && t.kind === 'investment' && t.paid)
    .reduce((a, t) => a + t.amount, 0)
  return (g?.initial ?? 0) + added
}

export const debtBalance = (data: Data, debtId: string) => {
  const d = data.debts.find((x) => x.id === debtId)
  if (!d) return 0
  const paid = data.transactions
    .filter((t) => t.debt_id === debtId && t.paid && t.date >= d.balance_date)
    .reduce((a, t) => a + t.amount, 0)
  return Math.max(0, Math.round((d.balance - paid) * 100) / 100)
}

export const delta = (cur: number, prev: number) => (prev === 0 ? null : (cur - prev) / Math.abs(prev))
