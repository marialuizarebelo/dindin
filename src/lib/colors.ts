import type { ColorKey } from './types'

/** Paleta suave e quente (tons empoeirados). Manter igual a --c-* em index.css. Tons de fundo/texto sao derivados em CSS (ver .tag). */
export const COLORS: Record<ColorKey, string> = {
  gray: '#a9a7a0',
  brown: '#bb9a7d',
  orange: '#eaa271',
  yellow: '#e3c16f',
  green: '#84b79a',
  teal: '#7bb8b3',
  blue: '#86a4d4',
  purple: '#a99bd8',
  pink: '#dd9db0',
  red: '#e0868a',
}
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[]
export const solid = (c: ColorKey) => COLORS[c] ?? COLORS.gray
