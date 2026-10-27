import { describe, expect, it } from 'vitest'
import { buckets, rangeOf, shift, labelOf, clampDay } from './period'
import { simulatePayoff } from './debt'
import { parseMoney } from './format'

describe('period', () => {
  it('semestre e trimestre', () => {
    expect(rangeOf({ gran: 'semester', anchor: '2026-08-15' })).toEqual({ start: '2026-07-01', end: '2026-12-31' })
    expect(rangeOf({ gran: 'quarter', anchor: '2026-05-10' })).toEqual({ start: '2026-04-01', end: '2026-06-30' })
  })
  it('semana comeca na segunda', () => {
    expect(rangeOf({ gran: 'week', anchor: '2026-10-27' })).toEqual({ start: '2026-10-26', end: '2026-11-01' })
  })
  it('navegacao e buckets', () => {
    expect(shift({ gran: 'month', anchor: '2026-01-31' }, 1).anchor).toBe('2026-02-28')
    expect(buckets({ gran: 'year', anchor: '2026-03-01' })).toHaveLength(12)
    expect(buckets({ gran: 'month', anchor: '2026-02-10' })).toHaveLength(28)
    expect(labelOf({ gran: 'quarter', anchor: '2026-05-10' })).toBe('2º trimestre 2026')
  })
  it('clampDay', () => {
    expect(clampDay('2026-02', 31)).toBe('2026-02-28')
  })
})

describe('parseMoney', () => {
  it('entende formatos brasileiros', () => {
    expect(parseMoney('1.234,56')).toBe(1234.56)
    expect(parseMoney('12,5')).toBe(12.5)
    expect(parseMoney('12.50')).toBe(12.5)
    expect(parseMoney('1.234')).toBe(1234)
    expect(parseMoney('')).toBeNaN()
  })
})

describe('simulatePayoff', () => {
  const debts = [
    { id: 'a', name: 'Cartao', balance: 3000, rate: 12, minPayment: 150 },
    { id: 'b', name: 'Emprestimo', balance: 1000, rate: 3, minPayment: 100 },
  ]
  it('quita tudo e avalanche paga menos juros que bola de neve', () => {
    const av = simulatePayoff(debts, 800, 'avalanche')
    const sn = simulatePayoff(debts, 800, 'snowball')
    expect(av.feasible).toBe(true)
    expect(av.totalInterest).toBeLessThanOrEqual(sn.totalInterest)
    expect(sn.order[0]).toBe('b')
  })
  it('orcamento menor que minimos usa os minimos', () => {
    const easy = [
      { id: 'a', name: 'Cartao', balance: 3000, rate: 2, minPayment: 150 },
      { id: 'b', name: 'Emprestimo', balance: 1000, rate: 3, minPayment: 100 },
    ]
    const r = simulatePayoff(easy, 10, 'avalanche')
    expect(r.feasible).toBe(true)
  })
  it('juros maiores que pagamento nao quita', () => {
    const r = simulatePayoff([{ id: 'x', name: 'x', balance: 10000, rate: 10, minPayment: 100 }], 100, 'avalanche')
    expect(r.feasible).toBe(false)
  })
})
