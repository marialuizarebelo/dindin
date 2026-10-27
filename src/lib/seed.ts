import { addMonths, endOfMonth, format } from 'date-fns'
import { uid } from './format'
import { clampDay } from './period'
import { buildInstallments } from './installments'
import { generateFor } from './recurrence'
import { invoiceKeyOf, dueDateOf } from './invoices'
import { makeTx } from './tx'
import type { Account, Budget, Card, Category, Data, Debt, Goal, Group, Recurring, Source, Transaction, Vault } from './types'
import { emptyData } from './types'

export const defaultCategories = (): Category[] => [
  { name: 'Moradia', icon: 'home', color: 'blue', kind: 'expense' },
  { name: 'Mercado', icon: 'cart', color: 'green', kind: 'expense' },
  { name: 'Transporte', icon: 'car', color: 'orange', kind: 'expense' },
  { name: 'Restaurantes', icon: 'utensils', color: 'red', kind: 'expense' },
  { name: 'Contas', icon: 'bulb', color: 'yellow', kind: 'expense' },
  { name: 'Saúde', icon: 'health', color: 'teal', kind: 'expense' },
  { name: 'Educação', icon: 'education', color: 'purple', kind: 'expense' },
  { name: 'Lazer', icon: 'film', color: 'pink', kind: 'expense' },
  { name: 'Assinaturas', icon: 'phone', color: 'gray', kind: 'expense' },
  { name: 'Compras', icon: 'bag', color: 'brown', kind: 'expense' },
  { name: 'Cuidados', icon: 'flower', color: 'pink', kind: 'expense' },
  { name: 'Viagens', icon: 'plane', color: 'teal', kind: 'expense' },
  { name: 'Dívidas', icon: 'card', color: 'red', kind: 'expense' },
  { name: 'Outros', icon: 'sparkles', color: 'gray', kind: 'expense' },
  { name: 'Reserva de emergência', icon: 'shield', color: 'green', kind: 'investment' },
  { name: 'Renda fixa', icon: 'bank', color: 'blue', kind: 'investment' },
  { name: 'Ações', icon: 'trend', color: 'purple', kind: 'investment' },
  { name: 'Fundos imobiliários', icon: 'home', color: 'orange', kind: 'investment' },
  { name: 'Cripto', icon: 'coins', color: 'yellow', kind: 'investment' },
  { name: 'Previdência', icon: 'umbrella', color: 'teal', kind: 'investment' },
].map((c) => ({ id: uid(), ...c })) as Category[]

export const defaultSources = (): Source[] => [
  { name: 'Salário', icon: 'briefcase', color: 'green' },
  { name: 'Freelas', icon: 'laptop', color: 'blue' },
  { name: 'Rendimentos', icon: 'trend', color: 'purple' },
  { name: 'Outros', icon: 'gift', color: 'orange' },
].map((s) => ({ id: uid(), ...s })) as Source[]

export const defaultGroups = (): Group[] => [
  { name: 'Casa', icon: 'home', color: 'blue' },
  { name: 'Minhas', icon: 'user', color: 'pink' },
].map((g) => ({ id: uid(), ...g })) as Group[]

export const defaultAccount = (): Account => ({
  id: uid(), name: 'Conta principal', kind: 'checking', icon: 'bank', color: 'blue', initial_balance: 0, archived: false,
})

/** Dados de exemplo para conhecer o app (modo demonstracao): contas, vale, cartoes (o seu e o do Lucas), caixinhas, dividas em 3 etapas... */
export function demoData(): Data {
  const d = emptyData()
  d.categories = defaultCategories()
  d.sources = [...defaultSources(), { id: uid(), name: 'Benefícios', icon: 'gift', color: 'teal' }]
  d.groups = [
    ...defaultGroups(),
    { id: uid(), name: 'Lucas', icon: 'users', color: 'purple' },
    { id: uid(), name: 'Mãe', icon: 'heart', color: 'red' },
  ]
  const cat = (n: string) => d.categories.find((c) => c.name === n)!.id
  const src = (n: string) => d.sources.find((s) => s.name === n)!.id
  const grp = (n: string) => d.groups.find((g) => g.name === n)!.id
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const ym = (back: number) => format(addMonths(today, -back), 'yyyy-MM')
  const day = (back: number, dd: number) => clampDay(ym(back), dd)

  const acc = (name: string, kind: Account['kind'], icon: string, color: Account['color'], initial: number): Account =>
    ({ id: uid(), name, kind, icon, color, initial_balance: initial, archived: false })
  const corrente = acc('Conta corrente', 'checking', 'bank', 'blue', 2500)
  const vale = acc('Vale-alimentação (iFood)', 'benefit', 'utensils', 'green', 0)
  const carteira = acc('Carteira', 'cash', 'wallet', 'orange', 150)
  d.accounts = [corrente, vale, carteira]

  const meuCartao: Card = { id: uid(), name: 'Meu cartão', icon: 'card', color: 'purple', limit_amount: 9000, closing_day: 24, due_day: 1, pay_account_id: corrente.id, group_id: grp('Minhas'), archived: false }
  const cartaoLucas: Card = { id: uid(), name: 'Cartão do Lucas', icon: 'card', color: 'teal', limit_amount: 4000, closing_day: 10, due_day: 17, pay_account_id: corrente.id, group_id: grp('Lucas'), archived: false }
  d.cards = [meuCartao, cartaoLucas]

  const vault = (name: string, kind: Vault['kind'], institution: string, icon: string, color: Vault['color'], initial: number): Vault =>
    ({ id: uid(), name, kind, institution, icon, color, initial_balance: initial, archived: false })
  const reserva = vault('Reserva de emergência', 'caixinha', 'Nubank', 'shield', 'green', 4000)
  const viagem = vault('Viagem pro Japão', 'caixinha', 'Nubank', 'plane', 'pink', 0)
  const tesouro = vault('Tesouro Selic', 'fixed', 'Tesouro Direto', 'bank', 'blue', 2000)
  d.vaults = [reserva, viagem, tesouro]

  const goals: Goal[] = [
    { id: uid(), name: 'Reserva de emergência', icon: 'shield', color: 'green', target: 30000, initial: 4000, deadline: format(addMonths(today, 14), 'yyyy-MM-dd') },
    { id: uid(), name: 'Viagem pro Japão', icon: 'plane', color: 'pink', target: 18000, initial: 0, deadline: format(addMonths(today, 20), 'yyyy-MM-dd') },
  ]
  d.goals = goals

  // ---- dividas: a negociar / em pagamento / quitada (historico)
  const debt = (p: Partial<Debt> & Pick<Debt, 'name' | 'creditor' | 'kind' | 'status' | 'icon' | 'color' | 'balance'>): Debt => ({
    id: uid(), original_amount: p.balance, balance_date: format(addMonths(today, -3), 'yyyy-MM-dd'), interest_monthly: 0, min_payment: 0,
    due_day: null, installments_total: null, negotiated_at: null, paid_at: null, note: '', ...p,
  })
  const dCartao = debt({ name: 'Cartão Banco X', creditor: 'Banco X', kind: 'card', status: 'open', icon: 'card', color: 'red', balance: 5200, interest_monthly: 3.5, note: 'Ainda não procurei o banco para negociar.' })
  const dMae = debt({ name: 'Empréstimo da mãe', creditor: 'Mãe', kind: 'personal', status: 'paying', icon: 'heart', color: 'pink', balance: 3000, min_payment: 250, due_day: 10, note: 'Pago todo mês, sem juros.' })
  const dAcordo = debt({ name: 'Acordo Loja Y', creditor: 'Loja Y', kind: 'bank', status: 'paying', icon: 'receipt', color: 'orange', original_amount: 4800, balance: 2400, min_payment: 300, due_day: 15, installments_total: 8, negotiated_at: day(3, 12), balance_date: day(3, 12) })
  const dQuitada = debt({ name: 'Financiamento do notebook', creditor: 'Loja Z', kind: 'loan', status: 'paid', icon: 'laptop', color: 'purple', original_amount: 1800, balance: 1800, min_payment: 300, balance_date: day(9, 5), paid_at: day(3, 20), installments_total: 6 })
  d.debts = [dCartao, dMae, dAcordo, dQuitada]

  // ---- fixos (geram os lancamentos ate o proximo mes)
  const rec = (p: Partial<Recurring> & Pick<Recurring, 'kind' | 'description' | 'amount'>): Recurring => ({
    id: uid(), variable: false, frequency: 'monthly', interval_n: 1, start_date: day(5, 5), generated: 0, count: null, end_date: null,
    category_id: null, source_id: null, nature: null, goal_id: null, debt_id: null, group_id: null, vault_id: null, account_id: null,
    card_id: null, tags: [], note: '', active: true, ...p,
  })
  const recs: Recurring[] = [
    rec({ kind: 'income', description: 'Salário', amount: 6800, start_date: day(5, 5), source_id: src('Salário'), account_id: corrente.id }),
    rec({ kind: 'income', description: 'Vale-alimentação', amount: 900, start_date: day(5, 1), source_id: src('Benefícios'), account_id: vale.id }),
    rec({ kind: 'expense', description: 'Aluguel', amount: 1900, start_date: day(5, 8), category_id: cat('Moradia'), nature: 'fixed', group_id: grp('Casa'), account_id: corrente.id }),
    rec({ kind: 'expense', description: 'Condomínio', amount: 480, start_date: day(5, 8), category_id: cat('Moradia'), nature: 'fixed', group_id: grp('Casa'), account_id: corrente.id }),
    rec({ kind: 'expense', description: 'Internet', amount: 110, start_date: day(5, 12), category_id: cat('Contas'), nature: 'fixed', group_id: grp('Casa'), account_id: corrente.id }),
    rec({ kind: 'expense', description: 'Conta de luz', amount: 180, variable: true, start_date: day(5, 18), category_id: cat('Contas'), nature: 'fixed', group_id: grp('Casa'), account_id: corrente.id, note: 'Valor estimado: confirme o real' }),
    rec({ kind: 'expense', description: 'Netflix + Spotify', amount: 62.8, start_date: day(5, 15), category_id: cat('Assinaturas'), nature: 'fixed', group_id: grp('Minhas'), card_id: meuCartao.id }),
    rec({ kind: 'expense', description: 'Academia', amount: 129, start_date: day(5, 10), category_id: cat('Saúde'), nature: 'fixed', group_id: grp('Minhas'), account_id: corrente.id }),
    rec({ kind: 'expense', description: 'Pagamento para a mãe', amount: 250, start_date: day(3, 10), category_id: cat('Dívidas'), nature: 'fixed', debt_id: dMae.id, group_id: grp('Mãe'), account_id: corrente.id }),
    rec({ kind: 'investment', description: 'Aporte reserva', amount: 800, start_date: day(5, 6), category_id: cat('Reserva de emergência'), goal_id: goals[0].id, vault_id: reserva.id, account_id: corrente.id }),
    rec({ kind: 'investment', description: 'Aporte viagem', amount: 500, start_date: day(5, 6), category_id: cat('Renda fixa'), goal_id: goals[1].id, vault_id: viagem.id, account_id: corrente.id }),
  ]
  const txs: Transaction[] = []
  const monthStart = `${todayStr.slice(0, 7)}-01`
  for (const r of recs) {
    const g = generateFor(r, todayStr)
    r.generated = g.generated
    // contas de valor variavel dos meses passados ja foram confirmadas (so a deste mes fica estimada)
    for (const t of g.txs) if (r.variable && t.date < monthStart) t.paid = true
    txs.push(...g.txs)
  }
  d.recurrings = recs

  // ---- gastos do dia a dia, em contas, vale, carteira e cartoes
  let seed = 7
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  type Pay = { account_id?: string; card_id?: string }
  const spend: [string, string, number, number, Pay, string][] = [
    ['Mercado', 'Supermercado', 3, 330, { card_id: meuCartao.id }, 'Casa'],
    ['Mercado', 'Feira', 3, 65, { account_id: corrente.id }, 'Casa'],
    ['Restaurantes', 'iFood', 6, 46, { account_id: vale.id }, 'Minhas'],
    ['Restaurantes', 'Jantar fora', 1, 150, { card_id: meuCartao.id }, 'Minhas'],
    ['Transporte', 'Uber', 4, 27, { card_id: meuCartao.id }, 'Minhas'],
    ['Transporte', 'Combustível', 2, 200, { account_id: corrente.id }, 'Minhas'],
    ['Lazer', 'Cinema / saída', 2, 70, { card_id: meuCartao.id }, 'Minhas'],
    ['Cuidados', 'Salão', 1, 170, { account_id: carteira.id }, 'Minhas'],
    ['Saúde', 'Farmácia', 2, 60, { account_id: corrente.id }, 'Casa'],
    ['Mercado', 'Compras do mês', 1, 260, { card_id: cartaoLucas.id }, 'Lucas'],
    ['Lazer', 'Streaming do Lucas', 1, 45, { card_id: cartaoLucas.id }, 'Lucas'],
  ]
  for (let back = 5; back >= 0; back--) {
    const m = ym(back)
    for (const [c, desc, times, base, pay, group] of spend) {
      for (let i = 0; i < times; i++) {
        const date = clampDay(m, 1 + Math.floor(rnd() * 27))
        if (date > todayStr) continue
        txs.push(makeTx({
          kind: 'expense', date, amount: Math.round(base * (0.6 + rnd() * 0.9) * 100) / 100, description: desc, category_id: cat(c),
          nature: 'variable', group_id: grp(group), paid: true, ...pay,
        }))
      }
    }
    if (back <= 4) txs.push(makeTx({ kind: 'income', date: day(back, 20), amount: Math.round(900 + rnd() * 1800), description: 'Projeto freela', source_id: src('Freelas'), account_id: corrente.id, paid: day(back, 20) <= todayStr }))
    txs.push(makeTx({ kind: 'transfer', date: day(back, 9), amount: 200, description: 'Para a carteira', account_id: corrente.id, to_account_id: carteira.id, paid: day(back, 9) <= todayStr }))
  }
  txs.push(makeTx({ kind: 'expense', date: format(addMonths(today, 0), 'yyyy-MM-dd'), amount: 89.9, description: 'Presente de aniversário', category_id: cat('Compras'), nature: 'variable', group_id: grp('Minhas'), card_id: meuCartao.id }))

  // ---- compras parceladas no cartao
  txs.push(...buildInstallments({ kind: 'expense', description: 'Notebook', category_id: cat('Compras'), nature: 'variable', group_id: grp('Minhas'), card_id: meuCartao.id }, day(2, 14), 5200, 10, 'total', todayStr))
  txs.push(...buildInstallments({ kind: 'expense', description: 'Sofá', category_id: cat('Moradia'), nature: 'variable', group_id: grp('Casa'), card_id: cartaoLucas.id }, day(1, 20), 450, 6, 'parcela', todayStr))

  // ---- acordo negociado (parcelas na agenda) e financiamento quitado (historico)
  txs.push(...buildInstallments({ kind: 'expense', description: 'Acordo Loja Y', category_id: cat('Dívidas'), nature: 'fixed', debt_id: dAcordo.id, account_id: corrente.id, group_id: grp('Minhas') }, day(3, 15), 300, 8, 'parcela', todayStr))
  txs.push(...buildInstallments({ kind: 'expense', description: 'Financiamento notebook', category_id: cat('Dívidas'), nature: 'fixed', debt_id: dQuitada.id, account_id: corrente.id }, day(8, 5), 300, 6, 'parcela', todayStr))

  // ---- caixinhas: rendimentos mensais
  for (let back = 5; back >= 0; back--) {
    const end = format(endOfMonth(addMonths(today, -back)), 'yyyy-MM-dd')
    const date = end > todayStr ? todayStr : end
    for (const [v, base] of [[reserva, 36], [viagem, 9], [tesouro, 19]] as const) {
      txs.push(makeTx({ kind: 'yield', date, amount: Math.round((base * (1 + (5 - back) * 0.12) + rnd() * 4) * 100) / 100, description: 'Rendimento', vault_id: v.id }))
    }
  }
  txs.push(makeTx({ kind: 'investment', date: day(4, 12), amount: 2000, description: 'Aporte Tesouro Selic', vault_id: tesouro.id, account_id: corrente.id, category_id: cat('Renda fixa') }))
  txs.push(makeTx({ kind: 'redeem', date: day(1, 22), amount: 300, description: 'Resgate para emergência', vault_id: reserva.id, account_id: corrente.id }))

  // ---- pagamento das faturas ja vencidas
  for (const c of d.cards) {
    const keys = new Set<string>()
    for (const t of txs) if (t.kind === 'expense' && t.card_id === c.id) keys.add(invoiceKeyOf(c, t.date))
    for (const key of keys) {
      const due = dueDateOf(c, key)
      if (due >= todayStr) continue
      const total = txs.filter((t) => t.kind === 'expense' && t.card_id === c.id && invoiceKeyOf(c, t.date) === key).reduce((a, t) => a + t.amount, 0)
      txs.push(makeTx({ kind: 'transfer', date: due, amount: Math.round(total * 100) / 100, description: `Fatura ${c.name}`, account_id: corrente.id, card_id: c.id, invoice_month: key }))
    }
  }
  d.transactions = txs

  d.templates = [
    { id: uid(), name: 'Uber', kind: 'expense', description: 'Uber', amount: 27, category_id: cat('Transporte'), source_id: null, nature: 'variable', group_id: grp('Minhas'), vault_id: null, account_id: null, card_id: meuCartao.id },
    { id: uid(), name: 'iFood', kind: 'expense', description: 'iFood', amount: 46, category_id: cat('Restaurantes'), source_id: null, nature: 'variable', group_id: grp('Minhas'), vault_id: null, account_id: vale.id, card_id: null },
    { id: uid(), name: 'Mercado', kind: 'expense', description: 'Supermercado', amount: null, category_id: cat('Mercado'), source_id: null, nature: 'variable', group_id: grp('Casa'), vault_id: null, account_id: null, card_id: meuCartao.id },
  ]

  d.budgets = ([['Mercado', 1100], ['Restaurantes', 500], ['Transporte', 450], ['Lazer', 300], ['Compras', 400], ['Cuidados', 250]] as [string, number][])
    .map(([c, amount]) => ({ id: uid(), category_id: cat(c), amount })) as Budget[]
  return d
}
