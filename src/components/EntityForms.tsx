import { useState, type ReactNode } from 'react'
import { useStore } from '../lib/store'
import { parseMoney } from '../lib/format'
import { ACCOUNT_KIND, VAULT_KIND } from '../lib/labels'
import { COLOR_KEYS } from '../lib/colors'
import type { Account, AccountKind, Card, ColorKey, Group, Vault, VaultKind } from '../lib/types'
import { ColorPick, ConfirmButton, Field, IconPick, Sheet } from './ui'
import { Toggle } from './TxSheet'
import { fmtInput } from './TxFields'

function FormShell({ title, onClose, onSave, onDelete, children, err }: {
  title: string; onClose: () => void; onSave: () => void; onDelete?: () => void; children: ReactNode; err: string
}) {
  return (
    <Sheet open onClose={onClose} title={title}
      footer={<>{onDelete && <ConfirmButton className="mr-auto" onConfirm={onDelete}>Apagar</ConfirmButton>}<button className="btn btn-primary" onClick={onSave}>Salvar</button></>}>
      <div className="flex flex-col gap-4">
        {children}
        {err && <div className="text-[13px] text-expense">{err}</div>}
      </div>
    </Sheet>
  )
}

export function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const { add, update, remove, notify, data } = useStore()
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'checking')
  const [icon, setIcon] = useState(account?.icon ?? 'bank')
  const [color, setColor] = useState<ColorKey>(account?.color ?? 'blue')
  const [initial, setInitial] = useState(account ? fmtInput(account.initial_balance) : '')
  const [archived, setArchived] = useState(account?.archived ?? false)
  const [err, setErr] = useState('')
  const used = account ? data.transactions.filter((t) => t.account_id === account.id || t.to_account_id === account.id).length : 0
  const save = () => {
    if (!name.trim()) return setErr('Dê um nome para a conta')
    const row = { name: name.trim(), kind, icon, color, initial_balance: parseMoney(initial) || 0, archived }
    if (account) update('accounts', account.id, row)
    else add('accounts', row)
    notify('Conta salva')
    onClose()
  }
  return (
    <FormShell title={account ? 'Editar conta' : 'Nova conta'} onClose={onClose} onSave={save} err={err}
      onDelete={account ? () => { remove('accounts', [account.id]); onClose() } : undefined}>
      <Field label="Nome"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank, Vale-alimentação, Carteira" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
            {(Object.keys(ACCOUNT_KIND) as AccountKind[]).map((k) => <option key={k} value={k}>{ACCOUNT_KIND[k]}</option>)}
          </select>
        </Field>
        <Field label="Saldo hoje (R$)"><input className="input" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0,00" /></Field>
      </div>
      <div className="text-[12px] text-ink2 -mt-2">O saldo inicial é o ponto de partida; a partir dele o app soma e subtrai seus lançamentos.</div>
      <Field label="Ícone"><IconPick value={icon} onChange={setIcon} /></Field>
      <Field label="Cor"><ColorPick value={color} onChange={setColor} keys={COLOR_KEYS} /></Field>
      {account && <Toggle checked={archived} onChange={setArchived} label="Arquivar" hint="Some das listas e da previsão, mas o histórico fica." />}
      {used > 0 && <div className="text-[12.5px] text-ink2">{used} lançamentos usam esta conta. Se apagar, eles ficam “sem conta”.</div>}
    </FormShell>
  )
}

export function CardForm({ card, onClose }: { card?: Card; onClose: () => void }) {
  const { add, update, remove, notify, data } = useStore()
  const [name, setName] = useState(card?.name ?? '')
  const [limit, setLimit] = useState(card ? fmtInput(card.limit_amount) : '')
  const [closing, setClosing] = useState(String(card?.closing_day ?? 25))
  const [due, setDue] = useState(String(card?.due_day ?? 5))
  const [payAccount, setPayAccount] = useState(card?.pay_account_id ?? '')
  const [groupId, setGroupId] = useState(card?.group_id ?? '')
  const [icon, setIcon] = useState(card?.icon ?? 'card')
  const [color, setColor] = useState<ColorKey>(card?.color ?? 'purple')
  const [archived, setArchived] = useState(card?.archived ?? false)
  const [err, setErr] = useState('')
  const used = card ? data.transactions.filter((t) => t.card_id === card.id).length : 0
  const save = () => {
    const c = parseInt(closing, 10), d = parseInt(due, 10)
    if (!name.trim()) return setErr('Dê um nome para o cartão')
    if (!(c >= 1 && c <= 31) || !(d >= 1 && d <= 31)) return setErr('Fechamento e vencimento: dias de 1 a 31')
    const row = { name: name.trim(), limit_amount: parseMoney(limit) || 0, closing_day: c, due_day: d, pay_account_id: payAccount || null, group_id: groupId || null, icon, color, archived }
    if (card) update('cards', card.id, row)
    else add('cards', row)
    notify('Cartão salvo')
    onClose()
  }
  return (
    <FormShell title={card ? 'Editar cartão' : 'Novo cartão'} onClose={onClose} onSave={save} err={err}
      onDelete={card ? () => { remove('cards', [card.id]); onClose() } : undefined}>
      <Field label="Nome"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank, Cartão do Lucas" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Limite (R$)"><input className="input" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" /></Field>
        <Field label="Fecha dia"><input className="input" type="number" min={1} max={31} value={closing} onChange={(e) => setClosing(e.target.value)} /></Field>
        <Field label="Vence dia"><input className="input" type="number" min={1} max={31} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </div>
      <div className="text-[12px] text-ink2 -mt-2">Compras a partir do dia de fechamento entram na fatura seguinte. Confira as datas no app do banco.</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Paga a fatura com">
          <select className="input" value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
            <option value="">Escolho na hora</option>
            {data.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="De quem é?">
          <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Minha</option>
            {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Ícone"><IconPick value={icon} onChange={setIcon} /></Field>
      <Field label="Cor"><ColorPick value={color} onChange={setColor} keys={COLOR_KEYS} /></Field>
      {card && <Toggle checked={archived} onChange={setArchived} label="Arquivar" hint="Cartão cancelado: some das listas, o histórico fica." />}
      {used > 0 && <div className="text-[12.5px] text-ink2">{used} lançamentos usam este cartão.</div>}
    </FormShell>
  )
}

export function VaultForm({ vault, onClose }: { vault?: Vault; onClose: () => void }) {
  const { add, update, remove, notify, data } = useStore()
  const [name, setName] = useState(vault?.name ?? '')
  const [kind, setKind] = useState<VaultKind>(vault?.kind ?? 'caixinha')
  const [institution, setInstitution] = useState(vault?.institution ?? '')
  const [icon, setIcon] = useState(vault?.icon ?? 'piggy')
  const [color, setColor] = useState<ColorKey>(vault?.color ?? 'purple')
  const [initial, setInitial] = useState(vault ? fmtInput(vault.initial_balance) : '')
  const [archived, setArchived] = useState(vault?.archived ?? false)
  const [err, setErr] = useState('')
  const used = vault ? data.transactions.filter((t) => t.vault_id === vault.id).length : 0
  const save = () => {
    if (!name.trim()) return setErr('Dê um nome para a caixinha')
    const row = { name: name.trim(), kind, institution: institution.trim(), icon, color, initial_balance: parseMoney(initial) || 0, archived }
    if (vault) update('vaults', vault.id, row)
    else add('vaults', row)
    notify('Caixinha salva')
    onClose()
  }
  return (
    <FormShell title={vault ? 'Editar caixinha' : 'Nova caixinha'} onClose={onClose} onSave={save} err={err}
      onDelete={vault ? () => { remove('vaults', [vault.id]); onClose() } : undefined}>
      <Field label="Nome"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reserva, Viagem, Tesouro Selic" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as VaultKind)}>
            {(Object.keys(VAULT_KIND) as VaultKind[]).map((k) => <option key={k} value={k}>{VAULT_KIND[k]}</option>)}
          </select>
        </Field>
        <Field label="Onde fica"><input className="input" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ex: Nubank, Inter" /></Field>
      </div>
      <Field label="Quanto já tem guardado (R$)"><input className="input" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0,00" /></Field>
      <div className="text-[12px] text-ink2 -mt-2">Conta como valor investido inicial. Depois, use Aportar, Resgatar e Rendimento.</div>
      <Field label="Ícone"><IconPick value={icon} onChange={setIcon} /></Field>
      <Field label="Cor"><ColorPick value={color} onChange={setColor} keys={COLOR_KEYS} /></Field>
      {vault && <Toggle checked={archived} onChange={setArchived} label="Arquivar" hint="Some da lista e do total; o histórico fica." />}
      {used > 0 && <div className="text-[12.5px] text-ink2">{used} movimentações nesta caixinha. Se apagar, elas ficam sem caixinha.</div>}
    </FormShell>
  )
}

export function GroupForm({ group, onClose }: { group?: Group; onClose: () => void }) {
  const { add, update, remove, notify, data } = useStore()
  const [name, setName] = useState(group?.name ?? '')
  const [icon, setIcon] = useState(group?.icon ?? 'users')
  const [color, setColor] = useState<ColorKey>(group?.color ?? 'blue')
  const [err, setErr] = useState('')
  const used = group ? data.transactions.filter((t) => t.group_id === group.id).length : 0
  const save = () => {
    if (!name.trim()) return setErr('Dê um nome para o grupo')
    if (group) update('groups', group.id, { name: name.trim(), icon, color })
    else add('groups', { name: name.trim(), icon, color })
    notify('Grupo salvo')
    onClose()
  }
  return (
    <FormShell title={group ? 'Editar grupo' : 'Novo grupo'} onClose={onClose} onSave={save} err={err}
      onDelete={group ? () => { remove('groups', [group.id]); onClose() } : undefined}>
      <Field label="Nome"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Casa, Minhas, Lucas, Mãe" /></Field>
      <Field label="Ícone"><IconPick value={icon} onChange={setIcon} /></Field>
      <Field label="Cor"><ColorPick value={color} onChange={setColor} keys={COLOR_KEYS} /></Field>
      {used > 0 && <div className="text-[12.5px] text-ink2">{used} lançamentos usam este grupo; se apagar, ficam sem grupo.</div>}
    </FormShell>
  )
}
