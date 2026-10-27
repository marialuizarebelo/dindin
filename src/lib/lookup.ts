import { useMemo } from 'react'
import { useStore } from './store'
import type { Account, Card, Category, ColorKey, Group, Source, Transaction, Vault } from './types'

export interface Label { name: string; icon: string; color: ColorKey }

/** Nome/icone/cor de categorias, origens, contas, cartoes, grupos e caixinhas. */
export function useLookup() {
  const { data } = useStore()
  return useMemo(() => {
    const cats = new Map<string, Category>(data.categories.map((c) => [c.id, c]))
    const srcs = new Map<string, Source>(data.sources.map((s) => [s.id, s]))
    const accounts = new Map<string, Account>(data.accounts.map((a) => [a.id, a]))
    const cards = new Map<string, Card>(data.cards.map((c) => [c.id, c]))
    const groups = new Map<string, Group>(data.groups.map((g) => [g.id, g]))
    const vaults = new Map<string, Vault>(data.vaults.map((v) => [v.id, v]))

    /** Categoria (despesa) ou origem (receita) do lancamento; transferencias e caixinhas tem rotulo proprio. */
    const label = (t: Pick<Transaction, 'kind' | 'category_id' | 'source_id' | 'vault_id'>): Label => {
      if (t.kind === 'income') {
        const s = t.source_id ? srcs.get(t.source_id) : undefined
        return s ? { name: s.name, icon: s.icon, color: s.color } : { name: 'Sem origem', icon: 'wallet', color: 'gray' }
      }
      if (t.kind === 'transfer') return { name: 'Transferência', icon: 'repeat', color: 'gray' }
      if (t.kind === 'yield' || t.kind === 'redeem' || t.kind === 'investment') {
        const v = t.vault_id ? vaults.get(t.vault_id) : undefined
        if (v) return { name: v.name, icon: v.icon, color: v.color }
        if (t.kind === 'investment' && t.category_id && cats.get(t.category_id)) {
          const c = cats.get(t.category_id)!
          return { name: c.name, icon: c.icon, color: c.color }
        }
        return { name: 'Caixinha', icon: 'piggy', color: 'purple' }
      }
      const c = t.category_id ? cats.get(t.category_id) : undefined
      return c ? { name: c.name, icon: c.icon, color: c.color } : { name: 'Sem categoria', icon: 'circle', color: 'gray' }
    }
    /** De onde saiu / onde entrou: conta ou cartao. */
    const where = (t: Pick<Transaction, 'account_id' | 'card_id'>): Label | null => {
      if (t.card_id) { const c = cards.get(t.card_id); if (c) return { name: c.name, icon: c.icon, color: c.color } }
      if (t.account_id) { const a = accounts.get(t.account_id); if (a) return { name: a.name, icon: a.icon, color: a.color } }
      return null
    }
    return { cats, srcs, accounts, cards, groups, vaults, label, where }
  }, [data.categories, data.sources, data.accounts, data.cards, data.groups, data.vaults])
}
