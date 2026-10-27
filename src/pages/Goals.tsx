import { useMemo, useState } from 'react'
import { differenceInCalendarMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Sparkles } from 'lucide-react'
import { IconBadge } from '../components/Icon'
import { useStore } from '../lib/store'
import { lastMonths, todayISO } from '../lib/period'
import { goalSaved } from '../lib/stats'
import { isDone } from '../lib/tx'
import { money, moneyInt, parseMoney, percent } from '../lib/format'
import { COLOR_KEYS } from '../lib/colors'
import { useTxSheet } from '../components/TxSheet'
import { Card, ColorPick, TintCard, ConfirmButton, Empty, IconPick, Field, PageTitle, Progress, Sheet } from '../components/ui'
import type { ColorKey, Goal } from '../lib/types'

export default function Goals() {
  const { data } = useStore()
  const { open } = useTxSheet()
  const today = todayISO()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const months = useMemo(() => lastMonths(today, 12), [today])

  const saved = data.goals.reduce((a, g) => a + goalSaved(data, g.id), 0)
  const missing = data.goals.reduce((a, g) => a + Math.max(g.target - goalSaved(data, g.id), 0), 0)
  const done = data.goals.filter((g) => goalSaved(data, g.id) >= g.target).length

  return (
    <>
      <PageTitle title="Metas" subtitle="O que você está construindo"
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nova meta</button>} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <TintCard color="green" icon="piggy" label="Guardado nas metas" delay={20}><div className="money num font-display kpi-num">{money(saved)}</div></TintCard>
        <TintCard color="orange" icon="target" label="Falta juntar" delay={60}><div className="money num font-display kpi-num">{money(missing)}</div></TintCard>
        <TintCard color="purple" icon="star" label="Metas" delay={100} className="col-span-2 lg:col-span-1">
          <div className="num font-display kpi-num">{done}<span className="text-ink3"> / {data.goals.length}</span><span className="text-[14px] text-ink2 font-sans"> concluídas</span></div>
        </TintCard>
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
            const pace = months.slice(-3).reduce((a, m) => a + data.transactions.filter((t) => t.goal_id === g.id && t.kind === 'investment' && isDone(t, today) && t.date >= m.start && t.date <= m.end).reduce((x, t) => x + t.amount, 0), 0) / 3
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
