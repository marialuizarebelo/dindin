import { emptyData, TABLES, type Data, type TableName } from './types'
import { supabase } from './supabase'

export interface Adapter {
  load(): Promise<Data>
  upsert(table: TableName, rows: object[]): Promise<void>
  /** Atualizacao parcial de uma linha existente (nao usa upsert: o Postgres exige as colunas NOT NULL no INSERT). */
  update(table: TableName, id: string, patch: object): Promise<void>
  remove(table: TableName, ids: string[]): Promise<void>
  clear(): Promise<void>
}

const LS_KEY = 'dindin:data:v1'

/** Modo demonstracao: tudo fica no localStorage deste navegador. */
export const localAdapter: Adapter = {
  async load() {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? { ...emptyData(), ...JSON.parse(raw) } : emptyData()
    } catch {
      return emptyData()
    }
  },
  async upsert(table, rows) {
    const data = await this.load()
    const list = data[table] as { id: string }[]
    for (const row of rows as { id: string }[]) {
      const i = list.findIndex((r) => r.id === row.id)
      if (i >= 0) list[i] = { ...list[i], ...row }
      else list.push(row)
    }
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  },
  async update(table, id, patch) {
    await this.upsert(table, [{ ...patch, id }])
  },
  async remove(table, ids) {
    const data = await this.load()
    ;(data[table] as { id: string }[]) = (data[table] as { id: string }[]).filter((r) => !ids.includes(r.id))
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  },
  async clear() {
    localStorage.removeItem(LS_KEY)
  },
}

const PAGE = 1000

/** Supabase: cada linha pertence a quem esta logada (RLS no banco, ver supabase/schema.sql). */
export const cloudAdapter: Adapter = {
  async load() {
    const data = emptyData()
    await Promise.all(
      TABLES.map(async (t) => {
        const out: unknown[] = []
        for (let from = 0; ; from += PAGE) {
          const { data: rows, error } = await supabase!.from(t).select('*').range(from, from + PAGE - 1)
          if (error) throw new Error(`${t}: ${error.message}`)
          out.push(...(rows ?? []))
          if (!rows || rows.length < PAGE) break
        }
        ;(data[t] as unknown[]) = out
      }),
    )
    return data
  },
  async upsert(table, rows) {
    if (!rows.length) return
    const { error } = await supabase!.from(table).upsert(rows as never[], { onConflict: 'id' })
    if (error) throw new Error(error.message)
  },
  async update(table, id, patch) {
    const { error } = await supabase!.from(table).update(patch as never).eq('id', id)
    if (error) throw new Error(error.message)
  },
  async remove(table, ids) {
    if (!ids.length) return
    const { error } = await supabase!.from(table).delete().in('id', ids)
    if (error) throw new Error(error.message)
  },
  async clear() {
    for (const t of [...TABLES].reverse()) {
      const { error } = await supabase!.from(t).delete().not('id', 'is', null)
      if (error) throw new Error(error.message)
    }
  },
}
