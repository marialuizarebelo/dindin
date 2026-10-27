import { uid } from './format'
import { todayISO } from './period'
import type { Transaction } from './types'

export const TX_DEFAULTS = {
  category_id: null, source_id: null, nature: null, paid: true, goal_id: null, debt_id: null, recurring_id: null,
  group_id: null, vault_id: null, account_id: null, to_account_id: null, card_id: null, invoice_month: null, tags: [] as string[], note: '',
  installment_group: null, installment_no: null, installment_total: null,
}

export type NewTx = Partial<Transaction> & Pick<Transaction, 'kind' | 'date' | 'amount' | 'description'>

/** Cria um lancamento completo (ids e campos opcionais preenchidos). */
export function makeTx(p: NewTx): Transaction {
  return { id: uid(), ...TX_DEFAULTS, ...p, tags: p.tags ?? [] } as Transaction
}

/** Dados antigos (sem os campos novos) continuam funcionando. */
export const normalizeTx = (t: Partial<Transaction>): Transaction => ({ ...TX_DEFAULTS, ...t, tags: t.tags ?? [] }) as Transaction

/**
 * "Ja aconteceu?" Compra no cartao conta como gasto assim que a data chega (a conta so sai quando a fatura e paga);
 * o resto depende de estar marcado como pago/recebido.
 */
export const isDone = (t: Transaction, today = todayISO()) => (t.kind === 'expense' && t.card_id ? t.paid || t.date <= today : t.paid)

/** Texto de exibicao: "Notebook (3/10)". */
export const txTitle = (t: Pick<Transaction, 'description' | 'installment_no' | 'installment_total'>) =>
  t.installment_total && t.installment_total > 1 ? `${t.description} (${t.installment_no}/${t.installment_total})` : t.description
