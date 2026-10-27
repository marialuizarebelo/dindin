import {
  addDays, addMonths, addYears, differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval,
  endOfMonth, endOfQuarter, endOfWeek, endOfYear, format, getISOWeek, parseISO, startOfMonth,
  startOfQuarter, startOfWeek, startOfYear, subDays, getMonth,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type Gran = 'day' | 'week' | 'month' | 'quarter' | 'semester' | 'year' | 'custom'

export interface Period {
  gran: Gran
  anchor: string // yyyy-MM-dd
  from?: string // custom
  to?: string
}

export interface Range { start: string; end: string }
export interface Bucket extends Range { key: string; label: string }

export const GRAN_LABELS: Record<Gran, string> = {
  day: 'Dia', week: 'Semana', month: 'Mês', quarter: 'Trimestre',
  semester: 'Semestre', year: 'Ano', custom: 'Período',
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const WEEK = { weekStartsOn: 1 as const }

export const todayISO = () => iso(new Date())
export const monthKey = (d: string) => d.slice(0, 7)
export const defaultPeriod = (): Period => ({ gran: 'month', anchor: todayISO() })

export function rangeOf(p: Period): Range {
  const a = parseISO(p.anchor)
  switch (p.gran) {
    case 'day': return { start: iso(a), end: iso(a) }
    case 'week': return { start: iso(startOfWeek(a, WEEK)), end: iso(endOfWeek(a, WEEK)) }
    case 'month': return { start: iso(startOfMonth(a)), end: iso(endOfMonth(a)) }
    case 'quarter': return { start: iso(startOfQuarter(a)), end: iso(endOfQuarter(a)) }
    case 'semester': {
      const y = a.getFullYear()
      return getMonth(a) < 6
        ? { start: `${y}-01-01`, end: `${y}-06-30` }
        : { start: `${y}-07-01`, end: `${y}-12-31` }
    }
    case 'year': return { start: iso(startOfYear(a)), end: iso(endOfYear(a)) }
    case 'custom': {
      const s = p.from ?? p.anchor
      const e = p.to ?? p.anchor
      return s <= e ? { start: s, end: e } : { start: e, end: s }
    }
  }
}

function stepOf(gran: Gran): (d: Date, n: number) => Date {
  switch (gran) {
    case 'day': return addDays
    case 'week': return (d, n) => addDays(d, 7 * n)
    case 'month': return addMonths
    case 'quarter': return (d, n) => addMonths(d, 3 * n)
    case 'semester': return (d, n) => addMonths(d, 6 * n)
    default: return addYears
  }
}

export function shift(p: Period, dir: 1 | -1): Period {
  if (p.gran === 'custom') {
    const r = rangeOf(p)
    const span = differenceInCalendarDays(parseISO(r.end), parseISO(r.start)) + 1
    return {
      ...p,
      from: iso(addDays(parseISO(r.start), dir * span)),
      to: iso(addDays(parseISO(r.end), dir * span)),
    }
  }
  return { ...p, anchor: iso(stepOf(p.gran)(parseISO(p.anchor), dir)) }
}

export function previousRange(p: Period): Range {
  return rangeOf(shift(p, -1))
}

export function labelOf(p: Period): string {
  const a = parseISO(p.anchor)
  const r = rangeOf(p)
  const s = parseISO(r.start)
  const e = parseISO(r.end)
  switch (p.gran) {
    case 'day': return format(a, "EEEE, d 'de' MMMM", { locale: ptBR })
    case 'week':
      return `Semana ${getISOWeek(a)} · ${format(s, 'd MMM', { locale: ptBR })} – ${format(e, 'd MMM', { locale: ptBR })}`
    case 'month': return format(a, 'MMMM yyyy', { locale: ptBR })
    case 'quarter': return `${Math.floor(getMonth(a) / 3) + 1}º trimestre ${a.getFullYear()}`
    case 'semester': return `${getMonth(a) < 6 ? 1 : 2}º semestre ${a.getFullYear()}`
    case 'year': return String(a.getFullYear())
    case 'custom':
      return `${format(s, 'd MMM yyyy', { locale: ptBR })} – ${format(e, 'd MMM yyyy', { locale: ptBR })}`
  }
}

/** Divisoes usadas nos graficos e na planilha: dias ou meses. */
export function buckets(p: Period): Bucket[] {
  const r = rangeOf(p)
  const days = (start: string, end: string, long: boolean): Bucket[] =>
    eachDayOfInterval({ start: parseISO(start), end: parseISO(end) }).map((d) => ({
      key: iso(d), start: iso(d), end: iso(d),
      label: long ? format(d, 'EEE d', { locale: ptBR }) : format(d, 'd'),
    }))
  const months = (start: string, end: string): Bucket[] =>
    eachMonthOfInterval({ start: parseISO(start), end: parseISO(end) }).map((d) => ({
      key: format(d, 'yyyy-MM'), start: iso(startOfMonth(d)), end: iso(endOfMonth(d)),
      label: format(d, 'MMM', { locale: ptBR }).replace('.', ''),
    }))

  switch (p.gran) {
    case 'day': return days(iso(subDays(parseISO(r.end), 6)), r.end, true)
    case 'week': return days(r.start, r.end, true)
    case 'month': return days(r.start, r.end, false)
    case 'quarter':
    case 'semester':
    case 'year': return months(r.start, r.end)
    case 'custom':
      return differenceInCalendarDays(parseISO(r.end), parseISO(r.start)) <= 62
        ? days(r.start, r.end, false)
        : months(r.start, r.end)
  }
}

/** Ultimos n meses terminando no mes de `end`. */
export function lastMonths(end: string, n: number): Bucket[] {
  const e = startOfMonth(parseISO(end))
  return eachMonthOfInterval({ start: addMonths(e, -(n - 1)), end: e }).map((d) => ({
    key: format(d, 'yyyy-MM'), start: iso(startOfMonth(d)), end: iso(endOfMonth(d)),
    label: format(d, 'MMM', { locale: ptBR }).replace('.', ''),
  }))
}

export const inRange = (date: string, r: Range) => date >= r.start && date <= r.end

export function clampDay(ym: string, day: number): string {
  const last = endOfMonth(parseISO(`${ym}-01`)).getDate()
  return `${ym}-${String(Math.min(day, last)).padStart(2, '0')}`
}

export const nextMonthKey = (ym: string) => format(addMonths(parseISO(`${ym}-01`), 1), 'yyyy-MM')
