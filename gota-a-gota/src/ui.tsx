import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, type Catalog } from './api'
import { useLocale } from './i18n'

/** Mensagem de erro a mostrar: a do servidor (já traduzida) ou uma genérica. */
function useErrorText() {
  const { t } = useLocale()
  return (e: unknown) => {
    if (e instanceof ApiError) return e.code === 'network' ? t('error.network') : e.message || t('error.unexpected')
    if (e instanceof Error && e.message) return e.message
    return t('error.unexpected')
  }
}

/** Carrega dados e guarda o erro, para cada ecrã não repetir este código. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const errorText = useErrorText()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const reload = useCallback(async () => {
    try {
      setData(await loader())
      setError(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoaded(true)
    }
  }, deps)
  useEffect(() => {
    void reload()
  }, [reload])
  return { data, error, loaded, reload, setData }
}

/** Corre uma ação (botão) e mostra o erro, se houver. */
export function useAction() {
  const errorText = useErrorText()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(errorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run, setError }
}

let catalogPromise: Promise<Catalog> | null = null
/** Países e moedas disponíveis (pedido uma vez). */
export function useCatalog() {
  return useLoad(() => {
    catalogPromise ??= api<Catalog>('GET', '/api/catalog').catch((e) => {
      catalogPromise = null
      throw e
    })
    return catalogPromise
  })
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
