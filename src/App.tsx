import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { cloudEnabled, supabase } from './lib/supabase'
import { StoreProvider, useStore } from './lib/store'
import Auth from './components/Auth'
import Layout, { Toasts } from './components/Layout'
import { PeriodProvider } from './components/PeriodBar'
import { TxSheetProvider } from './components/TxSheet'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import SheetPage from './pages/SheetPage'
import Planning from './pages/Planning'
import Goals from './pages/Goals'
import Debts from './pages/Debts'
import Settings from './pages/Settings'
import Agenda from './pages/Agenda'
import Accounts from './pages/Accounts'
import Vaults from './pages/Vaults'

function Splash({ children }: { children?: React.ReactNode }) {
  return <div className="min-h-dvh grid place-items-center text-ink2 text-sm px-6 text-center">{children ?? 'Carregando…'}</div>
}

function Shell() {
  const { status, error, reload } = useStore()
  if (status === 'loading') return <Splash />
  if (status === 'error') {
    return (
      <Splash>
        <div className="glass rounded-3xl p-6 max-w-sm">
          <div className="font-semibold text-ink mb-1">Não consegui carregar seus dados</div>
          <div className="mb-3 break-words">{error}</div>
          <button className="btn btn-primary" onClick={() => void reload()}>Tentar de novo</button>
        </div>
      </Splash>
    )
  }
  return (
    <PeriodProvider>
      <TxSheetProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="lancamentos" element={<Transactions />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="contas" element={<Accounts />} />
            <Route path="caixinhas" element={<Vaults />} />
            <Route path="planilha" element={<SheetPage />} />
            <Route path="planejamento" element={<Planning />} />
            <Route path="metas" element={<Goals />} />
            <Route path="dividas" element={<Debts />} />
            <Route path="ajustes" element={<Settings />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
        <Toasts />
      </TxSheetProvider>
    </PeriodProvider>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(cloudEnabled)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (checking) return <Splash />
  if (cloudEnabled && !session) return <Auth />
  // key: ao trocar de usuaria os dados sao recarregados do zero
  return (
    <BrowserRouter>
      <StoreProvider key={session?.user.id ?? 'demo'}>
        <Shell />
      </StoreProvider>
    </BrowserRouter>
  )
}
