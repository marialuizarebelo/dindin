import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { useLookup } from '../lib/lookup'
import { fmtDate, money, moneyInt, percent } from '../lib/format'
import { solid } from '../lib/colors'
import { lastMonths, todayISO } from '../lib/period'
import { allVaultsStats, vaultHistory } from '../lib/balances'
import { VAULT_KIND } from '../lib/labels'
import { txTitle } from '../lib/tx'
import type { Vault } from '../lib/types'
import { Donut, LineChart, Sparkline } from '../components/Charts'
import { VaultForm } from '../components/EntityForms'
import { IconBadge } from '../components/Icon'
import { useTxSheet } from '../components/TxSheet'
import { Card, Empty, Field, Money, PageTitle, Sheet, Tag, TintCard } from '../components/ui'
import { evalExpr } from '../lib/calc'

export default function Vaults() {
  const { data, add, notify } = useStore()
  const { open, edit } = useTxSheet()
  const { vaults: vmap } = useLookup()
  const today = todayISO()
  const [editing, setEditing] = useState<Vault | 'new' | null>(null)
  const [adjust, setAdjust] = useState<{ vault: Vault; balance: number } | null>(null)
  const [adjustText, setAdjustText] = useState('')

  const all = useMemo(() => allVaultsStats(data, today), [data, today])
  const months = useMemo(() => lastMonths(today, 12), [today])
  const ends = months.map((m) => m.end)
  const hist = useMemo(() => {
    const per = new Map(all.list.map((s) => [s.vault.id, vaultHistory(data, s.vault, ends, today)]))
    const sum = (k: 'balance' | 'invested') => ends.map((_, i) => [...per.values()].reduce((a, h) => a + h[k][i], 0))
    return { per, balance: sum('balance'), invested: sum('invested') }
  }, [data, all.list, ends, today])
  const monthYield = data.transactions.filter((t) => t.kind === 'yield' && t.date.slice(0, 7) === today.slice(0, 7) && t.date <= today).reduce((a, t) => a + t.amount, 0)
  const moves = useMemo(
    () => data.transactions.filter((t) => (t.kind === 'investment' || t.kind === 'redeem' || t.kind === 'yield') && t.vault_id && t.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10),
    [data.transactions, today],
  )

  const saveAdjust = () => {
    if (!adjust) return
    const v = evalExpr(adjustText)
    if (v === null || v < 0) return notify('Valor inválido', 'error')
    const diff = Math.round((v - adjust.balance) * 100) / 100
    if (diff === 0) { setAdjust(null); return }
    add('transactions', {
      kind: 'yield', date: today, amount: diff, description: 'Ajuste de saldo', paid: true, vault_id: adjust.vault.id,
      category_id: null, source_id: null, nature: null, goal_id: null, debt_id: null, recurring_id: null, group_id: null, account_id: null,
      to_account_id: null, card_id: null, invoice_month: null, tags: [], note: 'Saldo atualizado pelo valor atual da caixinha',
      installment_group: null, installment_no: null, installment_total: null,
    })
    notify(diff > 0 ? `Rendimento de ${money(diff)} registrado` : `Variação de ${money(diff)} registrada`)
    setAdjust(null)
  }

  return (
    <>
      <PageTitle title="Caixinhas" subtitle="O que você guarda e quanto está rendendo"
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nova caixinha</button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <TintCard color="purple" icon="piggy" label="Total guardado" delay={20}><div className="money num font-display kpi-num strong">{money(all.balance)}</div><div className="text-[12.5px] text-ink2 mt-2.5">{all.list.length} {all.list.length === 1 ? 'caixinha' : 'caixinhas'}</div></TintCard>
        <TintCard color="blue" icon="coins" label="Total investido" delay={60}><div className="money num font-display kpi-num">{money(all.netInvested)}</div><div className="text-[12.5px] text-ink2 mt-2.5">aportes − resgates</div></TintCard>
        <TintCard color="green" icon="trend" label="Rendimento" delay={100}><div className="money num font-display kpi-num">{money(all.yields)}</div><div className="text-[12.5px] text-ink2 mt-2.5">{all.netInvested > 0 ? `${percent(all.yieldPct, 2)} sobre o investido` : '—'}</div></TintCard>
        <TintCard color="yellow" icon="sparkles" label="Rendeu no mês" delay={140}><div className="money num font-display kpi-num">{money(monthYield)}</div><div className="text-[12.5px] text-ink2 mt-2.5"><span className="capitalize">{format(new Date(), 'MMMM', { locale: ptBR })}</span></div></TintCard>
      </div>

      {all.list.length === 0 ? (
        <Card><Empty icon="piggy" title="Crie sua primeira caixinha">Reserva, viagem, Tesouro Selic, CDB… pode ter quantas quiser. Depois é só aportar, resgatar e registrar o rendimento.</Empty></Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3 mb-5">
            <Card className="lg:col-span-2" delay={180}>
              <div className="font-semibold text-[16px] mb-3">Evolução em 12 meses</div>
              <LineChart labels={months.map((m) => m.label)} height={250} series={[
                { name: 'Total guardado', color: solid('purple'), values: hist.balance },
                { name: 'Total investido', color: solid('blue'), values: hist.invested },
              ]} />
              <div className="flex gap-4 mt-2 text-[12.5px] text-ink2">
                <span className="flex items-center gap-1.5"><i className="dot" style={{ background: solid('purple') }} />Total guardado</span>
                <span className="flex items-center gap-1.5"><i className="dot" style={{ background: solid('blue') }} />Total investido (a diferença é o rendimento)</span>
              </div>
            </Card>
            <Card delay={220}>
              <div className="font-semibold text-[16px] mb-3">Onde está guardado</div>
              <div className="flex flex-col items-center gap-4">
                <Donut size={150} thickness={18} slices={all.list.map((s) => ({ label: s.vault.name, value: Math.max(s.balance, 0), color: solid(s.vault.color) }))}>
                  <div><div className="text-[11.5px] text-ink2">Total</div><div className="money num font-semibold">{moneyInt(all.balance)}</div></div>
                </Donut>
                <div className="w-full flex flex-col gap-1.5">
                  {all.list.map((s) => (
                    <div key={s.vault.id} className="flex items-center gap-2 text-[13.5px]"><i className="dot" style={{ background: solid(s.vault.color) }} /><span className="flex-1 truncate">{s.vault.name}</span><span className="num text-ink2">{all.balance > 0 ? percent(s.balance / all.balance) : '—'}</span></div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-5">
            {all.list.map((s, i) => (
              <Card key={s.vault.id} delay={260 + i * 30}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <IconBadge name={s.vault.icon} color={s.vault.color} size={44} />
                    <div className="min-w-0"><div className="font-semibold truncate">{s.vault.name}</div><div className="text-[12.5px] text-ink2 truncate">{s.vault.institution || VAULT_KIND[s.vault.kind]}</div></div>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditing(s.vault)}>Editar</button>
                </div>
                <div className="flex items-end justify-between mt-4">
                  <div><div className="text-[12px] text-ink2">Saldo</div><div className="money num font-display text-[30px] leading-none mt-1">{money(s.balance)}</div></div>
                  <Sparkline values={hist.per.get(s.vault.id)?.balance ?? []} color={solid(s.vault.color)} width={92} height={34} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-[13px]">
                  <div className="rounded-xl bg-[var(--field)] px-3 py-2"><div className="text-ink2 text-[11.5px]">Investido</div><div className="money num font-semibold">{money(s.netInvested)}</div></div>
                  <div className="rounded-xl px-3 py-2" style={{ background: 'color-mix(in srgb, var(--c-green) 16%, transparent)' }}><div className="text-ink2 text-[11.5px]">Rendimento</div><div className="money num font-semibold">{money(s.yields)}{s.netInvested > 0 && <span className="text-ink2 font-normal"> · {percent(s.yieldPct, 1)}</span>}</div></div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button className="btn btn-sm" onClick={() => open({ kind: 'investment', vault_id: s.vault.id })}>Aportar</button>
                  <button className="btn btn-sm" onClick={() => open({ kind: 'redeem', vault_id: s.vault.id })}>Resgatar</button>
                  <button className="btn btn-sm" onClick={() => open({ kind: 'yield', vault_id: s.vault.id })}>Rendeu</button>
                </div>
                <button className="btn btn-sm btn-ghost w-full mt-2" onClick={() => { setAdjust({ vault: s.vault, balance: s.balance }); setAdjustText('') }}>Atualizar pelo saldo do app do banco</button>
              </Card>
            ))}
          </div>

          <Card delay={400}>
            <div className="font-semibold text-[16px] mb-1">Últimas movimentações</div>
            {moves.length === 0 ? <Empty icon="pen" title="Nenhuma movimentação ainda" /> : moves.map((t) => {
              const v = t.vault_id ? vmap.get(t.vault_id) : null
              return (
                <button key={t.id} onClick={() => edit(t)} className="w-full flex items-center gap-3 py-2.5 bg-transparent border-0 border-b border-hair last:border-0 text-left">
                  <IconBadge name={v?.icon ?? 'piggy'} color={v?.color ?? 'purple'} size={36} />
                  <span className="flex-1 min-w-0"><span className="block truncate text-[14.5px] font-medium">{txTitle(t)}</span><span className="text-[12.5px] text-ink2">{fmtDate(t.date)} · {v?.name}</span></span>
                  <Tag color={t.kind === 'yield' ? 'green' : t.kind === 'redeem' ? 'orange' : 'purple'}>{t.kind === 'yield' ? 'Rendimento' : t.kind === 'redeem' ? 'Resgate' : 'Aporte'}</Tag>
                  <Money v={t.kind === 'redeem' ? -t.amount : t.amount} sign className="font-semibold text-[14.5px] w-[92px] text-right" />
                </button>
              )
            })}
          </Card>
        </>
      )}

      {editing && <VaultForm vault={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {adjust && (
        <Sheet open onClose={() => setAdjust(null)} title={`Atualizar ${adjust.vault.name}`}
          footer={<button className="btn btn-primary" onClick={saveAdjust}>Salvar</button>}>
          <div className="flex flex-col gap-3">
            <div className="text-[13.5px] text-ink2">No app do banco aparece o saldo já com o rendimento. Digite aqui e eu registro a diferença como rendimento.</div>
            <div className="rounded-xl bg-[var(--field)] px-3 py-2.5 text-[13.5px]">Saldo no dindin: <b className="money num">{money(adjust.balance)}</b></div>
            <Field label="Saldo atual na caixinha (R$)"><input className="input" autoFocus inputMode="decimal" placeholder="0,00" value={adjustText} onChange={(e) => setAdjustText(e.target.value)} /></Field>
            {evalExpr(adjustText) !== null && (
              <div className="text-[13.5px]">Será registrado: <b className="money num">{money(Math.round(((evalExpr(adjustText) ?? 0) - adjust.balance) * 100) / 100)}</b></div>
            )}
          </div>
        </Sheet>
      )}
    </>
  )
}
