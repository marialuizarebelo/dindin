import { addDays, addMonths, endOfMonth, format, parseISO } from 'date-fns'
import { cardKeys, invoiceSummary } from './invoices'
import { expandVirtual, horizonISO } from './recurrence'
import { isDone } from './tx'
import type { Account, Data, Transaction, Vault } from './types'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const round = (v: number) => Math.round(v * 100) / 100

/** Efeito de um lancamento (ja realizado) no saldo de uma conta. */
export function accountDelta(t: Transaction, accountId: string | null): number {
  switch (t.kind) {
    case 'income': return t.account_id === accountId ? t.amount : 0
    case 'expense': return !t.card_id && t.account_id === accountId ? -t.amount : 0
    case 'investment': return t.account_id === accountId ? -t.amount : 0
    case 'redeem': return t.account_id === accountId ? t.amount : 0
    case 'transfer': return (t.account_id === accountId ? -t.amount : 0) + (t.to_account_id === accountId ? t.amount : 0)
    default: return 0
  }
}

/** Saldo da conta ate hoje (so o que ja aconteceu). */
export function accountBalance(data: Data, account: Pick<Account, 'id' | 'initial_balance'>, today: string): number {
  let b = account.initial_balance
  for (const t of data.transactions) if (t.date <= today && isDone(t, today)) b += accountDelta(t, account.id)
  return round(b)
}

/** Movimento de contas "sem conta" (dados antigos): entra no total para nao sumir. */
export function unassignedBalance(data: Data, today: string): number {
  let b = 0
  for (const t of data.transactions) if (t.date <= today && isDone(t, today)) b += accountDelta(t, null)
  return round(b)
}

export const totalAvailable = (data: Data, today: string) =>
  round(data.accounts.filter((a) => !a.archived).reduce((s, a) => s + accountBalance(data, a, today), 0) + unassignedBalance(data, today))

// ---------------------------------------------------------------- caixinhas

export interface VaultStats {
  balance: number // quanto tem agora
  deposited: number // aportes (+ saldo inicial)
  redeemed: number // resgates
  netInvested: number // total investido = aportes - resgates
  yields: number // rendimento acumulado
  yieldPct: number // rendimento / total investido
}

export function vaultStats(data: Data, vault: Pick<Vault, 'id' | 'initial_balance'>, today: string): VaultStats {
  let deposited = vault.initial_balance
  let redeemed = 0
  let yields = 0
  for (const t of data.transactions) {
    if (t.vault_id !== vault.id || t.date > today || !isDone(t, today)) continue
    if (t.kind === 'investment') deposited += t.amount
    else if (t.kind === 'redeem') redeemed += t.amount
    else if (t.kind === 'yield') yields += t.amount
  }
  const netInvested = round(deposited - redeemed)
  return {
    balance: round(netInvested + yields), deposited: round(deposited), redeemed: round(redeemed), netInvested,
    yields: round(yields), yieldPct: netInvested > 0 ? yields / netInvested : 0,
  }
}

export function allVaultsStats(data: Data, today: string) {
  const list = data.vaults.filter((v) => !v.archived).map((v) => ({ vault: v, ...vaultStats(data, v, today) }))
  const sum = (f: (s: VaultStats) => number) => round(list.reduce((a, s) => a + f(s), 0))
  const netInvested = sum((s) => s.netInvested)
  const yields = sum((s) => s.yields)
  return { list, balance: sum((s) => s.balance), netInvested, yields, yieldPct: netInvested > 0 ? yields / netInvested : 0 }
}

/** Saldo e total investido (aportes - resgates) da caixinha ao fim de cada mes, para o grafico de evolucao. */
export function vaultHistory(data: Data, vault: Pick<Vault, 'id' | 'initial_balance'>, monthEnds: string[], today: string): { balance: number[]; invested: number[] } {
  const balance: number[] = []
  const invested: number[] = []
  for (const end of monthEnds) {
    const upTo = end > today ? today : end
    let inv = vault.initial_balance
    let yld = 0
    for (const t of data.transactions) {
      if (t.vault_id !== vault.id || t.date > upTo || !isDone(t, today)) continue
      if (t.kind === 'investment') inv += t.amount
      else if (t.kind === 'redeem') inv -= t.amount
      else if (t.kind === 'yield') yld += t.amount
    }
    invested.push(round(inv))
    balance.push(round(inv + yld))
  }
  return { balance, invested }
}

// ---------------------------------------------------------------- previsao

export interface ProjEvent {
  date: string
  delta: number
  label: string
  type: 'income' | 'expense' | 'invoice' | 'invest' | 'transfer' | 'redeem' | 'recurring'
}

export interface Projection {
  start: number
  points: { date: string; balance: number }[]
  events: ProjEvent[]
  min: { date: string; balance: number }
  firstNegative: { date: string; balance: number } | null
}

/** Tudo que ainda vai mexer no dinheiro das contas nos proximos `days` dias. */
export function projectionEvents(data: Data, today: string, days: number): ProjEvent[] {
  const end = iso(addDays(parseISO(today), days))
  const scope = new Set(data.accounts.filter((a) => !a.archived).map((a) => a.id))
  const inScope = (id: string | null) => id === null || scope.has(id)
  const events: ProjEvent[] = []

  for (const t of data.transactions) {
    if ((t.date <= today && isDone(t, today)) || t.kind === 'yield') continue
    if ((t.kind === 'expense' || t.kind === 'transfer') && t.card_id) continue // vira fatura / pagamento de fatura
    const date = t.date < today ? today : t.date
    if (date > end) continue
    const label = t.description
    if (t.kind === 'income' && inScope(t.account_id)) events.push({ date, delta: t.amount, label, type: 'income' })
    else if (t.kind === 'expense' && inScope(t.account_id)) events.push({ date, delta: -t.amount, label, type: 'expense' })
    else if (t.kind === 'investment' && inScope(t.account_id)) events.push({ date, delta: -t.amount, label, type: 'invest' })
    else if (t.kind === 'redeem' && inScope(t.account_id)) events.push({ date, delta: t.amount, label, type: 'redeem' })
    else if (t.kind === 'transfer') {
      if (inScope(t.account_id)) events.push({ date, delta: -t.amount, label, type: 'transfer' })
      if (t.to_account_id && inScope(t.to_account_id)) events.push({ date, delta: t.amount, label, type: 'transfer' })
    }
  }

  for (const card of data.cards.filter((c) => !c.archived)) {
    for (const key of cardKeys(data, card, today)) {
      const s = invoiceSummary(data, card, key, today)
      if (s.remaining <= 0.004) continue
      const date = s.due < today ? today : s.due
      if (date <= end) events.push({ date, delta: -s.remaining, label: `Fatura ${card.name}`, type: 'invoice' })
    }
  }

  for (const r of data.recurrings) {
    for (const o of expandVirtual(r, today, end)) {
      const sign = r.kind === 'income' ? 1 : -1
      events.push({ date: o.date, delta: sign * o.amount, label: r.description, type: 'recurring' })
    }
  }
  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export function projectBalance(data: Data, today: string, days: number): Projection {
  const start = totalAvailable(data, today)
  const events = projectionEvents(data, today, days)
  const byDay = new Map<string, number>()
  for (const e of events) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.delta)
  const points: Projection['points'] = []
  let bal = start
  for (let i = 0; i <= days; i++) {
    const date = iso(addDays(parseISO(today), i))
    bal += byDay.get(date) ?? 0
    points.push({ date, balance: round(bal) })
  }
  const min = points.reduce((m, p) => (p.balance < m.balance ? p : m), points[0])
  return { start, points, events, min, firstNegative: points.find((p) => p.balance < 0) ?? null }
}

// ---------------------------------------------------------------- comprometido

export interface MonthCommitment { key: string; label: string; installments: number; recurring: number; other: number; total: number }

/** O que ja esta "carimbado" para sair nos proximos meses: parcelas, fixos e outros agendamentos. */
export function commitments(data: Data, today: string, months = 6): MonthCommitment[] {
  const out: MonthCommitment[] = []
  const horizon = horizonISO(today)
  for (let m = 0; m < months; m++) {
    const first = addMonths(parseISO(`${today.slice(0, 7)}-01`), m)
    const key = format(first, 'yyyy-MM')
    const start = m === 0 ? today : iso(first)
    const end = iso(endOfMonth(first))
    let installments = 0, recurring = 0, other = 0
    for (const t of data.transactions) {
      if (t.kind !== 'expense' || t.date < start || t.date > end || (isDone(t, today) && t.date <= today && !t.card_id)) continue
      if (!t.card_id && isDone(t, today)) continue
      if (t.installment_total && t.installment_total > 1) installments += t.amount
      else if (t.recurring_id) recurring += t.amount
      else other += t.amount
    }
    for (const r of data.recurrings) {
      if (r.kind === 'income' || end <= horizon) continue
      for (const o of expandVirtual(r, start, end)) recurring += o.amount
    }
    out.push({ key, label: format(first, 'MMM'), installments: round(installments), recurring: round(recurring), other: round(other), total: round(installments + recurring + other) })
  }
  return out
}
