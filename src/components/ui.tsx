import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownRight, ArrowUpRight, X } from 'lucide-react'
import { money } from '../lib/format'
import { solid } from '../lib/colors'
import { Icon, IconBadge, ICON_KEYS } from './Icon'
import type { ColorKey } from '../lib/types'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
const cssVar = (c: ColorKey) => ({ '--c': solid(c) }) as CSSProperties

export function Card({ children, className, delay = 0, ...rest }: { children: ReactNode; className?: string; delay?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('glass card fade-up', className)} style={{ animationDelay: `${delay}ms`, ...rest.style }}>
      {children}
    </div>
  )
}

/** Cartao com fundo colorido suave: rotulo em caixa alta + icone + valor grande. */
export function TintCard({ color, label, icon, right, children, delay = 0, className }: {
  color: ColorKey; label: string; icon: string; right?: ReactNode; children: ReactNode; delay?: number; className?: string
}) {
  return (
    <div className={cx('card tint fade-up !p-4 sm:!p-5', className)} style={{ ...cssVar(color), animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="hidden sm:block"><IconBadge name={icon} color={color} size={30} /></span>
          <span className="kpi-label leading-tight">{label}</span>
        </span>
        {right}
      </div>
      {children}
    </div>
  )
}

export function Tag({ color, children, className }: { color: ColorKey; children: ReactNode; className?: string }) {
  return <span className={cx('tag', className)} style={cssVar(color)}>{children}</span>
}

export function Dot({ color }: { color: ColorKey }) {
  return <i className="dot" style={cssVar(color)} />
}

/** Valor em reais; some quando o "modo discreto" esta ligado. */
export function Money({ v, className, sign }: { v: number; className?: string; sign?: boolean }) {
  return <span className={cx('money num', className)}>{sign && v > 0 ? '+' : ''}{money(v)}</span>
}

export function Seg<T extends string>({ value, onChange, options, full, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; full?: boolean; className?: string
}) {
  return (
    <div className={cx('seg', full && 'seg-full', className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Chip({ active, color, onClick, children }: { active: boolean; color?: ColorKey; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="chip" aria-pressed={active} onClick={onClick} style={color ? cssVar(color) : undefined}>
      {children}
    </button>
  )
}

export function Field({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
    </div>
  )
}

export function Progress({ value, color = 'blue' }: { value: number; color?: ColorKey }) {
  return (
    <div className="progress" style={cssVar(color)}>
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

export function Delta({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return null
  const up = value >= 0
  const good = invert ? !up : up
  const c = Math.abs(value) < 0.005 ? 'gray' : good ? 'green' : 'red'
  return (
    <Tag color={c as ColorKey}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value * 100).toFixed(0)}%
    </Tag>
  )
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 gap-1">
      <span className="grid place-items-center h-12 w-12 rounded-2xl mb-2 text-ink2" style={{ background: 'var(--field)' }}>
        <Icon name={icon} size={22} strokeWidth={1.5} />
      </span>
      <div className="font-semibold">{title}</div>
      {children && <div className="text-ink2 text-sm max-w-xs">{children}</div>}
    </div>
  )
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap mb-4 fade-up">
      <div>
        <h1 className="font-display text-[32px] sm:text-[40px] font-normal tracking-[0.005em] leading-[1.1] m-0">{title}</h1>
        {subtitle && <p className="text-ink2 m-0 mt-0.5 text-sm">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

/** Folha: modal central no desktop, "bottom sheet" no celular. */
export function Sheet({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 fade-in" style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div
        className={cx(
          'glass-sheet sheet-in relative w-full max-h-[92dvh] flex flex-col rounded-t-[28px] sm:rounded-[28px]',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-[460px]',
        )}
      >
        <div className="sm:hidden mx-auto mt-2 h-1 w-9 rounded-full bg-ink3" />
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="text-[17px] font-semibold">{title}</div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 pt-3 pb-5 safe-b border-t border-hair flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmButton({ onConfirm, children, className }: { onConfirm: () => void; children: ReactNode; className?: string }) {
  const [armed, setArmed] = useState(false)
  const t = useRef<number>()
  useEffect(() => () => window.clearTimeout(t.current), [])
  return (
    <button
      type="button"
      className={cx('btn btn-danger', className)}
      onClick={() => {
        if (armed) return onConfirm()
        setArmed(true)
        t.current = window.setTimeout(() => setArmed(false), 2500)
      }}
    >
      {armed ? 'Confirmar?' : children}
    </button>
  )
}

export function IconPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ICON_KEYS.map((k) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-label={k}
          className={cx('h-9 w-9 rounded-xl grid place-items-center border border-transparent bg-transparent', value === k ? 'bg-[var(--accent-soft)] !border-[var(--accent)] text-accent' : 'text-ink2 hover:bg-[var(--field)]')}>
          <Icon name={k} size={17} />
        </button>
      ))}
    </div>
  )
}

export function ColorPick({ value, onChange, keys }: { value: ColorKey; onChange: (v: ColorKey) => void; keys: ColorKey[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((k) => (
        <button key={k} type="button" aria-label={k} onClick={() => onChange(k)}
          className="h-7 w-7 rounded-full border-2" style={{ background: solid(k), borderColor: value === k ? 'var(--ink)' : 'transparent' }} />
      ))}
    </div>
  )
}
