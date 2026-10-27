import { useMemo } from 'react'
import { useStore } from './store'
import type { Category, ColorKey, Source, Transaction } from './types'

export interface Label { name: string; icon: string; color: ColorKey }

/** Nome/icone/cor de um lancamento, venha de categoria (despesa) ou origem (receita). */
export function useLookup() {
  const { data } = useStore()
  return useMemo(() => {
    const cats = new Map<string, Category>(data.categories.map((c) => [c.id, c]))
    const srcs = new Map<string, Source>(data.sources.map((s) => [s.id, s]))
    const label = (t: Pick<Transaction, 'kind' | 'category_id' | 'source_id'>): Label => {
      if (t.kind === 'income') {
        const s = t.source_id ? srcs.get(t.source_id) : undefined
        return s ? { name: s.name, icon: s.icon, color: s.color } : { name: 'Sem origem', icon: 'wallet', color: 'gray' }
      }
      const c = t.category_id ? cats.get(t.category_id) : undefined
      return c ? { name: c.name, icon: c.icon, color: c.color } : { name: 'Sem categoria', icon: 'circle', color: 'gray' }
    }
    return { cats, srcs, label }
  }, [data.categories, data.sources])
}
