import { addMonths, format } from 'date-fns'

export type Strategy = 'avalanche' | 'snowball'

export interface DebtInput {
  id: string
  name: string
  balance: number
  rate: number // % ao mes
  minPayment: number
}

export interface PayoffResult {
  months: number
  totalInterest: number
  totalPaid: number
  payoffMonth: Record<string, number> // id -> mes (1 = proximo mes) em que quita
  order: string[]
  series: number[] // saldo total no fim de cada mes (inicia no mes 0)
  feasible: boolean
}

/**
 * Simula a quitacao mes a mes. Todo mes paga o minimo de cada divida e joga o
 * restante do orcamento (`budget`) na divida prioritaria da estrategia.
 * Avalanche = maior juros primeiro; Bola de neve = menor saldo primeiro.
 */
export function simulatePayoff(debts: DebtInput[], budget: number, strategy: Strategy): PayoffResult {
  const live = debts.filter((d) => d.balance > 0.005).map((d) => ({ ...d }))
  const totalMin = live.reduce((a, d) => a + d.minPayment, 0)
  const monthly = Math.max(budget, totalMin)
  const payoffMonth: Record<string, number> = {}
  const series = [live.reduce((a, d) => a + d.balance, 0)]
  let totalInterest = 0
  let totalPaid = 0
  let month = 0
  const MAX = 600

  while (live.some((d) => d.balance > 0.005) && month < MAX) {
    month++
    for (const d of live) {
      if (d.balance <= 0.005) continue
      const i = d.balance * (d.rate / 100)
      d.balance += i
      totalInterest += i
    }
    let pool = monthly
    for (const d of live) {
      if (d.balance <= 0.005) continue
      const pay = Math.min(d.minPayment, d.balance, pool)
      d.balance -= pay
      pool -= pay
      totalPaid += pay
    }
    const order = live
      .filter((d) => d.balance > 0.005)
      .sort((a, b) => (strategy === 'avalanche' ? b.rate - a.rate || a.balance - b.balance : a.balance - b.balance))
    for (const d of order) {
      if (pool <= 0.005) break
      const pay = Math.min(pool, d.balance)
      d.balance -= pay
      pool -= pay
      totalPaid += pay
    }
    for (const d of live) {
      if (d.balance <= 0.005 && payoffMonth[d.id] === undefined) {
        d.balance = 0
        payoffMonth[d.id] = month
      }
    }
    series.push(live.reduce((a, d) => a + d.balance, 0))
  }

  const feasible = !live.some((d) => d.balance > 0.005)
  const order = Object.entries(payoffMonth).sort((a, b) => a[1] - b[1]).map(([id]) => id)
  return { months: month, totalInterest, totalPaid, payoffMonth, order, series, feasible }
}

export const monthLabel = (monthsAhead: number, from = new Date()) =>
  format(addMonths(from, monthsAhead), 'MM/yyyy')
