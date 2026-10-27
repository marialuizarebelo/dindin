import { useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { supabase, allowSignup } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) setMsg({ text: 'Conta criada. Confirme o e-mail para entrar.', ok: true })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMsg({ text: 'Enviei um link para redefinir a senha.', ok: true })
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err)
      setMsg({ text: m.includes('Invalid login') ? 'E-mail ou senha incorretos.' : m })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-5">
      <form onSubmit={submit} className="glass-strong fade-up w-full max-w-[380px] rounded-[30px] p-7 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 pb-2">
          <div className="h-14 w-14 rounded-2xl grid place-items-center text-white" style={{ background: 'linear-gradient(135deg,#efb4c8,#c7aef0)', boxShadow: '0 10px 28px rgba(200,130,170,.42)' }}>
            <Lock size={24} />
          </div>
          <div className="text-center">
            <h1 className="m-0 font-serif text-[32px] font-semibold tracking-tight">dindin</h1>
            <p className="m-0 text-ink2 text-sm">{mode === 'reset' ? 'Redefinir senha' : 'Suas finanças, só suas.'}</p>
          </div>
        </div>
        <input className="input" type="email" placeholder="E-mail" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode !== 'reset' && (
          <input className="input" type="password" placeholder="Senha" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
        {msg && <div className="text-[13px] text-center" style={{ color: msg.ok ? 'var(--c-green)' : 'var(--c-red)' }}>{msg.text}</div>}
        <button className="btn btn-primary !h-11 !rounded-[14px]" disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : mode === 'up' ? 'Criar conta' : 'Enviar link'}
        </button>
        <div className="flex justify-between text-[13px] text-ink2">
          {mode === 'in' ? (
            <>
              <button type="button" className="bg-transparent border-0 text-ink2 p-0" onClick={() => { setMode('reset'); setMsg(null) }}>Esqueci a senha</button>
              {allowSignup && <button type="button" className="bg-transparent border-0 text-accent p-0" onClick={() => { setMode('up'); setMsg(null) }}>Criar conta</button>}
            </>
          ) : (
            <button type="button" className="bg-transparent border-0 text-ink2 p-0" onClick={() => { setMode('in'); setMsg(null) }}>← Voltar</button>
          )}
        </div>
      </form>
    </div>
  )
}
