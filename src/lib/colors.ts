import type { ColorKey } from './types'

/** Paleta suave e quente (tons empoeirados). Manter igual a --c-* em index.css. Tons de fundo/texto sao derivados em CSS (ver .tag). */
export const COLORS: Record<ColorKey, string> = {
  gray: '#aaa29e',
  brown: '#c6a48f',
  orange: '#efb18d',
  yellow: '#e8cc92',
  green: '#9cc5ad',
  teal: '#8dc4c1',
  blue: '#95aedc',
  purple: '#b9a7de',
  pink: '#e8a8be',
  red: '#e29ba0',
}
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[]
export const solid = (c: ColorKey) => COLORS[c] ?? COLORS.gray
