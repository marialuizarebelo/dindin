import { normalizeTx } from './tx'
import { emptyData, type Data, type Debt, type Recurring } from './types'

/** Dados gravados por versoes antigas do app ganham os campos novos com valores padrao. */
const normalizeDebt = (d: Partial<Debt>): Debt => ({
  kind: 'other', status: 'paying', original_amount: d.balance ?? 0, installments_total: null, negotiated_at: null,
  paid_at: null, note: '', due_day: null, creditor: '', ...d,
}) as Debt

const normalizeRecurring = (r: Partial<Recurring> & { start_month?: string; day?: number }): Recurring => ({
  variable: false, frequency: 'monthly', interval_n: 1, generated: 0, count: null, end_date: null, debt_id: null, group_id: null,
  vault_id: null, account_id: null, card_id: null, tags: [], note: '',
  start_date: r.start_date ?? (r.start_month ? `${r.start_month}-${String(r.day ?? 1).padStart(2, '0')}` : '2026-01-01'),
  ...r,
}) as Recurring

export function normalizeData(raw: Partial<Data>): Data {
  const d = { ...emptyData(), ...raw }
  return {
    ...d,
    transactions: d.transactions.map(normalizeTx),
    debts: d.debts.map(normalizeDebt),
    recurrings: d.recurrings.map(normalizeRecurring),
    cards: d.cards.map((c) => ({ ...c, group_id: c.group_id ?? null, pay_account_id: c.pay_account_id ?? null, archived: c.archived ?? false })),
  }
}
