export type Kind = 'income' | 'expense' | 'investment'
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
}

/** Modelo de lancamento que se repete todo mes (despesas fixas, salario...). */
export interface Recurring {
  id: string
  kind: Kind
  description: string
  amount: number
  day: number
  category_id: string | null
  source_id: string | null
  nature: Nature | null
  goal_id: string | null
  active: boolean
  start_month: string // yyyy-MM
  end_month: string | null
  last_generated: string | null // yyyy-MM
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

export interface Debt {
  id: string
  name: string
  creditor: string
  icon: string
  color: ColorKey
  balance: number // saldo devedor informado em balance_date
  balance_date: string
  interest_monthly: number // % ao mes
  min_payment: number
  due_day: number | null
}

/** Limite mensal planejado para uma categoria de despesa. */
export interface Budget {
  id: string
  category_id: string
  amount: number
}

export interface Data {
  categories: Category[]
  sources: Source[]
  transactions: Transaction[]
  recurrings: Recurring[]
  goals: Goal[]
  debts: Debt[]
  budgets: Budget[]
}

export type TableName = keyof Data
export const TABLES: TableName[] = [
  'categories', 'sources', 'transactions', 'recurrings', 'goals', 'debts', 'budgets',
]
export const emptyData = (): Data => ({
  categories: [], sources: [], transactions: [], recurrings: [], goals: [], debts: [], budgets: [],
})
