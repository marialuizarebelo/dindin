import { useMemo, useState } from 'react'
import { addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Repeat } from 'lucide-react'
import { useStore } from '../lib/store'
import { useLookup } from '../lib/lookup'
import { clampDay, monthKey, todayISO } from '../lib/period'
import { money, moneyInt, parseMoney, percent } from '../lib/format'
import { solid } from '../lib/colors'
import { Toggle } from '../components/TxSheet'
import { Icon, IconBadge } from '../components/Icon'
import { Card, Chip, ConfirmButton, Empty, Field, Money, PageTitle, Progress, Seg, Sheet, Tag } from '../components/ui'
import type { Kind, Nature, Recurring } from '../lib/types'

export default function Planning() {
  const { data, add, update, remove, notify } = useStore()
  const { label } = useLookup()
  const [ym, setYm] = useState(monthKey(todayISO()))
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null)
  const [editBudget, setEditBudget] = useState<string | null>(null)
  const [budgetVal, setBudgetVal] = useState('')

  const month = useMemo(() => data.transactions.filter((t) => monthKey(t.date) === ym), [data.transactions, ym])
  const plan = useMemo(() => {
    const income = month.filter((t) => t.kind === 'income').reduce((a, t) => a + t.amount, 0)
    const fixed = month.filter((t) => t.kind === 'expense' && (t.nature === 'fixed' || t.debt_id)).reduce((a, t) => a + t.amount, 0)
    const invest = month.filter((t) => t.kind === 'investment').reduce((a, t) => a + t.amount, 0)
    const variableBy = new Map<string, number>()
    for (const t of month) if (t.kind === 'expense' && t.nature !== 'fixed' && !t.debt_id) variableBy.set(t.category_id ?? '_', (variableBy.get(t.category_id ?? '_') ?? 0) + t.amount)
    let variable = 0
    const budgeted = new Set(data.budgets.map((b) => b.category_id))
    for (const b of data.budgets) variable += Math.max(b.amount, variableBy.get(b.category_id) ?? 0)
    for (const [k, v] of variableBy) if (!budgeted.has(k)) variable += v
    return { income, fixed, invest, variable, left: income - fixed - invest - variable, variableBy }
  }, [month, data.budgets])

  const expCats = data.categories.filter((c) => c.kind === 'expense')
  const budgets = data.budgets.map((b) => ({ b, c: data.categories.find((c) => c.id === b.category_id) })).filter((x) => x.c)
  const without = expCats.filter((c) => !data.budgets.some((b) => b.category_id === c.id))

  const suggest = (catId: string) => {
    let sum = 0, n = 0
    for (let i = 1; i <= 3; i++) {
      const k = format(addMonths(parseISO(`${ym}-01`), -i), 'yyyy-MM')
      const v = data.transactions.filter((t) => t.kind === 'expense' && t.category_id === catId && monthKey(t.date) === k && t.nature !== 'fixed').reduce((a, t) => a + t.amount, 0)
      if (v > 0) { sum += v; n++ }
    }
    return n ? Math.ceil(sum / n / 10) * 10 : 300
  }

  const recs = [...data.recurrings].sort((a, b) => a.day - b.day)
  const fixedTotal = recs.filter((r) => r.active && r.kind === 'expense').reduce((a, r) => a + r.amount, 0)
  const incomeTotal = recs.filter((r) => r.active && r.kind === 'income').reduce((a, r) => a + r.amount, 0)

  return (
    <>
      <PageTitle title="Planejamento" subtitle="Quanto entra, quanto já está comprometido e o que sobra pra viver" />

      <div className="flex items-center gap-2 mb-4 fade-up">
        <button className="btn btn-icon" aria-label="Mês anterior" onClick={() => setYm(format(addMonths(parseISO(`${ym}-01`), -1), 'yyyy-MM'))}><ChevronLeft size={18} /></button>
        <div className="glass h-[38px] rounded-xl px-5 grid place-items-center font-semibold capitalize min-w-[200px]">{format(parseISO(`${ym}-01`), 'MMMM yyyy', { locale: ptBR })}</div>
        <button className="btn btn-icon" aria-label="Próximo mês" onClick={() => setYm(format(addMonths(parseISO(`${ym}-01`), 1), 'yyyy-MM'))}><ChevronRight size={18} /></button>
      </div>

      <Card className="mb-4" delay={30}>
        <div className="font-semibold text-[16px] mb-3">Plano do mês</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <PlanCell title="Vai entrar" v={plan.income} color="green" />
          <PlanCell title="Fixas e dívidas" v={-plan.fixed} color="purple" />
          <PlanCell title="Variáveis (limites)" v={-plan.variable} color="orange" />
          <PlanCell title="Investimentos" v={-plan.invest} color="blue" />
          <PlanCell title="Sobra prevista" v={plan.left} color={plan.left >= 0 ? 'teal' : 'red'} strong />
        </div>
        {plan.income > 0 && (
          <div className="mt-4">
            <div className="flex h-3 rounded-full overflow-hidden gap-[3px]">
              {[['purple', plan.fixed], ['orange', plan.variable], ['blue', plan.invest], ['teal', Math.max(plan.left, 0)]].map(([c, v]) => (
                <i key={c as string} className="rounded-full" style={{ width: `${Math.max((v as number) / plan.income, 0) * 100}%`, background: solid(c as 'purple') }} />
              ))}
            </div>
            <div className="text-[12.5px] text-ink2 mt-2">
              Da sua renda: {percent(plan.fixed / plan.income)} fixas · {percent(plan.variable / plan.income)} variáveis · {percent(plan.invest / plan.income)} investimentos
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card delay={80}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[16px]">Limites por categoria</div>
            {without.length > 0 && (
              <select className="input !w-auto !h-[34px] !text-[13px]" value="" aria-label="Adicionar limite"
                onChange={(e) => {
                  const c = expCats.find((x) => x.id === e.target.value)
                  if (c) { add('budgets', { category_id: c.id, amount: suggest(c.id) }); notify(`Limite de ${c.name} criado`) }
                }}>
                <option value="">+ Adicionar limite</option>
                {without.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          {budgets.length === 0 ? <Empty icon="sliders" title="Sem limites ainda">Defina quanto quer gastar por categoria e acompanhe o consumo.</Empty> : (
            <div className="flex flex-col gap-4">
              {budgets.map(({ b, c }) => {
                const spent = plan.variableBy.get(b.category_id) ?? 0
                const ratio = spent / b.amount
                const tone = ratio >= 1 ? 'red' : ratio >= 0.8 ? 'orange' : 'green'
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[14px] font-medium flex items-center gap-2"><Icon name={c!.icon} size={15} className="text-ink2" />{c!.name}</span>
                      {editBudget === b.id ? (
                        <form className="flex gap-1.5" onSubmit={(e) => {
                          e.preventDefault()
                          const v = parseMoney(budgetVal)
                          if (v > 0) update('budgets', b.id, { amount: v })
                          setEditBudget(null)
                        }}>
                          <input autoFocus className="input !h-8 !w-24 !text-[13px]" inputMode="decimal" value={budgetVal} onChange={(e) => setBudgetVal(e.target.value)} />
                          <button className="btn btn-sm btn-primary">OK</button>
                          <ConfirmButton className="btn-sm" onConfirm={() => { remove('budgets', [b.id]); setEditBudget(null) }}>Remover</ConfirmButton>
                        </form>
                      ) : (
                        <button className="bg-transparent border-0 p-0 text-[13px] text-ink2" onClick={() => { setEditBudget(b.id); setBudgetVal(String(b.amount).replace('.', ',')) }}>
                          <span className="money num font-semibold text-ink">{money(spent)}</span> de <span className="money num">{moneyInt(b.amount)}</span>
                        </button>
                      )}
                    </div>
                    <Progress value={ratio} color={tone} />
                    {ratio >= 1 && <div className="text-[12px] mt-1" style={{ color: 'var(--c-red)' }}>Passou {money(spent - b.amount)} do limite</div>}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card delay={120}>
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold text-[16px]">Fixos que se repetem</div>
            <button className="btn btn-sm btn-primary" onClick={() => setEditing('new')}><Plus size={15} /> Novo</button>
          </div>
          <div className="text-[12.5px] text-ink2 mb-3">
            Entram todo mês: <b className="money num text-ink">{moneyInt(incomeTotal)}</b> · saem <b className="money num text-ink">{moneyInt(fixedTotal)}</b>
          </div>
          {recs.length === 0 ? <Empty icon="repeat" title="Nenhum fixo cadastrado">Aluguel, salário, assinaturas… cadastre uma vez e o app lança todo mês.</Empty> : (
            <div className="flex flex-col">
              {recs.map((r) => {
                const l = label({ kind: r.kind, category_id: r.category_id, source_id: r.source_id })
                return (
                  <button key={r.id} onClick={() => setEditing(r)} className="flex items-center gap-3 py-2.5 border-0 border-b border-hair last:border-0 bg-transparent text-left" style={{ opacity: r.active ? 1 : 0.5 }}>
                    <IconBadge name={l.icon} color={l.color} size={38} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[14.5px] font-medium">{r.description}</span>
                      <span className="flex gap-1.5 items-center text-[12.5px] text-ink2"><Repeat size={12} /> dia {r.day} <Tag color={l.color}>{l.name}</Tag></span>
                    </span>
                    <Money v={r.kind === 'income' ? r.amount : -r.amount} sign className={`font-semibold text-[14.5px] ${r.kind === 'income' ? 'text-income' : ''}`} />
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {editing && <RecurringForm rec={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function PlanCell({ title, v, color, strong }: { title: string; v: number; color: 'green' | 'purple' | 'orange' | 'blue' | 'teal' | 'red'; strong?: boolean }) {
  return (
    <div className="rounded-2xl px-3.5 py-3" style={{ background: `color-mix(in srgb, ${solid(color)} ${strong ? 20 : 12}%, transparent)` }}>
      <div className="text-[12px] text-ink2 font-medium">{title}</div>
      <div className={`money num font-display ${strong ? 'text-[26px]' : 'text-[21px]'}`}>{money(v)}</div>
    </div>
  )
}

function RecurringForm({ rec, onClose }: { rec?: Recurring; onClose: () => void }) {
  const { data, addRecurring, update, remove, notify } = useStore()
  const [kind, setKind] = useState<Kind>(rec?.kind ?? 'expense')
  const [description, setDescription] = useState(rec?.description ?? '')
  const [amount, setAmount] = useState(rec ? String(rec.amount).replace('.', ',') : '')
  const [day, setDay] = useState(String(rec?.day ?? new Date().getDate()))
  const [categoryId, setCategoryId] = useState<string | null>(rec?.category_id ?? null)
  const [sourceId, setSourceId] = useState<string | null>(rec?.source_id ?? null)
  const [nature, setNature] = useState<Nature>(rec?.nature ?? 'fixed')
  const [goalId, setGoalId] = useState<string | null>(rec?.goal_id ?? null)
  const [active, setActive] = useState(rec?.active ?? true)
  const [err, setErr] = useState('')
  const cats = data.categories.filter((c) => c.kind === kind)

  const save = () => {
    const value = parseMoney(amount)
    const d = Math.min(Math.max(parseInt(day, 10) || 1, 1), 31)
    if (!description.trim()) return setErr('Dê um nome')
    if (!(value > 0)) return setErr('Informe o valor')
    const fields = {
      kind, description: description.trim(), amount: value, day: d,
      category_id: kind === 'income' ? null : categoryId, source_id: kind === 'income' ? sourceId : null,
      nature: kind === 'expense' ? nature : null, goal_id: kind === 'investment' ? goalId : null, active,
    }
    if (rec) {
      update('recurrings', rec.id, fields)
      // lancamentos futuros ainda nao pagos acompanham a mudanca
      for (const t of data.transactions) {
        if (t.recurring_id === rec.id && !t.paid) {
          update('transactions', t.id, {
            kind: fields.kind, description: fields.description, amount: fields.amount, category_id: fields.category_id,
            source_id: fields.source_id, nature: fields.nature, goal_id: fields.goal_id, date: clampDay(monthKey(t.date), d),
          })
        }
      }
      notify('Fixo atualizado (e os pendentes também)')
    } else {
      addRecurring({ ...fields, start_month: monthKey(todayISO()), end_month: null })
      notify('Fixo criado')
    }
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={rec ? 'Editar fixo' : 'Novo fixo'}
      footer={<>
        {rec && <ConfirmButton className="mr-auto" onConfirm={() => { remove('recurrings', [rec.id]); notify('Fixo removido (lançamentos já criados continuam)'); onClose() }}>Remover</ConfirmButton>}
        <button className="btn btn-primary" onClick={save}>Salvar</button>
      </>}>
      <div className="flex flex-col gap-4">
        <Seg<Kind> full value={kind} onChange={(k) => { setKind(k); setCategoryId(null); setSourceId(null) }}
          options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }, { value: 'investment', label: 'Aporte' }]} />
        <Field label="Nome"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Aluguel, Salário" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)"><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></Field>
          <Field label="Dia do mês"><input className="input" type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        </div>
        {err && <div className="text-[13px]" style={{ color: 'var(--c-red)' }}>{err}</div>}
        {kind === 'expense' && (
          <Field label="Tipo"><Seg<Nature> full value={nature} onChange={setNature} options={[{ value: 'fixed', label: 'Fixa' }, { value: 'variable', label: 'Variável' }]} /></Field>
        )}
        <Field label={kind === 'income' ? 'Origem' : 'Categoria'}>
          <div className="flex flex-wrap gap-2">
            {kind === 'income'
              ? data.sources.map((s) => <Chip key={s.id} color={s.color} active={sourceId === s.id} onClick={() => setSourceId(s.id)}><Icon name={s.icon} size={15} /> {s.name}</Chip>)
              : cats.map((c) => <Chip key={c.id} color={c.color} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}><Icon name={c.icon} size={15} /> {c.name}</Chip>)}
          </div>
        </Field>
        {kind === 'investment' && data.goals.length > 0 && (
          <Field label="Meta (opcional)">
            <select className="input" value={goalId ?? ''} onChange={(e) => setGoalId(e.target.value || null)}>
              <option value="">Sem meta</option>
              {data.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
        )}
        <Toggle checked={active} onChange={setActive} label="Ativo" hint={active ? undefined : 'Pausado: não gera novos lançamentos'} />
      </div>
    </Sheet>
  )
}
