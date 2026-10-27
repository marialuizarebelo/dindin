import type { AccountKind, ColorKey, DebtKind, DebtStatus, VaultKind } from './types'
import type { InvoiceStatus } from './invoices'

export const ACCOUNT_KIND: Record<AccountKind, string> = {
  checking: 'Conta corrente', savings: 'Poupança', cash: 'Carteira (dinheiro)', benefit: 'Vale / benefício',
}
export const VAULT_KIND: Record<VaultKind, string> = {
  caixinha: 'Caixinha / cofrinho', fixed: 'Renda fixa (CDB, Tesouro)', stocks: 'Ações e fundos', crypto: 'Cripto', other: 'Outro',
}
export const DEBT_KIND: Record<DebtKind, string> = {
  card: 'Cartão de crédito', bank: 'Banco / loja', loan: 'Empréstimo / financiamento', personal: 'Pessoal (família, amigos)', other: 'Outra',
}
export const DEBT_STATUS: Record<DebtStatus, string> = { open: 'A negociar', paying: 'Em pagamento', paid: 'Quitadas' }
export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; color: ColorKey }> = {
  empty: { label: 'Sem compras', color: 'gray' }, open: { label: 'Aberta', color: 'blue' }, closed: { label: 'Fechada', color: 'orange' },
  paid: { label: 'Paga', color: 'green' }, overdue: { label: 'Atrasada', color: 'red' },
}
