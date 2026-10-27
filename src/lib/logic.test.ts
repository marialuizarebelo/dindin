import { describe, expect, it } from 'vitest'
import { evalExpr, hasOperator } from './calc'
import { buildInstallments, installmentDate, splitAmount } from './installments'
import { occurrenceDate, generateFor, expandVirtual, describeRecurrence } from './recurrence'
import { closingDateOf, dueDateOf, invoiceKeyOf, invoiceSummary, cardOutstanding } from './invoices'
import { accountBalance, allVaultsStats, commitments, projectBalance, vaultStats } from './balances'
import { summarize, debtBalance } from './stats'
import { makeTx, isDone } from './tx'
import { emptyData, type Card, type Data, type Recurring } from './types'

const card = (closing: number, due: number): Card => ({
  id: 'c1', name: 'Cartão', icon: 'card', color: 'purple', limit_amount: 5000, closing_day: closing, due_day: due,
  pay_account_id: null, group_id: null, archived: false,
})

describe('calculadora do valor', () => {
  it('faz contas e entende formato brasileiro', () => {
    expect(evalExpr('12,50+30')).toBe(42.5)
    expect(evalExpr('(45*3)/2')).toBe(67.5)
    expect(evalExpr('100 - 20,5')).toBe(79.5)
    expect(evalExpr('1.234,56')).toBe(1234.56)
    expect(evalExpr('2x3')).toBe(6)
    expect(evalExpr('-5+10')).toBe(5)
    expect(evalExpr('12,5')).toBe(12.5)
  })
  it('rejeita o que nao e conta valida', () => {
    expect(evalExpr('5/0')).toBeNull()
    expect(evalExpr('abc')).toBeNull()
    expect(evalExpr('')).toBeNull()
    expect(evalExpr('2+')).toBeNull()
    expect(evalExpr('alert(1)')).toBeNull()
  })
  it('detecta quando ha operacao', () => {
    expect(hasOperator('12+3')).toBe(true)
    expect(hasOperator('12,50')).toBe(false)
  })
})

describe('parcelamento', () => {
  it('divide em centavos exatos', () => {
    expect(splitAmount(100, 3)).toEqual([33.34, 33.33, 33.33])
    expect(splitAmount(0.05, 2)).toEqual([0.03, 0.02])
    for (const [t, n] of [[1234.56, 7], [999.99, 12], [10, 3]] as const) {
      expect(Math.round(splitAmount(t, n).reduce((a, b) => a + b, 0) * 100)).toBe(Math.round(t * 100))
    }
  })
  it('nao desliza o dia nas datas (31/jan -> 28/fev -> 31/mar)', () => {
    expect(installmentDate('2026-01-31', 1)).toBe('2026-02-28')
    expect(installmentDate('2026-01-31', 2)).toBe('2026-03-31')
  })
  it('cria as parcelas com grupo, numeracao e valores', () => {
    const parts = buildInstallments({ kind: 'expense', description: 'Notebook', card_id: 'c1' }, '2026-10-10', 1200, 10, 'total', '2026-10-27')
    expect(parts).toHaveLength(10)
    expect(parts.every((p) => p.installment_group === parts[0].installment_group && p.amount === 120)).toBe(true)
    expect(parts.map((p) => p.installment_no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(parts[1].date).toBe('2026-11-10')
    const asInstallment = buildInstallments({ kind: 'expense', description: 'TV', card_id: 'c1' }, '2026-10-10', 300, 4, 'parcela', '2026-10-27')
    expect(asInstallment.reduce((a, p) => a + p.amount, 0)).toBe(1200)
  })
  it('aceita parcelas irregulares', () => {
    const parts = buildInstallments({ kind: 'expense', description: 'Acordo' }, '2026-10-10', 0, 3, 'parcela', '2026-10-27', [500, 300, 200])
    expect(parts.map((p) => p.amount)).toEqual([500, 300, 200])
  })
})

describe('repeticao', () => {
  const base = { start_date: '2026-01-31', frequency: 'monthly' as const, interval_n: 1 }
  it('conta a partir do inicio', () => {
    expect(occurrenceDate(base, 1)).toBe('2026-02-28')
    expect(occurrenceDate(base, 2)).toBe('2026-03-31')
    expect(occurrenceDate({ start_date: '2026-10-01', frequency: 'weekly', interval_n: 2 }, 1)).toBe('2026-10-15')
    expect(occurrenceDate({ start_date: '2026-10-01', frequency: 'monthly', interval_n: 2 }, 2)).toBe('2027-02-01')
    expect(occurrenceDate({ start_date: '2026-10-01', frequency: 'yearly', interval_n: 1 }, 1)).toBe('2027-10-01')
  })
  const rec = (over: Partial<Recurring> = {}): Recurring => ({
    id: 'r1', kind: 'expense', description: 'Aluguel', amount: 1900, variable: false, frequency: 'monthly', interval_n: 1,
    start_date: '2026-10-05', generated: 0, count: null, end_date: null, category_id: null, source_id: null, nature: 'fixed',
    goal_id: null, debt_id: null, group_id: null, vault_id: null, account_id: null, card_id: null, tags: [], note: '', active: true, ...over,
  })
  it('gera ate o fim do proximo mes, sem duplicar', () => {
    const r = rec()
    const g = generateFor(r, '2026-10-27')
    expect(g.txs.map((t) => t.date)).toEqual(['2026-10-05', '2026-11-05'])
    expect(g.txs.map((t) => t.paid)).toEqual([true, false])
    expect(generateFor({ ...r, generated: g.generated }, '2026-10-27').txs).toHaveLength(0)
    expect(generateFor({ ...r, generated: g.generated }, '2026-11-02').txs.map((t) => t.date)).toEqual(['2026-12-05'])
  })
  it('respeita quantidade, data final, pausa e valor estimado', () => {
    expect(generateFor(rec({ count: 1 }), '2026-10-27').txs).toHaveLength(1)
    expect(generateFor(rec({ end_date: '2026-10-31' }), '2026-10-27').txs).toHaveLength(1)
    expect(generateFor(rec({ active: false }), '2026-10-27').txs).toHaveLength(0)
    expect(generateFor(rec({ variable: true }), '2026-10-27').txs.every((t) => t.paid === false)).toBe(true)
  })
  it('projeta o que ainda nao foi gerado', () => {
    const r = rec({ generated: 2 })
    expect(expandVirtual(r, '2026-10-27', '2027-01-31').map((o) => o.date)).toEqual(['2026-12-05', '2027-01-05'])
  })
  it('descreve em portugues', () => {
    expect(describeRecurrence({ frequency: 'monthly', interval_n: 1, count: null, end_date: null })).toBe('Todo mês')
    expect(describeRecurrence({ frequency: 'monthly', interval_n: 2, count: 6, end_date: null })).toBe('A cada 2 meses, 6x')
  })
})

describe('fatura do cartao', () => {
  it('fecha dia 25 e vence dia 5: compra no fechamento vai para a proxima', () => {
    const c = card(25, 5)
    expect(invoiceKeyOf(c, '2026-10-10')).toBe('2026-11')
    expect(invoiceKeyOf(c, '2026-10-24')).toBe('2026-11')
    expect(invoiceKeyOf(c, '2026-10-25')).toBe('2026-12')
    expect(closingDateOf(c, '2026-11')).toBe('2026-10-25')
    expect(dueDateOf(c, '2026-11')).toBe('2026-11-05')
  })
  it('fecha dia 5 e vence dia 15 no mesmo mes', () => {
    const c = card(5, 15)
    expect(invoiceKeyOf(c, '2026-10-03')).toBe('2026-10')
    expect(invoiceKeyOf(c, '2026-10-05')).toBe('2026-11')
    expect(closingDateOf(c, '2026-10')).toBe('2026-10-05')
  })
  it('fechamento 31 em mes curto', () => {
    expect(closingDateOf(card(31, 10), '2026-03')).toBe('2026-02-28')
  })
  it('resumo: aberta, fechada, paga, atrasada e limite usado', () => {
    const c = card(25, 5)
    const d: Data = { ...emptyData(), cards: [c], transactions: [
      makeTx({ kind: 'expense', date: '2026-10-10', amount: 300, description: 'A', card_id: 'c1' }),
      makeTx({ kind: 'expense', date: '2026-10-12', amount: 200, description: 'B', card_id: 'c1' }),
      makeTx({ kind: 'expense', date: '2026-12-10', amount: 1000, description: 'Parcela futura', card_id: 'c1', paid: false }),
    ] }
    expect(invoiceSummary(d, c, '2026-11', '2026-10-20').status).toBe('open')
    expect(invoiceSummary(d, c, '2026-11', '2026-10-26').status).toBe('closed')
    expect(invoiceSummary(d, c, '2026-11', '2026-11-06').status).toBe('overdue')
    const s = invoiceSummary(d, c, '2026-11', '2026-10-26')
    expect(s.total).toBe(500)
    expect(cardOutstanding(d, c, '2026-10-26')).toBe(1500) // inclui parcela futura
    d.transactions.push(makeTx({ kind: 'transfer', date: '2026-11-04', amount: 500, description: 'Pgto', card_id: 'c1', account_id: 'a1', invoice_month: '2026-11' }))
    expect(invoiceSummary(d, c, '2026-11', '2026-11-05').status).toBe('paid')
    expect(cardOutstanding(d, c, '2026-11-05')).toBe(1000)
  })
})

describe('saldo de contas e caixinhas', () => {
  const d: Data = {
    ...emptyData(),
    accounts: [
      { id: 'a', name: 'Corrente', kind: 'checking', icon: 'bank', color: 'blue', initial_balance: 100, archived: false },
      { id: 'b', name: 'Vale', kind: 'benefit', icon: 'wallet', color: 'green', initial_balance: 0, archived: false },
    ],
    vaults: [{ id: 'v', name: 'Caixinha', kind: 'caixinha', institution: '', icon: 'piggy', color: 'purple', initial_balance: 0, archived: false }],
    cards: [card(25, 5)],
    transactions: [
      makeTx({ kind: 'income', date: '2026-10-01', amount: 50, description: 'Salario', account_id: 'a' }),
      makeTx({ kind: 'expense', date: '2026-10-02', amount: 20, description: 'Mercado', account_id: 'a' }),
      makeTx({ kind: 'expense', date: '2026-10-03', amount: 999, description: 'No cartao', card_id: 'c1', account_id: null }),
      makeTx({ kind: 'transfer', date: '2026-10-04', amount: 30, description: 'Recarga', account_id: 'a', to_account_id: 'b' }),
      makeTx({ kind: 'investment', date: '2026-10-05', amount: 100, description: 'Aporte', account_id: 'a', vault_id: 'v' }),
      makeTx({ kind: 'redeem', date: '2026-10-06', amount: 20, description: 'Resgate', account_id: 'a', vault_id: 'v' }),
      makeTx({ kind: 'yield', date: '2026-10-07', amount: 5, description: 'Rendimento', vault_id: 'v' }),
      makeTx({ kind: 'yield', date: '2026-10-08', amount: -1, description: 'Ajuste', vault_id: 'v' }),
    ],
  }
  it('saldo por conta considera receita, despesa, transferencia, aporte e resgate (cartao nao mexe na conta)', () => {
    expect(accountBalance(d, d.accounts[0], '2026-10-27')).toBe(100 + 50 - 20 - 30 - 100 + 20)
    expect(accountBalance(d, d.accounts[1], '2026-10-27')).toBe(30)
  })
  it('caixinha: investido, rendimento e total', () => {
    const s = vaultStats(d, d.vaults[0], '2026-10-27')
    expect(s).toMatchObject({ deposited: 100, redeemed: 20, netInvested: 80, yields: 4, balance: 84 })
    expect(s.yieldPct).toBeCloseTo(4 / 80)
    const all = allVaultsStats(d, '2026-10-27')
    expect(all.balance).toBe(84)
    expect(all.netInvested).toBe(80)
  })
})

describe('resumo', () => {
  it('ignora transferencias e separa rendimento/resgate; parcela de cartao futura e pendente', () => {
    const txs = [
      makeTx({ kind: 'income', date: '2026-10-01', amount: 1000, description: 'a' }),
      makeTx({ kind: 'expense', date: '2026-10-02', amount: 100, description: 'b', nature: 'variable' }),
      makeTx({ kind: 'expense', date: '2026-10-03', amount: 200, description: 'cartao hoje', card_id: 'c1', paid: false }),
      makeTx({ kind: 'expense', date: '2026-11-03', amount: 300, description: 'cartao futuro', card_id: 'c1', paid: false }),
      makeTx({ kind: 'transfer', date: '2026-10-04', amount: 500, description: 't' }),
      makeTx({ kind: 'yield', date: '2026-10-05', amount: 7, description: 'y' }),
      makeTx({ kind: 'redeem', date: '2026-10-06', amount: 50, description: 'r' }),
    ]
    const s = summarize(txs, '2026-10-27')
    expect(s).toMatchObject({ income: 1000, expense: 300, yield: 7, redeemed: 50, pendingExpense: 300 })
    expect(isDone(txs[2], '2026-10-27')).toBe(true)
    expect(isDone(txs[3], '2026-10-27')).toBe(false)
  })
})

describe('previsao de saldo', () => {
  it('desconta fatura no vencimento, soma recebimentos e acha o ponto mais baixo', () => {
    const d: Data = {
      ...emptyData(),
      accounts: [{ id: 'a', name: 'Corrente', kind: 'checking', icon: 'bank', color: 'blue', initial_balance: 1000, archived: false }],
      cards: [card(25, 5)],
      transactions: [
        makeTx({ kind: 'expense', date: '2026-10-10', amount: 800, description: 'Compra', card_id: 'c1' }), // fatura 2026-11 vence 05/11
        makeTx({ kind: 'income', date: '2026-11-10', amount: 3000, description: 'Salario', account_id: 'a', paid: false }),
        makeTx({ kind: 'expense', date: '2026-10-30', amount: 500, description: 'Aluguel', account_id: 'a', paid: false }),
      ],
    }
    const p = projectBalance(d, '2026-10-27', 30)
    expect(p.start).toBe(1000)
    expect(p.points.find((x) => x.date === '2026-10-30')!.balance).toBe(500)
    expect(p.points.find((x) => x.date === '2026-11-05')!.balance).toBe(-300)
    expect(p.min).toEqual({ date: '2026-11-05', balance: -300 })
    expect(p.firstNegative?.date).toBe('2026-11-05')
    expect(p.points.at(-1)!.balance).toBe(2700) // 27/10 + 30 = 26/11
  })
})

describe('comprometido nos proximos meses', () => {
  it('separa parcelas, fixos e outros', () => {
    const parts = buildInstallments({ kind: 'expense', description: 'TV', card_id: 'c1' }, '2026-10-10', 1200, 4, 'total', '2026-10-27')
    const d: Data = { ...emptyData(), cards: [card(25, 5)], transactions: [
      ...parts,
      makeTx({ kind: 'expense', date: '2026-11-05', amount: 100, description: 'Internet', recurring_id: 'r1', paid: false, account_id: 'a' }),
      makeTx({ kind: 'expense', date: '2026-11-20', amount: 50, description: 'Dentista', paid: false, account_id: 'a' }),
    ] }
    const c = commitments(d, '2026-10-27', 3)
    const nov = c.find((x) => x.key === '2026-11')!
    expect(nov).toMatchObject({ installments: 300, recurring: 100, other: 50, total: 450 })
    expect(c.find((x) => x.key === '2026-10')!.installments).toBe(0) // a de 10/10 ja passou
  })
})

describe('divida', () => {
  it('saldo = saldo informado - pagamentos feitos desde a data; quitada vale zero', () => {
    const d: Data = { ...emptyData(), debts: [{
      id: 'd1', name: 'Mãe', creditor: 'Mãe', kind: 'personal', status: 'paying', icon: 'heart', color: 'pink', original_amount: 3000,
      balance: 3000, balance_date: '2026-10-01', interest_monthly: 0, min_payment: 250, due_day: 10, installments_total: null,
      negotiated_at: null, paid_at: null, note: '',
    }], transactions: [
      makeTx({ kind: 'expense', date: '2026-09-10', amount: 999, description: 'antes do saldo', debt_id: 'd1' }),
      makeTx({ kind: 'expense', date: '2026-10-10', amount: 250, description: 'pgto', debt_id: 'd1' }),
      makeTx({ kind: 'expense', date: '2026-12-10', amount: 250, description: 'futuro', debt_id: 'd1', paid: false }),
    ] }
    expect(debtBalance(d, 'd1')).toBe(2750)
    d.debts[0].status = 'paid'
    expect(debtBalance(d, 'd1')).toBe(0)
  })
})
