import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Sem as variaveis o app roda em modo demonstracao (dados so neste navegador). */
export const cloudEnabled = Boolean(url && key)
export const allowSignup = import.meta.env.VITE_ALLOW_SIGNUP === 'true'

export const supabase = cloudEnabled
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null
