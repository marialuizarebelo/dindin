import { useMemo } from 'react'
import { useStore } from './store'
import type { Category, ColorKey, Source, Transaction } from './types'

export interface Label { name: string; emoji: string; color: ColorKey }

/** Nome/emoji/cor de um lancamento, venha de categoria (despesa) ou origem (receita). */
export function useLookup() {
  const { data } = useStore()
  return useMemo(() => {
    const cats = new Map<string, Category>(data.categories.map((c) => [c.id, c]))
    const srcs = new Map<string, Source>(data.sources.map((s) => [s.id, s]))
    const label = (t: Pick<Transaction, 'kind' | 'category_id' | 'source_id'>): Label => {
      if (t.kind === 'income') {
        const s = t.source_id ? srcs.get(t.source_id) : undefined
        return s ? { name: s.name, emoji: s.emoji, color: s.color } : { name: 'Sem origem', emoji: '💰', color: 'gray' }
      }
      const c = t.category_id ? cats.get(t.category_id) : undefined
      return c ? { name: c.name, emoji: c.emoji, color: c.color } : { name: 'Sem categoria', emoji: '📦', color: 'gray' }
    }
    return { cats, srcs, label }
  }, [data.categories, data.sources])
}
