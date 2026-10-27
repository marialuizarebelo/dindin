import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { buckets, inRange } from '../lib/period'
import { compact, fmtDate, money } from '../lib/format'
import { solid } from '../lib/colors'
import { PeriodBar, usePeriod } from '../components/PeriodBar'
import { useTxSheet } from '../components/TxSheet'
import { Icon } from '../components/Icon'
import { Card, Money, PageTitle, Seg, Sheet } from '../components/ui'
import type { ColorKey, Transaction } from '../lib/types'

interface Row { id: string; name: string; icon: string; color: ColorKey; cells: number[]; txs: Transaction[][]; total: number }
interface Group { title: string; tone: 'green' | 'purple' | 'orange' | 'blue'; rows: Row[] }

export default function SheetPage() {
  const { data } = useStore()
  const { period } = usePeriod()
  const { edit } = useTxSheet()
  const [mode, setMode] = useState<'real' | 'prev'>('prev')
  const [detail, setDetail] = useState<{ title: string; txs: Transaction[] } | null>(null)

  const bs = useMemo(() => buckets(period), [period])

  const { groups, totals } = useMemo(() => {
    const pool = data.transactions.filter((t) => (mode === 'prev' ? true : t.paid) && inRange(t.date, { start: bs[0].start, end: bs[bs.length - 1].end }))
    const idx = (date: string) => bs.findIndex((b) => date >= b.start && date <= b.end)
    const build = (filter: (t: Transaction) => boolean, key: (t: Transaction) => string | null, meta: (id: string) => { name: string; icon: string; color: ColorKey }): Row[] => {
      const m = new Map<string, Row>()
      for (const t of pool) {
        if (!filter(t)) continue
        const i = idx(t.date)
        if (i < 0) continue
        const k = key(t) ?? '_none'
        let r = m.get(k)
        if (!r) {
          const mt = k === '_none' ? { name: 'Sem categoria', icon: 'circle', color: 'gray' as ColorKey } : meta(k)
          r = { id: k, ...mt, cells: bs.map(() => 0), txs: bs.map(() => []), total: 0 }
          m.set(k, r)
        }
        r.cells[i] += t.amount
        r.txs[i].push(t)
        r.total += t.amount
      }
      return [...m.values()].sort((a, b) => b.total - a.total)
    }
    const catMeta = (id: string) => data.categories.find((c) => c.id === id) ?? { name: '?', icon: 'circle', color: 'gray' as ColorKey }
    const srcMeta = (id: string) => data.sources.find((c) => c.id === id) ?? { name: '?', icon: 'wallet', color: 'gray' as ColorKey }
    const income = build((t) => t.kind === 'income', (t) => t.source_id, srcMeta)
    const fixed = build((t) => t.kind === 'expense' && t.nature === 'fixed', (t) => t.category_id, catMeta)
    const variable = build((t) => t.kind === 'expense' && t.nature !== 'fixed', (t) => t.category_id, catMeta)
    const invest = build((t) => t.kind === 'investment', (t) => t.category_id, catMeta)
    const sum = (rows: Row[]) => bs.map((_, i) => rows.reduce((a, r) => a + r.cells[i], 0))
    const gi = sum(income), gf = sum(fixed), gv = sum(variable), gn = sum(invest)
    const groups: Group[] = [
      { title: 'Receitas', tone: 'green', rows: income },
      { title: 'Despesas fixas', tone: 'purple', rows: fixed },
      { title: 'Despesas variáveis', tone: 'orange', rows: variable },
      { title: 'Investimentos', tone: 'blue', rows: invest },
    ]
    return { groups, totals: { income: gi, expense: gi.map((_, i) => gf[i] + gv[i]), invest: gn, left: gi.map((v, i) => v - gf[i] - gv[i] - gn[i]) } }
  }, [data, bs, mode])

  const sumArr = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const max = (r: Row) => Math.max(...r.cells, 1)

  return (
    <>
      <PageTitle title="Planilha" subtitle="Cada linha é uma categoria; clique num valor pra ver os lançamentos"
        actions={<Seg value={mode} onChange={setMode} options={[{ value: 'prev', label: 'Previsto' }, { value: 'real', label: 'Realizado' }]} />} />
      <PeriodBar grans={['week', 'month', 'quarter', 'semester', 'year', 'custom']} />

      <Card className="!p-0 overflow-hidden" delay={60}>
        <div className="overflow-auto max-h-[70dvh]">
          <table className="sheet num">
            <thead>
              <tr>
                <th style={{ minWidth: 160 }}>Categoria</th>
                {bs.map((b) => <th key={b.key} style={{ minWidth: 62 }}>{b.label}</th>)}
                <th style={{ minWidth: 100 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g.title} g={g} max={max}
                  onCell={(r, i) => r.txs[i].length && setDetail({ title: `${r.name} · ${bs[i].label}`, txs: r.txs[i] })}
                  onTotal={(r) => setDetail({ title: r.name, txs: r.txs.flat() })}
                  cols={bs.length}
                />
              ))}
              <tr className="group"><td colSpan={bs.length + 2}>Resumo</td></tr>
              <SumRow name="Recebido" arr={totals.income} color="var(--c-green)" />
              <SumRow name="Gasto" arr={totals.expense} color="var(--c-red)" />
              <SumRow name="Investido" arr={totals.invest} color="var(--c-blue)" />
              <tr className="total">
                <td>Sobra</td>
                {totals.left.map((v, i) => <td key={i} style={{ color: v < 0 ? 'var(--c-red)' : undefined }} className="money">{v === 0 ? '–' : compact(v)}</td>)}
                <td className="money" style={{ color: sumArr(totals.left) < 0 ? 'var(--c-red)' : 'var(--c-green)' }}>{money(sumArr(totals.left))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.title} wide>
        <div className="flex flex-col">
          {detail?.txs.sort((a, b) => (a.date < b.date ? -1 : 1)).map((t) => (
            <button key={t.id} onClick={() => { setDetail(null); edit(t) }} className="flex items-center justify-between gap-3 py-2.5 border-0 border-b border-hair bg-transparent text-left">
              <span><span className="block text-[14.5px] font-medium">{t.description}</span><span className="text-[12.5px] text-ink2">{fmtDate(t.date)}{t.paid ? '' : ' · pendente'}</span></span>
              <Money v={t.amount} className="font-semibold" />
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}

function GroupRows({ g, max, onCell, onTotal, cols }: { g: Group; max: (r: Row) => number; onCell: (r: Row, i: number) => void; onTotal: (r: Row) => void; cols: number }) {
  if (!g.rows.length) return null
  const color = solid(g.tone)
  return (
    <>
      <tr className="group"><td colSpan={cols + 2}>{g.title}</td></tr>
      {g.rows.map((r) => (
        <tr key={r.id}>
          <td><span className="inline-flex items-center gap-2"><Icon name={r.icon} size={15} className="text-ink2 shrink-0" />{r.name}</span></td>
          {r.cells.map((v, i) => (
            <td key={i} className={`cell money ${v === 0 ? 'zero' : ''}`} onClick={() => onCell(r, i)}
              style={v ? { background: `color-mix(in srgb, ${color} ${Math.round((v / max(r)) * 26)}%, transparent)` } : undefined}>
              {v === 0 ? '·' : compact(v)}
            </td>
          ))}
          <td className="cell money font-semibold" onClick={() => onTotal(r)}>{money(r.total)}</td>
        </tr>
      ))}
    </>
  )
}

function SumRow({ name, arr, color }: { name: string; arr: number[]; color: string }) {
  return (
    <tr className="total">
      <td><i className="dot mr-2" style={{ background: color }} />{name}</td>
      {arr.map((v, i) => <td key={i} className={`money ${v === 0 ? 'zero' : ''}`}>{v === 0 ? '·' : compact(v)}</td>)}
      <td className="money">{money(arr.reduce((a, b) => a + b, 0))}</td>
    </tr>
  )
}
