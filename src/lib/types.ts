/**
 * income = receita · expense = despesa · investment = aporte numa caixinha · transfer = entre contas / pagamento de fatura
 * redeem = resgate da caixinha para uma conta · yield = rendimento da caixinha (pode ser negativo)
 */
export type Kind = 'income' | 'expense' | 'investment' | 'transfer' | 'redeem' | 'yield'
export type Nature = 'fixed' | 'variable'
export type ColorKey =
  | 'gray' | 'brown' | 'orange' | 'yellow' | 'green'
  | 'teal' | 'blue' | 'purple' | 'pink' | 'red'

export interface Category {
  id: string
  name: string
  kind: 'expense' | 'investment'
  icon: string
  color: ColorKey
}

/** Origem de uma receita (salario, freela...). */
export interface Source {
  id: string
  name: string
  icon: string
  color: ColorKey
}

/** Grupo livre para separar gastos: Casa, Minhas, Lucas, Mae... */
export interface Group {
  id: string
  name: string
  icon: string
  color: ColorKey
}

export type VaultKind = 'caixinha' | 'fixed' | 'stocks' | 'crypto' | 'other'

/** Caixinha / investimento: guarda dinheiro; saldo = aportes - resgates + rendimentos. */
export interface Vault {
  id: string
  name: string
  kind: VaultKind
  institution: string
  icon: string
  color: ColorKey
  initial_balance: number
  archived: boolean
}

export type AccountKind = 'checking' | 'savings' | 'cash' | 'benefit'

/** Conta onde o dinheiro mora (corrente, poupança, carteira...). */
export interface Account {
  id: string
  name: string
  kind: AccountKind
  icon: string
  color: ColorKey
  initial_balance: number
  archived: boolean
}

/** Cartao de credito: compras caem na fatura conforme fechamento/vencimento. */
export interface Card {
  id: string
  name: string
  icon: string
  color: ColorKey
  limit_amount: number
  closing_day: number
  due_day: number
  pay_account_id: string | null
  group_id: string | null // quem usa o cartao (ex.: Lucas): compras nascem nesse grupo
  archived: boolean
}

export interface Transaction {
  id: string
  kind: Kind
  date: string // yyyy-MM-dd
  amount: number // sempre positivo
  description: string
  category_id: string | null // despesa / investimento
  source_id: string | null // receita
  nature: Nature | null // so despesa
  paid: boolean // pago / recebido / aportado
  goal_id: string | null
  debt_id: string | null
  recurring_id: string | null
  group_id: string | null
  vault_id: string | null // caixinha (aporte, resgate, rendimento)
  account_id: string | null // conta (ou origem da transferencia / do pagamento de fatura)
  to_account_id: string | null // destino da transferencia entre contas
  card_id: string | null // compra no cartao (despesa) ou cartao pago (transferencia)
  invoice_month: string | null // pagamento de fatura: mes de vencimento (yyyy-MM)
  tags: string[]
  note: string
  installment_group: string | null
  installment_no: number | null
  installment_total: number | null
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** Modelo de lancamento que se repete (fixos). Os lancamentos sao gerados ate o fim do proximo mes. */
export interface Recurring {
  id: string
  kind: 'income' | 'expense' | 'investment'
  description: string
  amount: number
  variable: boolean // valor estimado: nasce pendente ate voce confirmar o valor real
  frequency: Frequency
  interval_n: number // a cada N (dias/semanas/meses/anos)
  start_date: string
  generated: number // quantas ocorrencias ja foram geradas (indice da proxima)
  count: number | null // total de ocorrencias; null = sem fim
  end_date: string | null
  category_id: string | null
  source_id: string | null
  nature: Nature | null
  goal_id: string | null
  debt_id: string | null // pagamento recorrente de uma divida (ex.: mae)
  group_id: string | null
  vault_id: string | null
  account_id: string | null
  card_id: string | null
  tags: string[]
  note: string
  active: boolean
}

/** Modelo rapido (favorito) para preencher um lancamento com 1 toque. */
export interface Template {
  id: string
  name: string
  kind: 'income' | 'expense' | 'investment'
  description: string
  amount: number | null
  category_id: string | null
  source_id: string | null
  nature: Nature | null
  group_id: string | null
  vault_id: string | null
  account_id: string | null
  card_id: string | null
}

export interface Goal {
  id: string
  name: string
  icon: string
  color: ColorKey
  target: number
  initial: number
  deadline: string | null
}

/** a negociar -> em pagamento (negociada) -> quitada (historico) */
export type DebtStatus = 'open' | 'paying' | 'paid'
export type DebtKind = 'bank' | 'card' | 'loan' | 'personal' | 'other'

export interface Debt {
  id: string
  name: string
  creditor: string
  kind: DebtKind
  status: DebtStatus
  icon: string
  color: ColorKey
  original_amount: number // quanto era a divida no inicio
  balance: number // saldo devedor informado em balance_date
  balance_date: string
  interest_monthly: number // % ao mes
  min_payment: number // parcela / minimo mensal
  due_day: number | null
  installments_total: number | null
  negotiated_at: string | null
  paid_at: string | null
  note: string
}

/** Limite mensal planejado para uma categoria de despesa. */
export interface Budget {
  id: string
  category_id: string
  amount: number
}

export interface Data {
  groups: Group[]
  vaults: Vault[]
  accounts: Account[]
  cards: Card[]
  templates: Template[]
  categories: Category[]
  sources: Source[]
  transactions: Transaction[]
  recurrings: Recurring[]
  goals: Goal[]
  debts: Debt[]
  budgets: Budget[]
}

export type TableName = keyof Data
/** Ordem importa: tabelas referenciadas vem antes de quem referencia (chaves estrangeiras). */
export const TABLES: TableName[] = [
  'groups', 'accounts', 'cards', 'vaults', 'categories', 'sources', 'goals', 'debts', 'templates', 'recurrings', 'transactions', 'budgets',
]
export const emptyData = (): Data => ({
  groups: [], vaults: [], accounts: [], cards: [], templates: [], categories: [], sources: [], transactions: [], recurrings: [], goals: [], debts: [], budgets: [],
})
