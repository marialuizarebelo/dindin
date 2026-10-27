import type { ColorKey } from './types'

/** Paleta suave estilo Notion. Tons de fundo/texto sao derivados em CSS (ver .tag). */
export const COLORS: Record<ColorKey, string> = {
  gray: '#9b9a97',
  brown: '#b08968',
  orange: '#f0a050',
  yellow: '#e9c24c',
  green: '#5fba8c',
  teal: '#4fb6b2',
  blue: '#5b9cf2',
  purple: '#9d7ee8',
  pink: '#ee80b3',
  red: '#ef7471',
}
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[]
export const solid = (c: ColorKey) => COLORS[c] ?? COLORS.gray
