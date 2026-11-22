import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ApiError } from './api'

/** Carrega dados e guarda o erro, para cada ecrã não repetir este código. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await loader())
      setError(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, deps)
  useEffect(() => {
    void reload()
  }, [reload])
  return { data, error, loading, loaded, reload, setData }
}

/** Corre uma ação (botão) e mostra o erro, se houver. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Erro inesperado.')
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run, setError }
}

export const ErrorBox = ({ message }: { message: string | null }) =>
  message ? (
    <p className="error" role="alert">
      {message}
    </p>
  ) : null

export const Card = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="card">
    {title && <h2>{title}</h2>}
    {children}
  </section>
)

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="field">
    <span className="label">{label}</span>
    {children}
    {hint && <span className="hint">{hint}</span>}
  </label>
)
