/**
 * Calculadora do campo de valor: "12,50+30", "(45*3)/2", "100 - 20,5". Sem eval.
 * Devolve o resultado arredondado em centavos, ou null se a conta for invalida.
 */
export function evalExpr(input: string): number | null {
  const src = input.replace(/\s+/g, '').replace(/[x×]/gi, '*').replace(/÷/g, '/')
  if (!src || /[^\d.,+\-*/()]/.test(src)) return null
  let i = 0

  const parseNumber = (): number | null => {
    const m = /^\d[\d.,]*|^[.,]\d+/.exec(src.slice(i))
    if (!m) return null
    i += m[0].length
    let s = m[0]
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
    else if (s.includes('.')) {
      const dec = s.length - s.lastIndexOf('.') - 1
      s = dec <= 2 && s.split('.').length === 2 ? s : s.replace(/\./g, '')
    }
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  const factor = (): number | null => {
    if (src[i] === '-') { i++; const v = factor(); return v === null ? null : -v }
    if (src[i] === '+') { i++; return factor() }
    if (src[i] === '(') {
      i++
      const v = expr()
      if (v === null || src[i] !== ')') return null
      i++
      return v
    }
    return parseNumber()
  }
  const term = (): number | null => {
    let v = factor()
    while (v !== null && (src[i] === '*' || src[i] === '/')) {
      const op = src[i++]
      const r = factor()
      if (r === null) return null
      if (op === '/' && r === 0) return null
      v = op === '*' ? v * r : v / r
    }
    return v
  }
  const expr = (): number | null => {
    let v = term()
    while (v !== null && (src[i] === '+' || src[i] === '-')) {
      const op = src[i++]
      const r = term()
      if (r === null) return null
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  const result = expr()
  if (result === null || i !== src.length || !Number.isFinite(result)) return null
  return Math.round(result * 100) / 100
}

/** Tem conta de verdade (e nao so um numero)? */
export const hasOperator = (input: string) => /[+*/()x×÷]|.\s*-/i.test(input.trim())
