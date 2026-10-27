import { addMonths, format, subDays } from 'date-fns'
import { uid } from './format'
import { clampDay } from './period'
import type { Category, Data, Debt, Goal, Recurring, Source, Transaction, Budget } from './types'
import { emptyData } from './types'

export const defaultCategories = (): Category[] => [
  { name: 'Moradia', emoji: '🏠', color: 'blue', kind: 'expense' },
  { name: 'Mercado', emoji: '🛒', color: 'green', kind: 'expense' },
  { name: 'Transporte', emoji: '🚗', color: 'orange', kind: 'expense' },
  { name: 'Restaurantes', emoji: '🍽️', color: 'red', kind: 'expense' },
  { name: 'Contas', emoji: '💡', color: 'yellow', kind: 'expense' },
  { name: 'Saúde', emoji: '💊', color: 'teal', kind: 'expense' },
  { name: 'Educação', emoji: '📚', color: 'purple', kind: 'expense' },
  { name: 'Lazer', emoji: '🎬', color: 'pink', kind: 'expense' },
  { name: 'Assinaturas', emoji: '📱', color: 'gray', kind: 'expense' },
  { name: 'Compras', emoji: '🛍️', color: 'brown', kind: 'expense' },
  { name: 'Cuidados', emoji: '💅', color: 'pink', kind: 'expense' },
  { name: 'Viagens', emoji: '✈️', color: 'teal', kind: 'expense' },
  { name: 'Dívidas', emoji: '💳', color: 'red', kind: 'expense' },
  { name: 'Outros', emoji: '✨', color: 'gray', kind: 'expense' },
  { name: 'Reserva de emergência', emoji: '🛟', color: 'green', kind: 'investment' },
  { name: 'Renda fixa', emoji: '🏦', color: 'blue', kind: 'investment' },
  { name: 'Ações', emoji: '📈', color: 'purple', kind: 'investment' },
  { name: 'Fundos imobiliários', emoji: '🏢', color: 'orange', kind: 'investment' },
  { name: 'Cripto', emoji: '🪙', color: 'yellow', kind: 'investment' },
  { name: 'Previdência', emoji: '☂️', color: 'teal', kind: 'investment' },
].map((c) => ({ id: uid(), ...c })) as Category[]

export const defaultSources = (): Source[] => [
  { name: 'Salário', emoji: '💼', color: 'green' },
  { name: 'Freelas', emoji: '🧑‍💻', color: 'blue' },
  { name: 'Rendimentos', emoji: '💸', color: 'purple' },
  { name: 'Outros', emoji: '🎁', color: 'orange' },
].map((s) => ({ id: uid(), ...s })) as Source[]

/** Dados de exemplo para conhecer o app (modo demonstracao). */
export function demoData(): Data {
  const d = emptyData()
  d.categories = defaultCategories()
  d.sources = defaultSources()
  const cat = (n: string) => d.categories.find((c) => c.name === n)!.id
  const src = (n: string) => d.sources.find((s) => s.name === n)!.id
  const today = new Date()
  const ym = (back: number) => format(addMonths(today, -back), 'yyyy-MM')

  const goals: Goal[] = [
    { id: uid(), name: 'Reserva de emergência', emoji: '🛟', color: 'green', target: 30000, initial: 4000, deadline: format(addMonths(today, 14), 'yyyy-MM-dd') },
    { id: uid(), name: 'Viagem pro Japão', emoji: '🗾', color: 'pink', target: 18000, initial: 0, deadline: format(addMonths(today, 20), 'yyyy-MM-dd') },
    { id: uid(), name: 'Entrada do apê', emoji: '🏡', color: 'blue', target: 80000, initial: 5000, deadline: null },
  ]
  d.goals = goals

  const debts: Debt[] = [
    { id: uid(), name: 'Cartão de crédito', creditor: 'Banco', emoji: '💳', color: 'red', balance: 3200, balance_date: format(addMonths(today, -2), 'yyyy-MM-01'), interest_monthly: 12, min_payment: 320, due_day: 10 },
    { id: uid(), name: 'Empréstimo pessoal', creditor: 'Banco', emoji: '🏦', color: 'orange', balance: 6400, balance_date: format(addMonths(today, -2), 'yyyy-MM-01'), interest_monthly: 3.2, min_payment: 380, due_day: 20 },
    { id: uid(), name: 'Parcelamento notebook', creditor: 'Loja', emoji: '💻', color: 'purple', balance: 1800, balance_date: format(addMonths(today, -2), 'yyyy-MM-01'), interest_monthly: 0, min_payment: 300, due_day: 5 },
  ]
  d.debts = debts

  const recs: Recurring[] = [
    { kind: 'income', description: 'Salário', amount: 6800, day: 5, source_id: src('Salário'), category_id: null, nature: null, goal_id: null },
    { kind: 'expense', description: 'Aluguel', amount: 1900, day: 8, category_id: cat('Moradia'), source_id: null, nature: 'fixed', goal_id: null },
    { kind: 'expense', description: 'Condomínio', amount: 480, day: 8, category_id: cat('Moradia'), source_id: null, nature: 'fixed', goal_id: null },
    { kind: 'expense', description: 'Internet', amount: 110, day: 12, category_id: cat('Contas'), source_id: null, nature: 'fixed', goal_id: null },
    { kind: 'expense', description: 'Netflix + Spotify', amount: 62.8, day: 15, category_id: cat('Assinaturas'), source_id: null, nature: 'fixed', goal_id: null },
    { kind: 'expense', description: 'Academia', amount: 129, day: 10, category_id: cat('Saúde'), source_id: null, nature: 'fixed', goal_id: null },
    { kind: 'investment', description: 'Aporte reserva', amount: 800, day: 6, category_id: cat('Reserva de emergência'), source_id: null, nature: null, goal_id: goals[0].id },
    { kind: 'investment', description: 'Aporte viagem', amount: 500, day: 6, category_id: cat('Renda fixa'), source_id: null, nature: null, goal_id: goals[1].id },
  ].map((r) => ({ id: uid(), active: true, start_month: ym(5), end_month: null, last_generated: format(today, 'yyyy-MM'), ...r })) as Recurring[]
  d.recurrings = recs

  const txs: Transaction[] = []
  const push = (t: Partial<Transaction> & Pick<Transaction, 'kind' | 'date' | 'amount' | 'description'>) =>
    txs.push({ id: uid(), category_id: null, source_id: null, nature: null, paid: true, goal_id: null, debt_id: null, recurring_id: null, ...t })
  const todayStr = format(today, 'yyyy-MM-dd')
  let seed = 7
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)

  for (let back = 5; back >= 0; back--) {
    const m = ym(back)
    for (const r of recs) {
      const date = clampDay(m, r.day)
      push({
        kind: r.kind, date, amount: r.amount, description: r.description, category_id: r.category_id,
        source_id: r.source_id, nature: r.nature, goal_id: r.goal_id, recurring_id: r.id, paid: date <= todayStr,
      })
    }
    if (back <= 4) push({ kind: 'income', date: clampDay(m, 20), amount: Math.round(900 + rnd() * 1800), description: 'Projeto freela', source_id: src('Freelas'), paid: clampDay(m, 20) <= todayStr })
    if (back <= 3) push({ kind: 'income', date: clampDay(m, 28), amount: Math.round(40 + rnd() * 90), description: 'Rendimento CDB', source_id: src('Rendimentos'), paid: clampDay(m, 28) <= todayStr })
    const variable: [string, string, number, number][] = [
      ['Mercado', 'Supermercado', 5, 420], ['Mercado', 'Feira', 3, 90], ['Restaurantes', 'iFood', 6, 55],
      ['Restaurantes', 'Jantar fora', 2, 140], ['Transporte', 'Uber', 5, 28], ['Transporte', 'Combustível', 2, 220],
      ['Lazer', 'Cinema / saída', 2, 90], ['Compras', 'Roupas', 1, 260], ['Cuidados', 'Salão', 1, 180],
      ['Saúde', 'Farmácia', 2, 70],
    ]
    for (const [c, desc, times, base] of variable) {
      for (let i = 0; i < times; i++) {
        const day = 1 + Math.floor(rnd() * 27)
        const date = clampDay(m, day)
        if (date > todayStr) continue
        push({ kind: 'expense', date, amount: Math.round((base * 0.68 * (0.6 + rnd() * 0.9)) * 100) / 100, description: desc, category_id: cat(c), nature: 'variable' })
      }
    }
    // pagamentos de divida
    for (const debt of debts) {
      const date = clampDay(m, debt.due_day ?? 10)
      if (back <= 1 && date >= debt.balance_date) {
        push({ kind: 'expense', date, amount: debt.min_payment, description: `Pgto ${debt.name}`, category_id: cat('Dívidas'), nature: 'fixed', debt_id: debt.id, paid: date <= todayStr })
      }
    }
  }
  push({ kind: 'expense', date: format(subDays(today, 1), 'yyyy-MM-dd'), amount: 89.9, description: 'Presente aniversário', category_id: cat('Compras'), nature: 'variable' })
  d.transactions = txs

  d.budgets = [
    ['Mercado', 1000], ['Restaurantes', 500], ['Transporte', 450], ['Lazer', 300], ['Compras', 400], ['Cuidados', 250],
  ].map(([c, amount]) => ({ id: uid(), category_id: cat(c as string), amount: amount as number })) as Budget[]
  return d
}
