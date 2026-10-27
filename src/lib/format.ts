import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlInt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "Modo discreto": enquanto ligado, todo valor em reais vira pontinhos (texto, graficos, dicas, avisos). */
let masked = false
export const setMasked = (v: boolean) => { masked = v }
export const MASK = '••••'

export const money = (v: number) => (masked ? `R$ ${MASK}` : brl.format(v))
export const moneyInt = (v: number) => (masked ? `R$ ${MASK}` : brlInt.format(v))
export const plain = (v: number) => (masked ? MASK : num.format(v))

/** 1.2k, 3,4 mi... para eixos de graficos. */
export function compact(v: number): string {
  if (masked) return '••'
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (a >= 10_000) return `${Math.round(v / 1000)} mil`
  if (a >= 1_000) return `${(v / 1000).toFixed(1).replace('.', ',')} mil`
  return String(Math.round(v))
}

export const percent = (v: number, digits = 0) => `${(v * 100).toFixed(digits).replace('.', ',')}%`

export const fmtDate = (iso: string, pattern = "d 'de' MMM") =>
  format(parseISO(iso), pattern, { locale: ptBR })

export const fmtDay = (iso: string) => format(parseISO(iso), "EEEE, d 'de' MMMM", { locale: ptBR })

/** Converte o texto digitado ("1.234,56", "12,5", "12.50") em numero. */
export function parseMoney(input: string): number {
  let s = input.replace(/[^\d.,-]/g, '')
  if (!s) return NaN
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes('.')) {
    const decimals = s.length - s.lastIndexOf('.') - 1
    s = decimals <= 2 && s.split('.').length === 2 ? s : s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })
