import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useStore } from '../lib/store'
import { money } from '../lib/format'
import { evalExpr } from '../lib/calc'
import { buildInstallments, splitAmount, type InstallmentMode } from '../lib/installments'
import { invoiceKeyOf } from '../lib/invoices'
import { makeTx } from '../lib/tx'
import { todayISO } from '../lib/period'
import type { Frequency, Kind, Nature, Recurring, Transaction } from '../lib/types'
import { AmountInput, Collapsible, fmtInput, ItemPicker, TagsInput, WherePicker } from './TxFields'
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

const TABS: { value: 'expense' | 'income' | 'transfer' | 'vault'; label: string }[] = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
  { value: 'transfer', label: 'Transferir' },
  { value: 'vault', label: 'Caixinha' },
]
const VAULT_KINDS: Kind[] = ['investment', 'redeem', 'yield']
const COLOR: Record<Kind, string> = {
  expense: 'var(--c-red)', income: 'var(--c-green)', transfer: 'var(--c-blue)',
  investment: 'var(--c-purple)', redeem: 'var(--c-purple)', yield: 'var(--c-green)',
}
const FREQ: { value: Frequency; label: string; unit: string }[] = [
  { value: 'daily', label: 'Todo dia', unit: 'dias' }, { value: 'weekly', label: 'Toda semana', unit: 'semanas' },
  { value: 'monthly', label: 'Todo mês', unit: 'meses' }, { value: 'yearly', label: 'Todo ano', unit: 'anos' },
]

const readLast = (): { accountId: string | null; cardId: string | null } => {
  try { return JSON.parse(localStorage.getItem('dindin:lastPay') ?? '{}') } catch { return { accountId: null, cardId: null } }
}

type Scope = 'one' | 'next' | 'all'

function TxForm({ preset, editing, onClose }: { preset?: Preset; editing?: Transaction; onClose: () => void }) {
  const { data, add, addMany, update, updateMany, remove, addRecurring, notify } = useStore()
  const today = todayISO()
  const base = editing ?? preset
  const accounts = data.accounts.filter((a) => !a.archived)
  const cards = data.cards.filter((c) => !c.archived)
  const vaults = data.vaults.filter((v) => !v.archived)
  const isPayment = Boolean(base?.kind === 'transfer' && base?.card_id) // pagamento de fatura

  const [kind, setKind] = useState<Kind>(base?.kind ?? 'expense')
  const [amount, setAmount] = useState(base?.amount !== undefined && base.amount !== 0 ? fmtInput(base.amount) : '')
  const [description, setDescription] = useState(base?.description ?? '')
  const [date, setDate] = useState(base?.date ?? today)
  const [categoryId, setCategoryId] = useState<string | null>(base?.category_id ?? null)
  const [sourceId, setSourceId] = useState<string | null>(base?.source_id ?? null)
  const [nature, setNature] = useState<Nature>(base?.nature ?? 'variable')
  const [paid, setPaid] = useState(base?.paid ?? (base?.date ?? today) <= today)
  const [paidTouched, setPaidTouched] = useState(Boolean(editing))
  const [goalId, setGoalId] = useState<string | null>(base?.goal_id ?? null)
  const [debtId, setDebtId] = useState<string | null>(base?.debt_id ?? null)
  const [groupId, setGroupId] = useState<string | null>(base?.group_id ?? null)
  const [groupTouched, setGroupTouched] = useState(Boolean(base?.group_id))
  const [vaultId, setVaultId] = useState<string | null>(base?.vault_id ?? null)
  const [tags, setTags] = useState<string[]>(base?.tags ?? [])
  const [note, setNote] = useState(base?.note ?? '')
  const [err, setErr] = useState('')

  const initWhere = () => {
    if (base && (base.account_id || base.card_id)) return { accountId: base.account_id ?? null, cardId: base.card_id ?? null }
    const last = readLast()
    if (last.cardId && cards.some((c) => c.id === last.cardId)) return { accountId: null, cardId: last.cardId }
    const acc = accounts.find((a) => a.id === last.accountId) ?? accounts[0]
    return { accountId: acc?.id ?? null, cardId: null }
  }
  const [where, setWhere] = useState(initWhere)
  const [toAccountId, setToAccountId] = useState<string | null>(base?.to_account_id ?? null)

  // repeticao (so ao criar)
  const [repeat, setRepeat] = useState<'none' | 'installments' | 'fixed'>('none')
  const [nInst, setNInst] = useState(2)
  const [instMode, setInstMode] = useState<InstallmentMode>('total')
  const [irregular, setIrregular] = useState(false)
  const [irrAmounts, setIrrAmounts] = useState<string[]>([])
  const [freq, setFreq] = useState<Frequency>('monthly')
  const [interval, setIntervalN] = useState(1)
  const [endMode, setEndMode] = useState<'never' | 'count' | 'date'>('never')
  const [endCount, setEndCount] = useState(12)
  const [endDate, setEndDate] = useState('')
  const [variable, setVariable] = useState(false)
  const [saveTemplate, setSaveTemplate] = useState(false)
  const [scope, setScope] = useState<Scope>('one')

  const isVault = VAULT_KINDS.includes(kind)
  const tab = isVault ? 'vault' : kind
  const card = cards.find((c) => c.id === where.cardId) ?? null
  const seriesInst = editing?.installment_group ? data.transactions.filter((t) => t.installment_group === editing.installment_group) : []
  const seriesRec = editing?.recurring_id ? data.transactions.filter((t) => t.recurring_id === editing.recurring_id) : []
  const hasSeries = seriesInst.length > 1 || seriesRec.length > 1

  const recent = useMemo(() => {
    const seen = new Map<string, Transaction>()
    for (const t of [...data.transactions].sort((a, b) => (a.date < b.date ? 1 : -1))) {
      const k = t.description.trim().toLowerCase()
      if (k && t.kind === kind && !seen.has(k)) seen.set(k, t)
      if (seen.size >= 80) break
    }
    return seen
  }, [data.transactions, kind])

  const pickWhere = (w: { accountId: string | null; cardId: string | null }) => {
    setWhere(w)
    if (w.cardId && !groupTouched) {
      const g = cards.find((c) => c.id === w.cardId)?.group_id
      if (g) setGroupId(g)
    }
  }
  const onDescription = (v: string) => {
    setDescription(v)
    const hit = recent.get(v.trim().toLowerCase())
    if (hit && !editing && !categoryId && !sourceId) {
      setCategoryId(hit.category_id); setSourceId(hit.source_id)
      if (hit.nature) setNature(hit.nature)
      if (hit.group_id) { setGroupId(hit.group_id); setGroupTouched(true) }
      if (hit.account_id || hit.card_id) setWhere({ accountId: hit.account_id, cardId: hit.card_id })
      if (!amount) setAmount(fmtInput(hit.amount))
    }
  }
  const onDate = (v: string) => { setDate(v); if (!paidTouched) setPaid(v <= today) }
  const changeTab = (t: typeof tab) => {
    const k: Kind = t === 'vault' ? 'investment' : t
    setKind(k); setCategoryId(null); setSourceId(null); setGoalId(null); setDebtId(null); setErr('')
    if (k === 'transfer' || k === 'investment') setRepeat('none')
  }
  const useTemplate = (id: string) => {
    const t = data.templates.find((x) => x.id === id)
    if (!t) return
    setKind(t.kind); setDescription(t.description); if (t.amount) setAmount(fmtInput(t.amount))
    setCategoryId(t.category_id); setSourceId(t.source_id); if (t.nature) setNature(t.nature)
    setGroupId(t.group_id); setGroupTouched(Boolean(t.group_id)); setVaultId(t.vault_id)
    if (t.account_id || t.card_id) setWhere({ accountId: t.account_id, cardId: t.card_id })
  }

  const value = evalExpr(amount)
  const per = value && repeat === 'installments' ? (instMode === 'total' ? splitAmount(value, nInst)[0] : value) : null
  const totalInst = value && repeat === 'installments' ? (instMode === 'total' ? value : value * nInst) : null

  useEffect(() => {
    if (!irregular) return
    setIrrAmounts((prev) => Array.from({ length: nInst }, (_, i) => prev[i] ?? (per ? fmtInput(per) : '')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [irregular, nInst])

  const shared = () => ({
    description: description.trim() || defaultDesc(),
    category_id: kind === 'expense' || kind === 'investment' ? categoryId : null,
    source_id: kind === 'income' ? sourceId : null,
    nature: kind === 'expense' ? nature : null,
    group_id: kind === 'expense' || kind === 'income' ? groupId : null,
    vault_id: isVault ? vaultId : null,
    account_id: kind === 'yield' ? null : kind === 'expense' && where.cardId ? null : where.accountId,
    to_account_id: kind === 'transfer' && !isPayment ? toAccountId : null,
    card_id: (kind === 'expense' || isPayment) ? where.cardId : null,
    goal_id: kind === 'investment' ? goalId : null,
    debt_id: kind === 'expense' ? debtId : null,
    tags, note: note.trim(),
  })
  function defaultDesc() {
    switch (kind) {
      case 'income': return 'Receita'
      case 'investment': return 'Aporte'
      case 'redeem': return 'Resgate'
      case 'yield': return 'Rendimento'
      case 'transfer': return isPayment ? (base?.description ?? 'Pagamento de fatura') : 'Transferência'
      default: return 'Despesa'
    }
  }

  const validate = (): string | null => {
    if (value === null) return 'Valor inválido. Exemplo: 58,90 ou 12+30'
    if (kind === 'yield' ? value === 0 : value <= 0) return kind === 'yield' ? 'Informe o rendimento (use - para perda)' : 'Informe um valor maior que zero'
    if (!date) return 'Escolha a data'
    if (kind === 'transfer' && !isPayment) {
      if (!where.accountId || !toAccountId) return 'Escolha de qual conta para qual conta'
      if (where.accountId === toAccountId) return 'As contas precisam ser diferentes'
    }
    if (isVault && !vaultId) return 'Escolha a caixinha'
    if (repeat === 'installments' && irregular && irrAmounts.some((a) => !(evalExpr(a) ?? 0))) return 'Preencha o valor de todas as parcelas'
    if (repeat === 'fixed' && endMode === 'date' && !endDate) return 'Escolha até quando repete'
    return null
  }

  const submit = (another: boolean) => {
    const e = validate()
    if (e) { setErr(e); return }
    const v = value as number
    try { localStorage.setItem('dindin:lastPay', JSON.stringify({ accountId: where.accountId, cardId: where.cardId })) } catch { /* ignore */ }
    const sh = shared()
    const wasPaid = kind === 'expense' && where.cardId ? date <= today : paid

    if (editing) {
      const patch = { ...sh, amount: v, date, paid: wasPaid }
      if (scope === 'one' || !hasSeries) {
        update('transactions', editing.id, patch)
        notify('Lançamento atualizado')
      } else {
        const members = seriesInst.length > 1
          ? seriesInst.filter((t) => scope === 'all' || (t.installment_no ?? 0) >= (editing.installment_no ?? 0))
          : seriesRec.filter((t) => t.date >= editing.date)
        const common = { description: sh.description, category_id: sh.category_id, source_id: sh.source_id, nature: sh.nature, group_id: sh.group_id,
          account_id: sh.account_id, card_id: sh.card_id, vault_id: sh.vault_id, goal_id: sh.goal_id, debt_id: sh.debt_id, tags: sh.tags, note: sh.note, amount: v }
        updateMany('transactions', members.map((t) => ({ id: t.id, patch: t.id === editing.id ? { ...common, date, paid: wasPaid } : common })))
        if (editing.recurring_id) {
          const { description: d2, amount: a2, category_id, source_id, nature: n2, group_id, account_id, card_id, vault_id, goal_id, debt_id, tags: t2, note: nt } = common
          update('recurrings', editing.recurring_id, { description: d2, amount: a2, category_id, source_id, nature: n2, group_id, account_id, card_id, vault_id, goal_id, debt_id, tags: t2, note: nt })
        }
        notify(`${members.length} lançamentos atualizados`)
      }
      onClose()
      return
    }

    if (saveTemplate && (kind === 'expense' || kind === 'income' || kind === 'investment')) {
      add('templates', { name: sh.description, kind, description: sh.description, amount: v, category_id: sh.category_id, source_id: sh.source_id,
        nature: sh.nature, group_id: sh.group_id, vault_id: sh.vault_id, account_id: sh.account_id, card_id: sh.card_id })
    }

    if (repeat === 'installments' && (kind === 'expense' || kind === 'income')) {
      const amounts = irregular ? irrAmounts.map((a) => evalExpr(a) ?? 0) : undefined
      const parts = buildInstallments({ kind, ...sh }, date, v, nInst, instMode, today, amounts)
      addMany('transactions', parts)
      const sum = parts.reduce((a, p) => a + p.amount, 0)
      notify(`${nInst}x criadas · total ${money(sum)}`)
    } else if (repeat === 'fixed' && (kind === 'expense' || kind === 'income' || kind === 'investment')) {
      const rec: Omit<Recurring, 'id' | 'generated'> = {
        kind, description: sh.description, amount: v, variable, frequency: freq, interval_n: Math.max(1, interval), start_date: date,
        count: endMode === 'count' ? Math.max(1, endCount) : null, end_date: endMode === 'date' ? endDate : null,
        category_id: sh.category_id, source_id: sh.source_id, nature: sh.nature, goal_id: sh.goal_id, debt_id: sh.debt_id, group_id: sh.group_id,
        vault_id: sh.vault_id, account_id: sh.account_id, card_id: sh.card_id, tags: sh.tags, note: sh.note, active: true,
      }
      addRecurring(rec)
      notify('Repetição criada — os próximos lançamentos já aparecem')
    } else {
      add('transactions', makeTx({ kind, date, amount: v, paid: wasPaid, ...sh, invoice_month: isPayment ? (base?.invoice_month ?? null) : null }))
      notify(kind === 'yield' ? `Rendimento de ${money(v)} registrado` : `${money(Math.abs(v))} salvo`)
    }
    if (another) { setAmount(''); setDescription(''); setErr(''); setRepeat('none') } else onClose()
  }

  const doDelete = () => {
    if (!editing) return
    if (hasSeries && scope !== 'one') {
      const members = seriesInst.length > 1
        ? seriesInst.filter((t) => scope === 'all' || (t.installment_no ?? 0) >= (editing.installment_no ?? 0))
        : seriesRec.filter((t) => t.date >= editing.date)
      remove('transactions', members.map((t) => t.id))
      if (editing.recurring_id) update('recurrings', editing.recurring_id, { active: false })
      notify(`${members.length} lançamentos apagados`)
    } else {
      remove('transactions', [editing.id])
      notify('Lançamento apagado')
    }
    onClose()
  }

  const accent = COLOR[kind]
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd')
  const firstKey = card && repeat === 'installments' ? invoiceKeyOf(card, date) : null
  const keyLabel = (k: string) => format(parseISO(`${k}-01`), 'MMM/yy', { locale: ptBR })
  const lastInst = repeat === 'installments' ? (() => { const d = parseISO(date); d.setMonth(d.getMonth() + nInst - 1); return format(d, 'yyyy-MM-dd') })() : null
  const lastInvoice = card && lastInst ? invoiceKeyOf(card, lastInst) : null

  return (
    <Sheet open onClose={onClose} title={editing ? (isPayment ? 'Pagamento de fatura' : 'Editar lançamento') : 'Novo lançamento'}
      footer={
        <>
          {editing && <ConfirmButton className="mr-auto" onConfirm={doDelete}>Apagar</ConfirmButton>}
          {!editing && <button className="btn" onClick={() => submit(true)}>Salvar e novo</button>}
          <button className="btn btn-primary" onClick={() => submit(false)}>Salvar</button>
        </>
      }>
      <div className="flex flex-col gap-4">
        {!editing && !isPayment && data.templates.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
            {data.templates.map((t) => (
              <button key={t.id} type="button" onClick={() => useTemplate(t.id)} className="chip shrink-0" style={{ '--c': 'var(--c-yellow)' } as React.CSSProperties}>
                <Icon name="sparkles" size={14} /> {t.name}{t.amount ? ` · ${money(t.amount)}` : ''}
              </button>
            ))}
          </div>
        )}

        {!isPayment && <Seg full value={tab} onChange={changeTab} options={TABS} />}
        {isVault && !editing && (
          <Seg full value={kind as 'investment' | 'redeem' | 'yield'} onChange={(k) => { setKind(k); setErr('') }}
            options={[{ value: 'investment', label: 'Aportar' }, { value: 'redeem', label: 'Resgatar' }, { value: 'yield', label: 'Rendimento' }]} />
        )}

        <div>
          <AmountInput value={amount} onChange={(v) => { setAmount(v); setErr('') }} color={accent} allowNegative={kind === 'yield'} onEnter={() => submit(false)} />
          {err && <div className="text-[13px] text-expense text-center">{err}</div>}
        </div>

        {editing && hasSeries && (
          <Field label={seriesInst.length > 1 ? `Parcela ${editing.installment_no}/${editing.installment_total}: aplicar a` : 'Lançamento fixo: aplicar a'}>
            <Seg full value={scope} onChange={setScope} options={[
              { value: 'one', label: 'Só esta' }, { value: 'next', label: 'Esta e próximas' },
              ...(seriesInst.length > 1 ? [{ value: 'all' as Scope, label: 'Todas' }] : []),
            ]} />
            {scope !== 'one' && <div className="text-[12px] text-ink2 mt-1.5">A data e o status “pago” mudam só nesta. O valor vale para cada parcela.</div>}
          </Field>
        )}

        {!isPayment && kind !== 'transfer' && !isVault && (
          <Field label="Descrição">
            <input className="input" list="desc-list" placeholder={kind === 'income' ? 'Ex: Salário, projeto X' : 'Ex: Mercado, aluguel'}
              value={description} onChange={(e) => onDescription(e.target.value)} />
            <datalist id="desc-list">{[...recent.values()].map((t) => <option key={t.id} value={t.description} />)}</datalist>
          </Field>
        )}
        {(isVault || (kind === 'transfer' && !isPayment)) && (
          <Field label="Descrição (opcional)">
            <input className="input" placeholder={isVault ? 'Ex: aporte do mês' : 'Ex: recarga da carteira'} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        )}
        {isPayment && <div className="text-[13.5px] text-ink2 rounded-xl bg-[var(--field)] px-3 py-2.5">{description}{base?.invoice_month ? ` · fatura de ${keyLabel(base.invoice_month)}` : ''}</div>}

        {kind === 'income' && (
          <Field label="Origem">
            <div className="flex flex-wrap gap-2">
              {data.sources.map((s) => (
                <Chip key={s.id} color={s.color} active={sourceId === s.id} onClick={() => setSourceId(sourceId === s.id ? null : s.id)}><Icon name={s.icon} size={15} /> {s.name}</Chip>
              ))}
            </div>
          </Field>
        )}
        {kind === 'expense' && (
          <Field label="Categoria">
            <div className="flex flex-wrap gap-2">
              {data.categories.filter((c) => c.kind === 'expense').map((c) => (
                <Chip key={c.id} color={c.color} active={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}><Icon name={c.icon} size={15} /> {c.name}</Chip>
              ))}
            </div>
          </Field>
        )}

        {(kind === 'expense' || kind === 'income') && (
          <ItemPicker label="Grupo (casa, minhas, Lucas…)" items={data.groups} value={groupId} onChange={(id) => { setGroupId(id); setGroupTouched(true) }} />
        )}

        {isVault && <ItemPicker label="Caixinha" items={vaults} value={vaultId} onChange={setVaultId} optional={false} />}
        {isVault && vaults.length === 0 && <div className="text-[13px] text-ink2">Crie sua primeira caixinha na tela “Caixinhas”.</div>}

        {kind === 'expense' && <WherePicker label="Pago com" accounts={accounts} cards={cards} accountId={where.accountId} cardId={where.cardId} onPick={pickWhere} />}
        {kind === 'income' && <WherePicker label="Cai em" accounts={accounts} accountId={where.accountId} cardId={null} onPick={pickWhere} />}
        {(kind === 'investment') && <WherePicker label="Sai de" accounts={accounts} accountId={where.accountId} cardId={null} onPick={pickWhere} />}
        {kind === 'redeem' && <WherePicker label="Cai em" accounts={accounts} accountId={where.accountId} cardId={null} onPick={pickWhere} />}
        {kind === 'transfer' && !isPayment && (
          <>
            <WherePicker label="De" accounts={accounts} accountId={where.accountId} cardId={null} onPick={pickWhere} />
            <WherePicker label="Para" accounts={accounts} accountId={toAccountId} cardId={null} onPick={(w) => setToAccountId(w.accountId)} />
          </>
        )}
        {isPayment && <WherePicker label="Pago com a conta" accounts={accounts} accountId={where.accountId} cardId={null} onPick={(w) => setWhere({ accountId: w.accountId, cardId: base?.card_id ?? null })} />}

        {kind === 'expense' && (
          <Field label="Tipo">
            <Seg<Nature> full value={nature} onChange={setNature} options={[{ value: 'variable', label: 'Variável' }, { value: 'fixed', label: 'Fixa' }]} />
          </Field>
        )}

        <Field label={repeat === 'installments' ? 'Data da 1ª parcela' : repeat === 'fixed' ? 'Começa em' : 'Data'}>
          <div className="flex gap-2 items-center">
            <input type="date" className="input" value={date} onChange={(e) => onDate(e.target.value)} />
            <button type="button" className="btn btn-sm" onClick={() => onDate(yesterday)}>Ontem</button>
            <button type="button" className="btn btn-sm" onClick={() => onDate(today)}>Hoje</button>
            <button type="button" className="btn btn-sm" onClick={() => onDate(tomorrow)}>Amanhã</button>
          </div>
        </Field>

        {!editing && (kind === 'expense' || kind === 'income' || kind === 'investment') && (
          <Field label="Repetição">
            <Seg full value={repeat} onChange={setRepeat} options={[
              { value: 'none', label: 'Única' },
              ...(kind === 'investment' ? [] : [{ value: 'installments' as const, label: 'Parcelada' }]),
              { value: 'fixed', label: 'Fixa' },
            ]} />
          </Field>
        )}

        {repeat === 'installments' && !editing && (
          <div className="rounded-2xl bg-[var(--field)] p-3.5 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nº de parcelas">
                <input className="input" type="number" min={2} max={72} value={nInst} onChange={(e) => setNInst(Math.min(72, Math.max(2, Number(e.target.value) || 2)))} />
              </Field>
              <Field label="O valor acima é">
                <select className="input" value={instMode} onChange={(e) => setInstMode(e.target.value as InstallmentMode)}>
                  <option value="total">O total da compra</option>
                  <option value="parcela">O valor de cada parcela</option>
                </select>
              </Field>
            </div>
            {per !== null && totalInst !== null && !irregular && (
              <div className="text-[13.5px]"><b>{nInst}x de {money(per)}</b> · total {money(totalInst)}
                {lastInst && <span className="text-ink2"> · até {format(parseISO(lastInst), 'MMM/yy', { locale: ptBR })}</span>}</div>
            )}
            {card && firstKey && lastInvoice && <div className="text-[12.5px] text-ink2">Caem nas faturas de {keyLabel(firstKey)} a {keyLabel(lastInvoice)} do {card.name}.</div>}
            <label className="flex items-center gap-2 text-[13.5px]">
              <input type="checkbox" checked={irregular} onChange={(e) => setIrregular(e.target.checked)} /> Parcelas com valores diferentes
            </label>
            {irregular && (
              <div className="grid grid-cols-3 gap-2">
                {irrAmounts.map((a, i) => (
                  <input key={i} className="input !h-9 !text-[13px]" inputMode="decimal" aria-label={`Parcela ${i + 1}`} placeholder={`${i + 1}ª`} value={a}
                    onChange={(e) => setIrrAmounts((p) => p.map((x, j) => (j === i ? e.target.value : x)))} />
                ))}
              </div>
            )}
          </div>
        )}

        {repeat === 'fixed' && !editing && (
          <div className="rounded-2xl bg-[var(--field)] p-3.5 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Repete">
                <select className="input" value={freq} onChange={(e) => setFreq(e.target.value as Frequency)}>
                  {FREQ.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Field>
              <Field label={`A cada (${FREQ.find((f) => f.value === freq)!.unit})`}>
                <input className="input" type="number" min={1} max={60} value={interval} onChange={(e) => setIntervalN(Math.max(1, Number(e.target.value) || 1))} />
              </Field>
            </div>
            <Field label="Termina">
              <Seg full value={endMode} onChange={setEndMode} options={[{ value: 'never', label: 'Nunca' }, { value: 'count', label: 'Após N vezes' }, { value: 'date', label: 'Em uma data' }]} />
            </Field>
            {endMode === 'count' && <input className="input" type="number" min={1} value={endCount} onChange={(e) => setEndCount(Number(e.target.value) || 1)} aria-label="Quantidade de vezes" />}
            {endMode === 'date' && <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="Data final" />}
            <label className="flex items-center gap-2 text-[13.5px]">
              <input type="checkbox" checked={variable} onChange={(e) => setVariable(e.target.checked)} /> O valor varia (ex.: luz, água): nasce como estimado
            </label>
          </div>
        )}

        {kind === 'expense' && !where.cardId && repeat !== 'installments' && (
          <Toggle checked={paid} onChange={(v) => { setPaid(v); setPaidTouched(true) }} label="Já paguei" hint={paid ? undefined : 'Fica como pendente até você marcar'} />
        )}
        {kind === 'income' && repeat !== 'installments' && (
          <Toggle checked={paid} onChange={(v) => { setPaid(v); setPaidTouched(true) }} label="Já recebi" hint={paid ? undefined : 'Fica como pendente até você marcar'} />
        )}
        {kind === 'expense' && where.cardId && <div className="text-[12.5px] text-ink2">Compra no cartão: entra na fatura certa conforme o fechamento.</div>}

        <Collapsible title="Mais opções (tags, observação, modelo…)">
          {kind === 'expense' && data.debts.some((d) => d.status !== 'paid') && (
            <Field label="É pagamento de dívida?">
              <select className="input" value={debtId ?? ''} onChange={(e) => {
                const v = e.target.value || null
                setDebtId(v)
                const dc = data.categories.find((c) => c.name === 'Dívidas')
                if (v && dc && !categoryId) setCategoryId(dc.id)
              }}>
                <option value="">Não</option>
                {data.debts.filter((d) => d.status !== 'paid').map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          )}
          {kind === 'investment' && data.goals.length > 0 && (
            <Field label="Para qual meta?">
              <select className="input" value={goalId ?? ''} onChange={(e) => setGoalId(e.target.value || null)}>
                <option value="">Sem meta</option>
                {data.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
          )}
          {kind !== 'transfer' && kind !== 'yield' && kind !== 'redeem' && <Field label="Tags"><TagsInput value={tags} onChange={setTags} /></Field>}
          <Field label="Observação"><textarea className="input !h-auto py-2.5" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Algo que você queira lembrar" /></Field>
          {!editing && (kind === 'expense' || kind === 'income' || kind === 'investment') && (
            <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={saveTemplate} onChange={(e) => setSaveTemplate(e.target.checked)} /> Salvar como modelo (1 toque na próxima vez)</label>
          )}
        </Collapsible>
      </div>
    </Sheet>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center justify-between gap-3 py-1 text-left bg-transparent border-0" role="switch" aria-checked={checked}>
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
