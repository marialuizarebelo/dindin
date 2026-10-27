import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarCheck, CalendarDays, CreditCard, Eye, EyeOff, Landmark, LayoutDashboard, ListOrdered, Moon, MoreHorizontal, PiggyBank, Plus,
  Settings as SettingsIcon, Sun, Table2, Target,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { cx, Sheet } from './ui'
import { useTxSheet } from './TxSheet'

const NAV = [
  { to: '/', label: 'Início', icon: LayoutDashboard },
  { to: '/lancamentos', label: 'Lançamentos', icon: ListOrdered },
  { to: '/agenda', label: 'Agenda e previsão', icon: CalendarDays },
  { to: '/contas', label: 'Contas e cartões', icon: CreditCard },
  { to: '/caixinhas', label: 'Caixinhas', icon: PiggyBank },
  { to: '/planilha', label: 'Planilha', icon: Table2 },
  { to: '/planejamento', label: 'Planejamento', icon: CalendarCheck },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/dividas', label: 'Dívidas', icon: Landmark },
  { to: '/ajustes', label: 'Ajustes', icon: SettingsIcon },
]

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-[10px] grid place-items-center text-white text-[16px] font-bold" style={{ background: 'linear-gradient(135deg, var(--accent-hi), var(--accent))', boxShadow: '0 4px 12px color-mix(in srgb, var(--accent) 40%, transparent)' }}>d</div>
      <span className="text-[20px] font-bold tracking-[-0.03em]">dindin</span>
    </div>
  )
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    const t = document.documentElement.dataset.theme
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    try { localStorage.setItem('dindin:theme', next ? 'dark' : 'light') } catch { /* ignore */ }
  }
  return { dark, toggle }
}

export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="fixed z-[60] left-1/2 -translate-x-1/2 top-3 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="glass-strong fade-up rounded-full px-4 py-2 text-[14px] font-medium" style={{ color: t.tone === 'error' ? 'var(--c-red)' : undefined }}>{t.text}</div>
      ))}
    </div>
  )
}

export default function Layout() {
  const { hidden, toggleHidden, demo } = useStore()
  const { open } = useTxSheet()
  const { dark, toggle } = useTheme()
  const [more, setMore] = useState(false)
  const loc = useLocation()
  useEffect(() => setMore(false), [loc.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n') { e.preventDefault(); open() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const tools: ReactNode = (
    <div className="glass flex items-center gap-0.5 rounded-full p-1">
      <button className="btn btn-ghost btn-icon !rounded-full" onClick={toggleHidden} aria-pressed={hidden}
        aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'} title={hidden ? 'Mostrar valores' : 'Esconder valores'}>
        {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
      <button className="btn btn-ghost btn-icon !rounded-full" onClick={toggle}
        aria-label={dark ? 'Modo diurno' : 'Modo noturno'} title={dark ? 'Modo diurno' : 'Modo noturno'}>
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  )

  return (
    <div className={cx('min-h-dvh', hidden && 'hide-money')}>
      {/* sidebar desktop */}
      <aside className="hidden lg:flex fixed left-4 top-4 bottom-4 w-[244px] sidebar rounded-[28px] flex-col p-4 z-20">
        <div className="px-2 pt-1 pb-5"><Brand /></div>
        <button className="btn btn-primary w-full mb-4 !h-11 !rounded-[14px]" onClick={() => open()}>
          <Plus size={18} /> Novo lançamento <kbd className="ml-1 text-[11px] opacity-70 border border-white/40 rounded px-1">N</kbd>
        </button>
        <nav className="flex flex-col gap-0.5 min-h-0 overflow-y-auto no-scrollbar">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => cx('side-link', isActive && 'is-active')}>
              <n.icon size={18} strokeWidth={1.9} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-3 border-t border-white/10 flex flex-col gap-1">
          {demo && <span className="text-[12px] px-3 pb-1" style={{ color: 'var(--side-ink-2)' }}>Modo demonstração</span>}
          <SwitchRow on={hidden} onClick={toggleHidden} icon={hidden ? <EyeOff size={18} /> : <Eye size={18} />}
            label="Ocultar valores" hint={hidden ? 'Valores escondidos' : undefined} />
          <SwitchRow on={dark} onClick={toggle} icon={dark ? <Moon size={18} /> : <Sun size={18} />}
            label="Modo noturno" />
        </div>
      </aside>

      {/* topo mobile */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),10px)] pb-2"
        style={{ background: 'color-mix(in srgb, var(--bg) 80%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <Brand />
        {tools}
      </header>

      <main className="lg:pl-[276px] px-4 lg:pr-8 pt-2 lg:pt-8 pb-32 lg:pb-12">
        <div className="max-w-[1160px] mx-auto">
          {demo && (
            <div className="lg:hidden mb-3 text-[12.5px] text-ink2 text-center">Modo demonstração · dados só neste navegador</div>
          )}
          <Outlet />
        </div>
      </main>

      {/* barra inferior mobile */}
      <nav className="lg:hidden fixed z-40 left-3 right-3 bottom-[max(env(safe-area-inset-bottom),10px)] dock rounded-[28px] h-[66px] grid grid-cols-5 items-center px-1">
        <Tab to="/" icon={LayoutDashboard} label="Início" end />
        <Tab to="/lancamentos" icon={ListOrdered} label="Lançar" />
        <button onClick={() => open()} aria-label="Novo lançamento" className="mx-auto -mt-7 h-[58px] w-[58px] rounded-full grid place-items-center text-white border-0"
          style={{ background: 'linear-gradient(180deg, var(--accent-hi), var(--accent))', boxShadow: '0 10px 24px color-mix(in srgb, var(--accent) 45%, transparent), inset 0 1px 0 rgba(255,255,255,.4)' }}>
          <Plus size={28} strokeWidth={2.4} />
        </button>
        <Tab to="/agenda" icon={CalendarDays} label="Agenda" />
        <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 bg-transparent border-0 text-[11px] font-medium" style={{ color: 'var(--side-ink-2)' }}>
          <MoreHorizontal size={22} strokeWidth={1.9} /> Mais
        </button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="Mais">
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {NAV.filter((n) => !['/', '/lancamentos', '/agenda'].includes(n.to)).map((n) => (
            <NavLink key={n.to} to={n.to} className="glass rounded-2xl p-4 flex flex-col gap-2 no-underline text-ink">
              <n.icon size={22} strokeWidth={1.8} className="text-accent" />
              <span className="font-semibold text-[14.5px]">{n.label}</span>
            </NavLink>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

/** Linha do menu lateral com interruptor (ocultar valores / modo noturno). */
function SwitchRow({ on, onClick, icon, label, hint }: { on: boolean; onClick: () => void; icon: ReactNode; label: string; hint?: string }) {
  return (
    <button type="button" onClick={onClick} role="switch" aria-checked={on}
      className="side-link w-full bg-transparent border-0 text-left cursor-pointer">
      {icon}
      <span className="flex-1 min-w-0">
        <span className="block leading-tight">{label}</span>
        {hint && <span className="block text-[11.5px] leading-tight opacity-70">{hint}</span>}
      </span>
      <span className="relative h-[22px] w-[38px] rounded-full shrink-0 transition-colors" style={{ background: on ? 'var(--accent)' : 'rgba(255,255,255,.22)' }}>
        <i className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all" style={{ left: on ? 18 : 2 }} />
      </span>
    </button>
  )
}

function Tab({ to, icon: Icon, label, end }: { to: string; icon: typeof Plus; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 no-underline text-[11px] font-medium', isActive ? 'text-[var(--accent-hi)]' : 'text-[var(--side-ink-2)]')}>
      <Icon size={22} strokeWidth={1.9} /> {label}
    </NavLink>
  )
}
