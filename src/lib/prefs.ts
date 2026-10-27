import { useEffect, useState } from 'react'

const KEY = 'dindin:name'
const EVT = 'dindin:name-changed'

const read = () => {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}

/** Como a usuaria quer ser chamada (guardado so neste aparelho). */
export function useName(): string {
  const [name, setName] = useState(read)
  useEffect(() => {
    const on = () => setName(read())
    window.addEventListener(EVT, on)
    return () => window.removeEventListener(EVT, on)
  }, [])
  return name
}

export function saveName(v: string) {
  try { localStorage.setItem(KEY, v.trim()) } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT))
}

export type PaletteId = 'musgo' | 'lilas' | 'nevoa'
export const PALETTES: { id: PaletteId; name: string; hint: string; swatch: [string, string, string] }[] = [
  { id: 'musgo', name: 'Musgo', hint: 'verde-musgo, linho e terracota', swatch: ['#1d3830', '#cf7248', '#84b79a'] },
  { id: 'lilas', name: 'Lilás', hint: 'violeta-tinta, lavanda e damasco', swatch: ['#2b2443', '#dc8456', '#a99bd8'] },
  { id: 'nevoa', name: 'Névoa', hint: 'ardósia, cinza-azulado e índigo', swatch: ['#232c3d', '#6571d8', '#86a4d4'] },
]

export function getPalette(): PaletteId {
  try {
    const v = localStorage.getItem('dindin:palette')
    if (v === 'musgo' || v === 'lilas' || v === 'nevoa') return v
  } catch { /* ignore */ }
  return 'musgo'
}

export function setPalette(id: PaletteId) {
  document.documentElement.dataset.palette = id
  try { localStorage.setItem('dindin:palette', id) } catch { /* ignore */ }
  window.dispatchEvent(new Event('dindin:palette-changed'))
}

export function usePalette(): PaletteId {
  const [p, setP] = useState<PaletteId>(getPalette)
  useEffect(() => {
    const on = () => setP(getPalette())
    window.addEventListener('dindin:palette-changed', on)
    return () => window.removeEventListener('dindin:palette-changed', on)
  }, [])
  return p
}
