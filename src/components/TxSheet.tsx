import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { format, subDays } from 'date-fns'
import { parseISO } from 'date-fns'
import { useStore } from '../lib/store'
import { money, parseMoney } from '../lib/format'
import { monthKey, todayISO } from '../lib/period'
import type { Kind, Nature, Transaction } from '../lib/types'
import { Chip, ConfirmButton, Field, Seg, Sheet } from './ui'
import { Icon } from './Icon'

type Preset = Partial<Omit<Transaction, 'id'>>
interface Ctx { open: (preset?: Preset) => void; edit: (t: Transaction) => void }
const TxCtx = createContext<Ctx | null>(null)
export const useTxSheet = () => {
  const c = useContext(TxCtx)
  if (!c) throw new Error('useTxSheet fora do provider')
  return c
}

export function TxSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ preset?: Preset; editing?: Transaction; key: number } | null>(null)
  const open = useCallback((preset?: Preset) => setState({ preset, key: Date.now() }), [])
  const edit = useCallback((t: Transaction) => setState({ editing: t, key: Date.now() }), [])
  const value = useMemo(() => ({ open, edit }), [open, edit])
  return (
    <TxCtx.Provider value={value}>
      {children}
      {state && <TxForm key={state.key} preset={state.preset} editing={state.editing} onClose={() => setState(null)} />}
    </TxCtx.Provider>
  )
}

const KINDS: { value: Kind; label: string }[] = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
  { value: 'investment', label: 'Investimento' },
]

function TxForm({ preset, editing, onClose }: { preset?: Preset; editing?: Transaction; onClose: () => void }) {
  const { data, add, update, remove, addRecurring, notify } = useStore()
  const base = editing ?? preset
  const today = todayISO()
  const [kind, setKind] = useState<Kind>(base?.kind ?? 'expense')
  const [amount, setAmount] = useState(base?.amount ? String(base.amount).replace('.', ',') : '')
  const [description, setDescription] = useState(base?.description ?? '')
  const [date, setDate] = useState(base?.date ?? today)
  const [categoryId, setCategoryId] = useState<string | null>(base?.category_id ?? null)
  const [sourceId, setSourceId] = useState<string | null>(base?.source_id ?? null)
  const [nature, setNature] = useState<Nature>(base?.nature ?? 'variable')
  const [paid, setPaid] = useState(base?.paid ?? (base?.date ?? today) <= today)
  const [paidTouched, setPaidTouched] = useState(Boolean(editing))
  const [goalId, setGoalId] = useState<string | null>(base?.goal_id ?? null)
  const [debtId, setDebtId] = useState<string | null>(base?.debt_id ?? null)
  const [repeat, setRepeat] = useState(false)
  const [err, setErr] = useState('')

  const cats = data.categories.filter((c) => c.kind === kind)
  const recent = useMemo(() => {
    const seen = new Map<string, Transaction>()
    for (const t of [...data.transactions].sort((a, b) => (a.date < b.date ? 1 : -1))) {
      const k = t.description.trim().toLowerCase()
      if (k && t.kind === kind && !seen.has(k)) seen.set(k, t)
      if (seen.size >= 80) break
    }
    return seen
  }, [data.transactions, kind])

  const onDescription = (v: string) => {
    setDescription(v)
    const hit = recent.get(v.trim().toLowerCase())
    if (hit && !editing && !categoryId && !sourceId) {
      setCategoryId(hit.category_id)
      setSourceId(hit.source_id)
      if (hit.nature) setNature(hit.nature)
      if (!amount) setAmount(String(hit.amount).replace('.', ','))
    }
  }
  const onDate = (v: string) => {
    setDate(v)
    if (!paidTouched) setPaid(v <= today)
  }
  const changeKind = (k: Kind) => { setKind(k); setCategoryId(null); setSourceId(null); setGoalId(null); setDebtId(null) }

  const submit = (another: boolean) => {
    const value = parseMoney(amount)
    if (!(value > 0)) { setErr('Informe um valor maior que zero'); return }
    if (!date) { setErr('Escolha a data'); return }
    const desc = description.trim() || (kind === 'income' ? 'Receita' : kind === 'investment' ? 'Aporte' : 'Despesa')
    const row = {
      kind, amount: value, description: desc, date, paid,
      category_id: kind === 'income' ? null : categoryId,
      source_id: kind === 'income' ? sourceId : null,
      nature: kind === 'expense' ? nature : null,
      goal_id: kind === 'investment' ? goalId : null,
      debt_id: kind === 'expense' ? debtId : null,
    }
    if (editing) {
      update('transactions', editing.id, row)
      notify('Lançamento atualizado')
    } else if (repeat) {
      addRecurring({
        kind, description: desc, amount: value, day: parseISO(date).getDate(),
        category_id: row.category_id, source_id: row.source_id, nature: row.nature, goal_id: row.goal_id,
        active: true, start_month: monthKey(date), end_month: null,
      })
      notify('Fixo criado — os próximos meses já aparecem')
    } else {
      add('transactions', { ...row, recurring_id: null })
      notify(`${money(value)} salvo`)
    }
    if (another && !editing) {
      setAmount(''); setDescription(''); setErr(''); setRepeat(false)
    } else onClose()
  }

  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const accent = kind === 'income' ? 'var(--c-green)' : kind === 'investment' ? 'var(--c-blue)' : 'var(--c-red)'

  return (
    <Sheet open onClose={onClose} title={editing ? 'Editar lançamento' : 'Novo lançamento'}
      footer={
        <>
          {editing && (
            <ConfirmButton className="mr-auto" onConfirm={() => { remove('transactions', [editing.id]); notify('Lançamento apagado'); onClose() }}>Apagar</ConfirmButton>
          )}
          {!editing && <button className="btn" onClick={() => submit(true)}>Salvar e novo</button>}
          <button className="btn btn-primary" onClick={() => submit(false)}>{editing ? 'Salvar' : 'Salvar'}</button>
        </>
      }>
      <div className="flex flex-col gap-4">
        <Seg<Kind> full value={kind} onChange={changeKind} options={KINDS} />

        <div className="text-center py-1">
          <div className="flex items-baseline justify-center gap-1.5" style={{ color: accent }}>
            <span className="text-xl font-medium opacity-70">R$</span>
            <input autoFocus={!editing} inputMode="decimal" placeholder="0,00" value={amount}
              onChange={(e) => { setAmount(e.target.value); setErr('') }}
              onKeyDown={(e) => e.key === 'Enter' && submit(false)}
              className="num bg-transparent border-0 outline-none text-center text-[44px] font-bold w-[min(280px,70%)] placeholder:opacity-30"
              style={{ color: accent }} aria-label="Valor" />
          </div>
          {err && <div className="text-[13px] text-expense mt-1">{err}</div>}
        </div>

        <Field label="Descrição">
          <input className="input" list="desc-list" placeholder={kind === 'income' ? 'Ex: Salário, projeto X' : kind === 'investment' ? 'Ex: Aporte mensal' : 'Ex: Mercado, aluguel'}
            value={description} onChange={(e) => onDescription(e.target.value)} />
          <datalist id="desc-list">{[...recent.values()].map((t) => <option key={t.id} value={t.description} />)}</datalist>
        </Field>

        {kind === 'income' ? (
          <Field label="Origem">
            <div className="flex flex-wrap gap-2">
              {data.sources.map((s) => (
                <Chip key={s.id} color={s.color} active={sourceId === s.id} onClick={() => setSourceId(sourceId === s.id ? null : s.id)}><Icon name={s.icon} size={15} /> {s.name}</Chip>
              ))}
            </div>
          </Field>
        ) : (
          <Field label="Categoria">
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <Chip key={c.id} color={c.color} active={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}><Icon name={c.icon} size={15} /> {c.name}</Chip>
              ))}
            </div>
          </Field>
        )}

        {kind === 'expense' && (
          <Field label="Tipo">
            <Seg<Nature> full value={nature} onChange={setNature} options={[{ value: 'variable', label: 'Variável' }, { value: 'fixed', label: 'Fixa' }]} />
          </Field>
        )}

        <Field label="Data">
          <div className="flex gap-2 items-center">
            <input type="date" className="input" value={date} onChange={(e) => onDate(e.target.value)} />
            <button type="button" className="btn btn-sm" onClick={() => onDate(today)}>Hoje</button>
            <button type="button" className="btn btn-sm" onClick={() => onDate(yesterday)}>Ontem</button>
          </div>
        </Field>

        {kind === 'investment' && data.goals.length > 0 && (
          <Field label="Para qual meta? (opcional)">
            <select className="input" value={goalId ?? ''} onChange={(e) => setGoalId(e.target.value || null)}>
              <option value="">Sem meta</option>
              {data.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
        )}
        {kind === 'expense' && data.debts.length > 0 && (
          <Field label="É pagamento de dívida? (opcional)">
            <select className="input" value={debtId ?? ''} onChange={(e) => {
              const v = e.target.value || null
              setDebtId(v)
              const dc = data.categories.find((c) => c.name === 'Dívidas')
              if (v && dc && !categoryId) setCategoryId(dc.id)
            }}>
              <option value="">Não</option>
              {data.debts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}

        <div className="flex flex-col gap-1">
          <Toggle checked={paid} onChange={(v) => { setPaid(v); setPaidTouched(true) }}
            label={kind === 'income' ? 'Já recebi' : kind === 'investment' ? 'Já investi' : 'Já paguei'}
            hint={paid ? undefined : 'Fica como pendente até você marcar'} />
          {!editing && (
            <Toggle checked={repeat} onChange={setRepeat} label="Repete todo mês" hint={repeat ? 'Cria um lançamento fixo e gera os próximos meses' : undefined} />
          )}
        </div>
      </div>
    </Sheet>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center justify-between gap-3 py-2 text-left bg-transparent border-0" role="switch" aria-checked={checked}>
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="block text-[12.5px] text-ink2">{hint}</span>}
      </span>
      <span className="relative h-[28px] w-[46px] rounded-full transition-colors shrink-0" style={{ background: checked ? 'var(--c-green)' : 'var(--ink-3)' }}>
        <i className="absolute top-[2px] h-[24px] w-[24px] rounded-full bg-white shadow transition-all" style={{ left: checked ? 20 : 2 }} />
      </span>
    </button>
  )
}
