import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cloudAdapter, localAdapter, type Adapter } from './db'
import { cloudEnabled } from './supabase'
import { defaultCategories, defaultSources, demoData } from './seed'
import { setMasked, uid } from './format'
import { clampDay, monthKey, nextMonthKey, todayISO } from './period'
import type { Data, Recurring, TableName, Transaction } from './types'
import { emptyData } from './types'

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
  addRecurring: (r: Omit<Recurring, 'id' | 'last_generated'>) => void
  update: <T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) => void
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
      let d = await adapter.load()
      // primeira vez: categorias e origens padrao
      if (!d.categories.length && !d.sources.length && !d.transactions.length) {
        const categories = defaultCategories()
        const sources = defaultSources()
        await adapter.upsert('categories', categories)
        await adapter.upsert('sources', sources)
        d = { ...d, categories, sources }
      }
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
      const rec: Recurring = { ...r, id: uid(), last_generated: null }
      const { txs, last } = generateFor(rec, dataRef.current.transactions)
      rec.last_generated = last
      setData((d) => ({ ...d, recurrings: [...d.recurrings, rec], transactions: [...d.transactions, ...txs] }))
      persist(async () => {
        await adapter.upsert('recurrings', [rec])
        await adapter.upsert('transactions', txs)
      })
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

  const remove: Store['remove'] = useCallback(
    (table, ids) => {
      setData((d) => ({ ...d, [table]: (d[table] as { id: string }[]).filter((r) => !ids.includes(r.id)) }) as Data)
      persist(() => adapter.remove(table, ids))
    },
    [adapter, persist],
  )

  const loadDemo = useCallback(async () => {
    await adapter.clear()
    const d = demoData()
    for (const t of ['categories', 'sources', 'goals', 'debts', 'recurrings', 'transactions', 'budgets'] as TableName[]) {
      await adapter.upsert(t, d[t] as object[])
    }
    setData(d)
    notify('Dados de exemplo carregados')
  }, [adapter, notify])

  const wipe = useCallback(async () => {
    await adapter.clear()
    const categories = defaultCategories()
    const sources = defaultSources()
    await adapter.upsert('categories', categories)
    await adapter.upsert('sources', sources)
    setData({ ...emptyData(), categories, sources })
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
      data, status, error, demo: !cloudEnabled, toasts, notify, add, addMany, addRecurring, update, remove,
      reload, loadDemo, wipe, hidden, toggleHidden,
    }),
    [data, status, error, toasts, notify, add, addMany, addRecurring, update, remove, reload, loadDemo, wipe, hidden, toggleHidden],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * Gera os lancamentos das despesas/receitas fixas ate o proximo mes.
 * `last_generated` evita recriar o que voce apagou de proposito.
 */
export function generateFor(r: Recurring, existing: Transaction[], today = todayISO()): { txs: Transaction[]; last: string | null } {
  const limit = nextMonthKey(monthKey(today))
  const txs: Transaction[] = []
  if (!r.active) return { txs, last: r.last_generated }
  let m = r.last_generated ? nextMonthKey(r.last_generated) : r.start_month
  if (m < r.start_month) m = r.start_month
  let last = r.last_generated
  while (m <= limit && (!r.end_month || m <= r.end_month)) {
    const date = clampDay(m, r.day)
    const exists = existing.some((t) => t.recurring_id === r.id && monthKey(t.date) === m)
    if (!exists) {
      txs.push({
        id: uid(), kind: r.kind, date, amount: r.amount, description: r.description,
        category_id: r.category_id, source_id: r.source_id, nature: r.nature,
        paid: date <= today, goal_id: r.goal_id, debt_id: null, recurring_id: r.id,
      })
    }
    last = m
    m = nextMonthKey(m)
  }
  return { txs, last }
}

async function materializeRecurring(d: Data, adapter: Adapter): Promise<Data> {
  const newTx: Transaction[] = []
  const updated: { id: string; last_generated: string }[] = []
  for (const r of d.recurrings) {
    const { txs, last } = generateFor(r, d.transactions)
    newTx.push(...txs)
    if (last && last !== r.last_generated) updated.push({ id: r.id, last_generated: last })
  }
  if (!newTx.length && !updated.length) return d
  if (newTx.length) await adapter.upsert('transactions', newTx)
  for (const u of updated) await adapter.update('recurrings', u.id, { last_generated: u.last_generated })
  return {
    ...d,
    transactions: [...d.transactions, ...newTx],
    recurrings: d.recurrings.map((r) => {
      const u = updated.find((x) => x.id === r.id)
      return u ? { ...r, last_generated: u.last_generated } : r
    }),
  }
}
