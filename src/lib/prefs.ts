import { useEffect, useState } from 'react'

const KEY = 'dindin:name'
const EVT = 'dindin:name-changed'

const read = () => {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}

/** Como a usuaria quer ser chamada (guardado so neste aparelho). */
export function useName(): string {
  const [name, setName] = useState(read)
  useEffect(() => {
    const on = () => setName(read())
    window.addEventListener(EVT, on)
    return () => window.removeEventListener(EVT, on)
  }, [])
  return name
}

export function saveName(v: string) {
  try { localStorage.setItem(KEY, v.trim()) } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT))
}
