import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cloudAdapter, localAdapter, type Adapter } from './db'
import { cloudEnabled } from './supabase'
import { defaultAccount, defaultCategories, defaultGroups, defaultSources, demoData } from './seed'
import { setMasked, uid } from './format'
import { todayISO } from './period'
import { normalizeData } from './normalize'
import { generateFor } from './recurrence'
import { emptyData, TABLES, type Data, type Recurring, type TableName, type Transaction } from './types'

type Row<T extends TableName> = Data[T][number]
type NewRow<T extends TableName> = Omit<Row<T>, 'id'> & { id?: string }

interface Toast { id: number; text: string; tone: 'ok' | 'error' }

interface Store {
  data: Data
  status: 'loading' | 'ready' | 'error'
  error: string | null
  demo: boolean
  toasts: Toast[]
  notify: (text: string, tone?: Toast['tone']) => void
  add: <T extends TableName>(table: T, row: NewRow<T>) => Row<T>
  addMany: <T extends TableName>(table: T, rows: NewRow<T>[]) => void
  /** Cria o fixo e ja gera os lancamentos ate o fim do proximo mes. */
  addRecurring: (r: Omit<Recurring, 'id' | 'generated'>) => Recurring
  update: <T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) => void
  updateMany: <T extends TableName>(table: T, items: { id: string; patch: Partial<Row<T>> }[]) => void
  remove: (table: TableName, ids: string[]) => void
  reload: () => Promise<void>
  loadDemo: () => Promise<void>
  wipe: () => Promise<void>
  hidden: boolean
  toggleHidden: () => void
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fora do provider')
  return s
}

const SEEDED_KEY = 'dindin:seeded:v2'

export function StoreProvider({ children }: { children: ReactNode }) {
  const adapter: Adapter = cloudEnabled ? cloudAdapter : localAdapter
  const [data, setData] = useState<Data>(emptyData())
  const [status, setStatus] = useState<Store['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('dindin:hidden') === '1' } catch { return false }
  })
  const dataRef = useRef(data)
  dataRef.current = data
  setMasked(hidden) // antes dos filhos renderizarem: money()/compact() ja saem mascarados

  const notify = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const reload = useCallback(async () => {
    try {
      let d = normalizeData(await adapter.load())
      // primeira vez: categorias, origens, grupos e uma conta
      if (!d.categories.length && !d.sources.length && !d.transactions.length) {
        d = { ...d, categories: defaultCategories(), sources: defaultSources() }
        await adapter.upsert('categories', d.categories)
        await adapter.upsert('sources', d.sources)
      }
      let seeded = false
      try { seeded = localStorage.getItem(SEEDED_KEY) === '1' } catch { /* ignore */ }
      if (!seeded && !d.accounts.length && !d.groups.length) {
        d = { ...d, groups: defaultGroups(), accounts: [defaultAccount()] }
        await adapter.upsert('groups', d.groups)
        await adapter.upsert('accounts', d.accounts)
      }
      try { localStorage.setItem(SEEDED_KEY, '1') } catch { /* ignore */ }
      d = await materializeRecurring(d, adapter)
      setData(d)
      setStatus('ready')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void reload() }, [reload])

  const persist = useCallback(
    (fn: () => Promise<void>) => {
      fn().catch((e) => {
        notify(`Não consegui salvar: ${e instanceof Error ? e.message : e}`, 'error')
        void reload()
      })
    },
    [notify, reload],
  )

  const addMany: Store['addMany'] = useCallback(
    (table, rows) => {
      if (!rows.length) return
      const full = rows.map((r) => ({ ...r, id: r.id ?? uid() })) as Row<typeof table>[]
      setData((d) => ({ ...d, [table]: [...(d[table] as unknown[]), ...full] }) as Data)
      persist(() => adapter.upsert(table, full as object[]))
    },
    [adapter, persist],
  )

  const add: Store['add'] = useCallback(
    (table, row) => {
      const full = { ...row, id: row.id ?? uid() } as Row<typeof table>
      setData((d) => ({ ...d, [table]: [...(d[table] as unknown[]), full] }) as Data)
      persist(() => adapter.upsert(table, [full as object]))
      return full
    },
    [adapter, persist],
  )

  const addRecurring: Store['addRecurring'] = useCallback(
    (r) => {
      const rec: Recurring = { ...r, id: uid(), generated: 0 }
      const { txs, generated } = generateFor(rec, todayISO())
      rec.generated = generated
      setData((d) => ({ ...d, recurrings: [...d.recurrings, rec], transactions: [...d.transactions, ...txs] }))
      persist(async () => {
        await adapter.upsert('recurrings', [rec])
        await adapter.upsert('transactions', txs)
      })
      return rec
    },
    [adapter, persist],
  )

  const update: Store['update'] = useCallback(
    (table, id, patch) => {
      setData((d) => ({
        ...d,
        [table]: (d[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }) as Data)
      persist(() => adapter.update(table, id, patch as object))
    },
    [adapter, persist],
  )

  const updateMany: Store['updateMany'] = useCallback(
    (table, items) => {
      if (!items.length) return
      const byId = new Map(items.map((i) => [i.id, i.patch as object]))
      setData((d) => ({
        ...d,
        [table]: (d[table] as { id: string }[]).map((r) => (byId.has(r.id) ? { ...r, ...byId.get(r.id) } : r)),
      }) as Data)
      persist(async () => { await Promise.all(items.map((i) => adapter.update(table, i.id, i.patch as object))) })
    },
    [adapter, persist],
  )

  const remove: Store['remove'] = useCallback(
    (table, ids) => {
      if (!ids.length) return
      setData((d) => ({ ...d, [table]: (d[table] as { id: string }[]).filter((r) => !ids.includes(r.id)) }) as Data)
      persist(() => adapter.remove(table, ids))
    },
    [adapter, persist],
  )

  const loadDemo = useCallback(async () => {
    await adapter.clear()
    const d = demoData()
    for (const t of TABLES) await adapter.upsert(t, d[t] as object[])
    try { localStorage.setItem(SEEDED_KEY, '1') } catch { /* ignore */ }
    setData(d)
    notify('Dados de exemplo carregados')
  }, [adapter, notify])

  const wipe = useCallback(async () => {
    await adapter.clear()
    const fresh = { ...emptyData(), categories: defaultCategories(), sources: defaultSources(), groups: defaultGroups(), accounts: [defaultAccount()] }
    for (const t of TABLES) if ((fresh[t] as unknown[]).length) await adapter.upsert(t, fresh[t] as object[])
    setData(fresh)
    notify('Tudo apagado')
  }, [adapter, notify])

  const toggleHidden = useCallback(() => {
    setHidden((h) => {
      try { localStorage.setItem('dindin:hidden', h ? '0' : '1') } catch { /* ignore */ }
      return !h
    })
  }, [])

  const value = useMemo<Store>(
    () => ({
      data, status, error, demo: !cloudEnabled, toasts, notify, add, addMany, addRecurring, update, updateMany, remove,
      reload, loadDemo, wipe, hidden, toggleHidden,
    }),
    [data, status, error, toasts, notify, add, addMany, addRecurring, update, updateMany, remove, reload, loadDemo, wipe, hidden, toggleHidden],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Gera os lancamentos que faltam dos fixos (ate o fim do proximo mes). `generated` evita recriar o que foi apagado. */
async function materializeRecurring(d: Data, adapter: Adapter): Promise<Data> {
  const today = todayISO()
  const newTx: Transaction[] = []
  const bumped: { id: string; generated: number }[] = []
  for (const r of d.recurrings) {
    const { txs, generated } = generateFor(r, today)
    const fresh = txs.filter((t) => !d.transactions.some((e) => e.recurring_id === r.id && e.date === t.date))
    newTx.push(...fresh)
    if (generated !== r.generated) bumped.push({ id: r.id, generated })
  }
  if (!newTx.length && !bumped.length) return d
  if (newTx.length) await adapter.upsert('transactions', newTx)
  for (const b of bumped) await adapter.update('recurrings', b.id, { generated: b.generated })
  return {
    ...d,
    transactions: [...d.transactions, ...newTx],
    recurrings: d.recurrings.map((r) => {
      const b = bumped.find((x) => x.id === r.id)
      return b ? { ...r, generated: b.generated } : r
    }),
  }
}
