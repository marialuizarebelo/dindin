import { useState } from 'react'
import { Download, LogOut, Plus } from 'lucide-react'
import { Icon } from '../components/Icon'
import { GroupForm } from '../components/EntityForms'
import { PALETTES, saveName, setPalette, useName, usePalette } from '../lib/prefs'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { COLOR_KEYS } from '../lib/colors'
import { money } from '../lib/format'
import { Card, ColorPick, ConfirmButton, IconPick, Field, PageTitle, Sheet, Tag } from '../components/ui'
import type { Category, ColorKey, Group, Source } from '../lib/types'

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function Settings() {
  const { data, demo, loadDemo, wipe, notify, remove } = useStore()
  const [catEdit, setCatEdit] = useState<Category | 'new-expense' | 'new-investment' | null>(null)
  const [srcEdit, setSrcEdit] = useState<Source | 'new' | null>(null)
  const [groupEdit, setGroupEdit] = useState<Group | 'new' | null>(null)
  const [pw, setPw] = useState('')
  const palette = usePalette()
  const savedName = useName()
  const [name, setName] = useState(savedName)

  const exportCsv = () => {
    const name = (m: { id: string; name: string }[]) => new Map(m.map((x) => [x.id, x.name]))
    const cat = name(data.categories), src = name(data.sources), acc = name(data.accounts), crd = name(data.cards), grp = name(data.groups), vlt = name(data.vaults)
    const rows = [['data', 'tipo', 'descricao', 'parcela', 'valor', 'categoria_ou_origem', 'conta', 'cartao', 'caixinha', 'grupo', 'natureza', 'tags', 'pago', 'observacao'],
      ...[...data.transactions].sort((a, b) => (a.date < b.date ? -1 : 1)).map((t) => [
        t.date, t.kind, t.description, t.installment_total ? `${t.installment_no}/${t.installment_total}` : '', String(t.amount).replace('.', ','),
        (t.kind === 'income' ? src.get(t.source_id ?? '') : cat.get(t.category_id ?? '')) ?? '', acc.get(t.account_id ?? '') ?? '', crd.get(t.card_id ?? '') ?? '',
        vlt.get(t.vault_id ?? '') ?? '', grp.get(t.group_id ?? '') ?? '', t.nature ?? '', t.tags.join(' '), t.paid ? 'sim' : 'nao', t.note])]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    download('dindin-lancamentos.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8')
  }

  const changePw = async () => {
    if (!supabase || pw.length < 8) return notify('Use pelo menos 8 caracteres', 'error')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) notify(error.message, 'error')
    else { notify('Senha alterada'); setPw('') }
  }

  return (
    <>
      <PageTitle title="Ajustes" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card delay={0} className="lg:col-span-2">
          <div className="font-semibold text-[16px] mb-1">Aparência</div>
          <p className="text-[12.5px] text-ink2 mt-0 mb-3">Escolha a paleta. O claro/escuro fica no ícone de lua, no topo.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {PALETTES.map((p) => (
              <button key={p.id} type="button" onClick={() => setPalette(p.id)} aria-pressed={palette === p.id}
                className="text-left rounded-2xl p-3 bg-transparent border-2 transition-colors"
                style={{ borderColor: palette === p.id ? 'var(--accent)' : 'var(--hair)' }}>
                <div className="flex h-12 rounded-xl overflow-hidden mb-2.5">
                  <i className="flex-[3]" style={{ background: p.swatch[0] }} />
                  <i className="flex-[1.4]" style={{ background: p.swatch[1] }} />
                  <i className="flex-[1.4]" style={{ background: p.swatch[2] }} />
                </div>
                <div className="font-semibold text-[14.5px]">{p.name}</div>
                <div className="text-[12.5px] text-ink2">{p.hint}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card delay={10} className="lg:col-span-2">
          <div className="font-semibold text-[16px] mb-3">Como quer ser chamada?</div>
          <div className="flex gap-2 max-w-sm">
            <input className="input" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary" onClick={() => { saveName(name); notify('Nome salvo') }}>Salvar</button>
          </div>
          <p className="text-[12.5px] text-ink2 mb-0 mt-2">Aparece na saudação da tela inicial. Fica guardado só neste aparelho.</p>
        </Card>

        <Card delay={20}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[16px]">Categorias de despesa</div>
            <button className="btn btn-sm" onClick={() => setCatEdit('new-expense')}><Plus size={14} /> Nova</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.categories.filter((c) => c.kind === 'expense').map((c) => (
              <button key={c.id} className="bg-transparent border-0 p-0" onClick={() => setCatEdit(c)}><Tag color={c.color} className="!text-[13.5px] !py-1 !px-2.5"><Icon name={c.icon} size={14} /> {c.name}</Tag></button>
            ))}
          </div>
          <hr className="hair my-4" />
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[16px]">Tipos de investimento</div>
            <button className="btn btn-sm" onClick={() => setCatEdit('new-investment')}><Plus size={14} /> Novo</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.categories.filter((c) => c.kind === 'investment').map((c) => (
              <button key={c.id} className="bg-transparent border-0 p-0" onClick={() => setCatEdit(c)}><Tag color={c.color} className="!text-[13.5px] !py-1 !px-2.5"><Icon name={c.icon} size={14} /> {c.name}</Tag></button>
            ))}
          </div>
        </Card>

        <Card delay={60}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[16px]">Origens de renda</div>
            <button className="btn btn-sm" onClick={() => setSrcEdit('new')}><Plus size={14} /> Nova</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.sources.map((s) => (
              <button key={s.id} className="bg-transparent border-0 p-0" onClick={() => setSrcEdit(s)}><Tag color={s.color} className="!text-[13.5px] !py-1 !px-2.5"><Icon name={s.icon} size={14} /> {s.name}</Tag></button>
            ))}
          </div>
          <p className="text-[12.5px] text-ink2 mb-0 mt-3">Cada receita pode ter uma origem — assim você vê de onde vem cada real.</p>
        </Card>

        <Card delay={80}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[16px]">Grupos</div>
            <button className="btn btn-sm" onClick={() => setGroupEdit('new')}><Plus size={14} /> Novo</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.groups.map((g) => (
              <button key={g.id} className="bg-transparent border-0 p-0" onClick={() => setGroupEdit(g)}><Tag color={g.color} className="!text-[13.5px] !py-1 !px-2.5"><Icon name={g.icon} size={14} /> {g.name}</Tag></button>
            ))}
          </div>
          <p className="text-[12.5px] text-ink2 mb-0 mt-3">Use para separar quem gasta ou de quem é a conta: Casa, Minhas, Lucas, Mãe… Aparece em cada lançamento e no resumo “Por grupo”.</p>
        </Card>

        <Card delay={90}>
          <div className="font-semibold text-[16px] mb-1">Modelos (lançamento de 1 toque)</div>
          <p className="text-[12.5px] text-ink2 mt-0 mb-3">Crie ao lançar, marcando “Salvar como modelo”. Aparecem no topo do novo lançamento.</p>
          {data.templates.length === 0 ? <div className="text-ink3 text-sm">Nenhum modelo ainda.</div> : (
            <div className="flex flex-col">
              {data.templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-hair last:border-0 text-[14px]">
                  <span>{t.name}{t.amount ? <span className="text-ink2"> · {money(t.amount)}</span> : null}</span>
                  <ConfirmButton className="btn-sm" onConfirm={() => remove('templates', [t.id])}>Apagar</ConfirmButton>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card delay={100}>
          <div className="font-semibold text-[16px] mb-3">Seus dados</div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn" onClick={exportCsv}><Download size={15} /> Exportar planilha (CSV)</button>
            <button className="btn" onClick={() => download(`dindin-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json')}><Download size={15} /> Backup completo (JSON)</button>
          </div>
          <hr className="hair my-4" />
          <div className="flex gap-2 flex-wrap">
            {demo && <button className="btn" onClick={() => void loadDemo()}>Carregar dados de exemplo</button>}
            <ConfirmButton onConfirm={() => void wipe()}>Apagar todos os dados</ConfirmButton>
          </div>
        </Card>

        <Card delay={140}>
          <div className="font-semibold text-[16px] mb-3">Conta</div>
          {demo ? (
            <p className="text-ink2 text-[13.5px] m-0">Você está no <b>modo demonstração</b>: os dados ficam só neste navegador e não há login. Configure o Supabase (veja o README) para ter login e sincronizar celular e computador.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <Field label="Nova senha"><div className="flex gap-2"><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="mínimo 8 caracteres" /><button className="btn" onClick={() => void changePw()}>Alterar</button></div></Field>
              <button className="btn w-fit" onClick={() => void supabase?.auth.signOut()}><LogOut size={15} /> Sair</button>
            </div>
          )}
        </Card>
      </div>
      {catEdit && <CategoryForm cat={typeof catEdit === 'string' ? undefined : catEdit} kind={typeof catEdit === 'string' ? (catEdit === 'new-investment' ? 'investment' : 'expense') : catEdit.kind} onClose={() => setCatEdit(null)} />}
      {groupEdit && <GroupForm group={groupEdit === 'new' ? undefined : groupEdit} onClose={() => setGroupEdit(null)} />}
      {srcEdit && <SourceForm src={srcEdit === 'new' ? undefined : srcEdit} onClose={() => setSrcEdit(null)} />}
    </>
  )
}

function CategoryForm({ cat, kind, onClose }: { cat?: Category; kind: 'expense' | 'investment'; onClose: () => void }) {
  const { add, update, remove, data, notify } = useStore()
  const [name, setName] = useState(cat?.name ?? '')
  const [icon, setIcon] = useState(cat?.icon ?? 'sparkles')
  const [color, setColor] = useState<ColorKey>(cat?.color ?? 'blue')
  const used = cat ? data.transactions.filter((t) => t.category_id === cat.id).length : 0
  const save = () => {
    if (!name.trim()) return
    if (cat) update('categories', cat.id, { name: name.trim(), icon, color })
    else add('categories', { name: name.trim(), icon, color, kind })
    notify('Categoria salva')
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={cat ? 'Editar categoria' : kind === 'investment' ? 'Novo tipo de investimento' : 'Nova categoria'}
      footer={<>{cat && <ConfirmButton className="mr-auto" onConfirm={() => { remove('categories', [cat.id]); onClose() }}>Apagar</ConfirmButton>}<button className="btn btn-primary" onClick={save}>Salvar</button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Nome"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Ícone"><IconPick value={icon} onChange={setIcon} /></Field>
        <Field label="Cor"><ColorPick value={color} onChange={setColor} keys={COLOR_KEYS} /></Field>
        {used > 0 && <div className="text-[12.5px] text-ink2">{used} lançamentos usam esta categoria; se apagar, eles ficam “sem categoria”.</div>}
      </div>
    </Sheet>
  )
}

function SourceForm({ src, onClose }: { src?: Source; onClose: () => void }) {
  const { add, update, remove, notify } = useStore()
  const [name, setName] = useState(src?.name ?? '')
  const [icon, setIcon] = useState(src?.icon ?? 'briefcase')
  const [color, setColor] = useState<ColorKey>(src?.color ?? 'green')
  const save = () => {
    if (!name.trim()) return
    if (src) update('sources', src.id, { name: name.trim(), icon, color })
    else add('sources', { name: name.trim(), icon, color })
    notify('Origem salva')
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={src ? 'Editar origem' : 'Nova origem de renda'}
      footer={<>{src && <ConfirmButton className="mr-auto" onConfirm={() => { remove('sources', [src.id]); onClose() }}>Apagar</ConfirmButton>}<button className="btn btn-primary" onClick={save}>Salvar</button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Nome"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Salário, Freelas, Aluguel recebido" /></Field>
        <Field label="Ícone"><IconPick value={icon} onChange={setIcon} /></Field>
        <Field label="Cor"><ColorPick value={color} onChange={setColor} keys={COLOR_KEYS} /></Field>
      </div>
    </Sheet>
  )
}

