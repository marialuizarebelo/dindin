import { useEffect, useState, type ReactNode } from 'react'
import { evalExpr, hasOperator } from '../lib/calc'
import { money } from '../lib/format'
import type { Account, Card, ColorKey } from '../lib/types'
import { Icon } from './Icon'
import { Chip, Field } from './ui'

export const fmtInput = (n: number) => String(n).replace('.', ',')

/** Campo de valor grande, com calculadora: aceita "12,50+30" e mostra o resultado. */
export function AmountInput({ value, onChange, color, onEnter, allowNegative }: {
  value: string; onChange: (v: string) => void; color: string; onEnter?: () => void; allowNegative?: boolean
}) {
  const result = hasOperator(value) ? evalExpr(value) : null
  return (
    <div className="text-center py-1">
      <div className="flex items-baseline justify-center gap-1.5" style={{ color }}>
        <span className="text-xl font-medium opacity-70">R$</span>
        <input autoFocus inputMode={allowNegative ? 'text' : 'decimal'} placeholder="0,00" value={value} aria-label="Valor"
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => { if (result !== null) onChange(fmtInput(result)) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { if (result !== null) { onChange(fmtInput(result)); e.preventDefault() } else onEnter?.() } }}
          className="num bg-transparent border-0 outline-none text-center text-[44px] font-bold w-[min(300px,72%)] placeholder:opacity-30"
          style={{ color }} />
      </div>
      <div className="text-[12px] text-ink3 h-4">
        {result !== null ? <>= <b className="text-ink2 money">{money(result)}</b> · toque fora para aplicar</> : 'Dica: dá pra somar, ex.: 12,50+30'}
      </div>
    </div>
  )
}

/** Escolha de conta (e, se `cards` vier, de cartao) em forma de chips. */
export function WherePicker({ label, accounts, cards, accountId, cardId, onPick }: {
  label: string; accounts: Account[]; cards?: Card[]; accountId: string | null; cardId: string | null
  onPick: (v: { accountId: string | null; cardId: string | null }) => void
}) {
  const accs = accounts.filter((a) => !a.archived)
  const crds = (cards ?? []).filter((c) => !c.archived)
  if (!accs.length && !crds.length) return null
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {accs.map((a) => (
          <Chip key={a.id} color={a.color} active={accountId === a.id && !cardId} onClick={() => onPick({ accountId: a.id, cardId: null })}>
            <Icon name={a.icon} size={15} /> {a.name}
          </Chip>
        ))}
        {crds.map((c) => (
          <Chip key={c.id} color={c.color} active={cardId === c.id} onClick={() => onPick({ accountId: null, cardId: c.id })}>
            <Icon name={c.icon} size={15} /> {c.name}
          </Chip>
        ))}
      </div>
    </Field>
  )
}

/** Escolha unica entre itens com nome, icone e cor (grupo, caixinha...). Clicar de novo desmarca. */
export function ItemPicker<T extends { id: string; name: string; icon: string; color: ColorKey }>({ label, items, value, onChange, optional = true }: {
  label: string; items: T[]; value: string | null; onChange: (id: string | null) => void; optional?: boolean
}) {
  if (!items.length) return null
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <Chip key={it.id} color={it.color} active={value === it.id} onClick={() => onChange(value === it.id && optional ? null : it.id)}>
            <Icon name={it.icon} size={15} /> {it.name}
          </Chip>
        ))}
      </div>
    </Field>
  )
}

/** Campo de tags: Enter ou virgula adiciona. */
export function TagsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('')
  const commit = () => {
    const parts = text.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean)
    if (parts.length) onChange([...new Set([...value, ...parts])])
    setText('')
  }
  return (
    <div className="flex flex-wrap gap-1.5 items-center rounded-xl bg-[var(--field)] px-2 py-1.5 min-h-[42px]">
      {value.map((t) => (
        <button key={t} type="button" className="tag" style={{ '--c': 'var(--c-gray)' } as React.CSSProperties} onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remover ${t}`}>
          #{t} ×
        </button>
      ))}
      <input className="flex-1 min-w-[90px] bg-transparent border-0 outline-none text-[14px] px-1" placeholder={value.length ? '' : 'viagem, presente… (Enter)'}
        value={text} onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() } }} />
    </div>
  )
}

export function Collapsible({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => { if (defaultOpen) setOpen(true) }, [defaultOpen])
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="bg-transparent border-0 p-0 text-[13.5px] font-medium text-accent flex items-center gap-1">
        {open ? '− ' : '+ '}{title}
      </button>
      {open && <div className="flex flex-col gap-4 mt-3">{children}</div>}
    </div>
  )
}
