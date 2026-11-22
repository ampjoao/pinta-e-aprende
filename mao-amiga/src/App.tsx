import { useCallback, useEffect, useState } from 'react'
import { api, getToken, setToken, type Me, type Role } from './api'
import { Admin } from './screens/Admin'
import { Auth } from './screens/Auth'
import { Beneficiary } from './screens/Beneficiary'
import { Donor } from './screens/Donor'
import { Identity } from './screens/Identity'
import { Reviewer } from './screens/Reviewer'
import { Welcome } from './screens/Welcome'
import { ErrorBox, useAction } from './ui'

type View = { name: 'welcome' } | { name: 'auth'; mode: 'login' | 'register'; role?: Role }

export default function App() {
  const [me, setMe] = useState<Me | null>(null)
  const [checking, setChecking] = useState(Boolean(getToken()))
  const [view, setView] = useState<View>({ name: 'welcome' })

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setMe(null)
      setChecking(false)
      return
    }
    try {
      setMe(await api<Me>('GET', '/api/me'))
    } catch {
      setMe(null)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void loadMe()
  }, [loadMe])

  const logout = async () => {
    await api('POST', '/api/auth/logout').catch(() => undefined)
    setToken(null)
    setMe(null)
    setView({ name: 'welcome' })
  }

  let content
  if (checking) content = <p className="muted">A carregar…</p>
  else if (!me && view.name === 'auth')
    content = <Auth mode={view.mode} role={view.role} onDone={loadMe} onBack={() => setView({ name: 'welcome' })} />
  else if (!me) content = <Welcome onStart={(mode, role) => setView({ name: 'auth', mode, role })} />
  else if (me.suspended) content = <p className="error">A conta está suspensa. Contacte o apoio.</p>
  else if ((me.role === 'donor' || me.role === 'beneficiary') && !me.identityVerified) content = <Identity onDone={loadMe} />
  else if (me.role === 'donor') content = <Donor />
  else if (me.role === 'beneficiary') content = <Beneficiary />
  else if (me.role === 'reviewer') content = <Reviewer />
  else content = <Admin />

  return (
    <div className="app">
      <header className="top">
        <span className="brand">
          <span className="logo" aria-hidden>
            ❤
          </span>{' '}
          Mão Amiga
        </span>
        {me && (
          <span className="who">
            <span className="tag">{ROLE_LABELS[me.role]}</span>
            <button className="link" onClick={logout}>
              Sair
            </button>
          </span>
        )}
      </header>
      <main>{content}</main>
      <footer className="foot">
        {me && (me.role === 'donor' || me.role === 'beneficiary') && <DeleteAccount onDeleted={logout} />}
        <p>
          Mão Amiga · os pagamentos passam por uma instituição de pagamento autorizada · dados tratados segundo o RGPD
        </p>
      </footer>
    </div>
  )
}

const ROLE_LABELS: Record<Role, string> = {
  donor: 'Doador',
  beneficiary: 'Beneficiário',
  reviewer: 'Revisão',
  admin: 'Administração',
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const action = useAction()
  if (!confirm)
    return (
      <button className="link" onClick={() => setConfirm(true)}>
        Eliminar a minha conta
      </button>
    )
  return (
    <div className="stack">
      <p>
        A conta e os dados pessoais são apagados. Os registos de doações e pagamentos ficam guardados pelo tempo que a lei
        obriga, sem email associado.
      </p>
      <ErrorBox message={action.error} />
      <div className="row">
        <button className="danger" onClick={() => void action.run(async () => (await api('DELETE', '/api/me'), onDeleted()))}>
          Eliminar definitivamente
        </button>
        <button className="link" onClick={() => setConfirm(false)}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
