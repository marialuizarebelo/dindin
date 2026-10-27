import { useMemo, useState } from 'react'
import { differenceInCalendarMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Sparkles } from 'lucide-react'
import { Icon, IconBadge } from '../components/Icon'
import { useStore } from '../lib/store'
import { lastMonths, todayISO } from '../lib/period'
import { goalSaved, summarize, txIn } from '../lib/stats'
import { money, moneyInt, parseMoney, percent } from '../lib/format'
import { solid, COLOR_KEYS } from '../lib/colors'
import { BarChart, Donut } from '../components/Charts'
import { useTxSheet } from '../components/TxSheet'
import { Card, ColorPick, ConfirmButton, Empty, IconPick, Field, PageTitle, Progress, Sheet } from '../components/ui'
import type { ColorKey, Goal } from '../lib/types'

export default function Goals() {
  const { data } = useStore()
  const { open } = useTxSheet()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)

  const inv = useMemo(() => data.transactions.filter((t) => t.kind === 'investment' && t.paid), [data.transactions])
  const total = inv.reduce((a, t) => a + t.amount, 0)
  const months = useMemo(() => lastMonths(todayISO(), 12), [])
  const monthly = useMemo(() => months.map((m) => summarize(txIn(data.transactions, m)).investment), [data.transactions, months])
  const avg = monthly.filter((v) => v > 0).reduce((a, b) => a + b, 0) / Math.max(monthly.filter((v) => v > 0).length, 1)
  const alloc = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of inv) m.set(t.category_id ?? '_', (m.get(t.category_id ?? '_') ?? 0) + t.amount)
    return [...m.entries()].map(([id, value]) => {
      const c = data.categories.find((x) => x.id === id)
      return { label: c?.name ?? 'Outros', value, color: solid(c?.color ?? 'gray'), icon: c?.icon ?? 'circle' }
    }).sort((a, b) => b.value - a.value)
  }, [inv, data.categories])

  return (
    <>
      <PageTitle title="Metas e investimentos" subtitle="O que você está construindo"
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nova meta</button>} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <Card delay={20} className="!p-4 sm:!p-5"><div className="text-[13px] text-ink2 mb-1">Total investido</div><div className="money num text-[24px] sm:text-[28px] font-bold">{money(total)}</div></Card>
        <Card delay={60} className="!p-4 sm:!p-5"><div className="text-[13px] text-ink2 mb-1">Média por mês</div><div className="money num text-[24px] sm:text-[28px] font-bold">{money(avg)}</div></Card>
        <Card delay={100} className="!p-4 sm:!p-5 col-span-2 lg:col-span-1"><div className="text-[13px] text-ink2 mb-1">Metas</div>
          <div className="num text-[24px] sm:text-[28px] font-bold">{data.goals.filter((g) => goalSaved(data, g.id) >= g.target).length}<span className="text-ink3 font-medium"> / {data.goals.length} concluídas</span></div></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card className="lg:col-span-2" delay={140}>
          <div className="font-semibold text-[16px] mb-3">Aportes por mês</div>
          <BarChart labels={months.map((m) => m.label)} series={[{ name: 'Investido', color: solid('blue'), values: monthly }]} height={210} />
        </Card>
        <Card delay={180}>
          <div className="font-semibold text-[16px] mb-3">Onde está investido</div>
          {alloc.length === 0 ? <Empty icon="sprout" title="Sem aportes ainda" /> : (
            <div className="flex flex-col items-center gap-4">
              <Donut size={150} thickness={18} slices={alloc}><div><div className="text-[11.5px] text-ink2">Total</div><div className="money num font-bold">{moneyInt(total)}</div></div></Donut>
              <div className="w-full flex flex-col gap-1.5">
                {alloc.slice(0, 5).map((a) => (
                  <div key={a.label} className="flex items-center gap-2 text-[13.5px]"><i className="dot" style={{ background: a.color }} /><span className="flex-1 truncate"><Icon name={a.icon} size={15} className="text-ink2" />{a.label}</span><span className="num text-ink2">{percent(a.value / total)}</span></div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {data.goals.length === 0 ? (
        <Card><Empty icon="target" title="Crie sua primeira meta">Viagem, reserva de emergência, entrada de um imóvel… Os aportes ligados à meta contam automaticamente.</Empty></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.goals.map((g, i) => {
            const saved = goalSaved(data, g.id)
            const ratio = saved / g.target
            const left = Math.max(g.target - saved, 0)
            const mLeft = g.deadline ? Math.max(differenceInCalendarMonths(parseISO(g.deadline), new Date()), 1) : null
            const need = mLeft ? left / mLeft : null
            const pace = months.slice(-3).reduce((a, m) => a + data.transactions.filter((t) => t.goal_id === g.id && t.paid && t.date >= m.start && t.date <= m.end).reduce((x, t) => x + t.amount, 0), 0) / 3
            const eta = pace > 0 && left > 0 ? Math.ceil(left / pace) : null
            return (
              <Card key={g.id} delay={220 + i * 40}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <IconBadge name={g.icon} color={g.color} size={44} />
                    <div><div className="font-semibold">{g.name}</div><div className="text-[12.5px] text-ink2">{g.deadline ? `até ${format(parseISO(g.deadline), 'MMM yyyy', { locale: ptBR })}` : 'sem prazo'}</div></div>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditing(g)}>Editar</button>
                </div>
                <div className="flex items-baseline justify-between mt-4 mb-2">
                  <span className="money num text-[22px] font-bold">{moneyInt(saved)}</span>
                  <span className="text-[13px] text-ink2">de <span className="money num">{moneyInt(g.target)}</span> · {percent(Math.min(ratio, 1))}</span>
                </div>
                <Progress value={ratio} color={g.color} />
                <div className="text-[12.5px] text-ink2 mt-2.5 min-h-[34px]">
                  {left === 0 ? <span className="inline-flex items-center gap-1.5 text-ink"><Sparkles size={14} /> Meta atingida</span> : (
                    <>
                      {need !== null && <>Precisa guardar <b className="money num text-ink">{moneyInt(need)}</b>/mês. </>}
                      {eta !== null && <>No seu ritmo: {eta} {eta === 1 ? 'mês' : 'meses'}.</>}
                    </>
                  )}
                </div>
                <button className="btn w-full mt-2" onClick={() => open({ kind: 'investment', goal_id: g.id })}>+ Aportar</button>
              </Card>
            )
          })}
        </div>
      )}
      {editing && <GoalForm goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { add, update, remove, notify } = useStore()
  const [name, setName] = useState(goal?.name ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? 'target')
  const [color, setColor] = useState<ColorKey>(goal?.color ?? 'blue')
  const [target, setTarget] = useState(goal ? String(goal.target).replace('.', ',') : '')
  const [initial, setInitial] = useState(goal ? String(goal.initial).replace('.', ',') : '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [err, setErr] = useState('')
  const save = () => {
    const t = parseMoney(target)
    if (!name.trim()) return setErr('Dê um nome')
    if (!(t > 0)) return setErr('Informe o valor da meta')
    const row = { name: name.trim(), icon, color, target: t, initial: parseMoney(initial) || 0, deadline: deadline || null }
    if (goal) update('goals', goal.id, row)
    else add('goals', row)
    notify('Meta salva')
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={goal ? 'Editar meta' : 'Nova meta'}
      footer={<>{goal && <ConfirmButton className="mr-auto" onConfirm={() => { remove('goals', [goal.id]); onClose() }}>Apagar</ConfirmButton>}<button className="btn btn-primary" onClick={save}>Salvar</button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Viagem, reserva de emergência" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quanto quer juntar (R$)"><input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          <Field label="Já tenho (R$)"><input className="input" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0,00" /></Field>
        </div>
        <Field label="Prazo (opcional)"><input type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        {err && <div className="text-[13px]" style={{ color: 'var(--c-red)' }}>{err}</div>}
        <Field label="Ícone"><IconPick value={icon} onChange={setIcon} /></Field>
        <Field label="Cor"><ColorPick value={color} onChange={setColor} keys={COLOR_KEYS} /></Field>
      </div>
    </Sheet>
  )
}
