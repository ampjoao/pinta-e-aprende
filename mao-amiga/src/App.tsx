import { useCallback, useEffect, useState } from 'react'
import { api, getToken, setToken, type Me, type Role } from './api'
import { LANGUAGES, LocaleProvider, useLocale } from './i18n'
import { Admin } from './screens/Admin'
import { Auth } from './screens/Auth'
import { Beneficiary } from './screens/Beneficiary'
import { Donor } from './screens/Donor'
import { Identity } from './screens/Identity'
import { Reviewer } from './screens/Reviewer'
import { Welcome } from './screens/Welcome'
import { ErrorBox, useAction } from './ui'

type View = { name: 'welcome' } | { name: 'auth'; mode: 'login' | 'register'; role?: Role }

export default function App({ language }: { language?: string }) {
  return (
    <LocaleProvider initial={language}>
      <Shell />
    </LocaleProvider>
  )
}

function Shell() {
  const { t, lang, setLang } = useLocale()
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
  if (checking) content = <p className="muted">{t('app.loading')}</p>
  else if (!me && view.name === 'auth')
    content = <Auth mode={view.mode} role={view.role} onDone={loadMe} onBack={() => setView({ name: 'welcome' })} />
  else if (!me) content = <Welcome onStart={(mode, role) => setView({ name: 'auth', mode, role })} />
  else if (me.suspended) content = <p className="error">{t('app.suspended')}</p>
  else if ((me.role === 'donor' || me.role === 'beneficiary') && !me.identityVerified) content = <Identity onDone={loadMe} />
  else if (me.role === 'donor') content = <Donor country={me.country} />
  else if (me.role === 'beneficiary') content = <Beneficiary />
  else if (me.role === 'reviewer') content = <Reviewer countries={me.reviewCountries} />
  else content = <Admin />

  return (
    <div className="app">
      <header className="top">
        <span className="brand">
          <span className="logo" aria-hidden>
            ❤
          </span>
          {t('app.name')}
        </span>
        <span className="who">
          <select className="lang" aria-label={t('app.language')} value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          {me && (
            <>
              <span className="tag">{t(`role.${me.role}`)}</span>
              <button className="link" onClick={logout}>
                {t('app.logout')}
              </button>
            </>
          )}
        </span>
      </header>
      <main>{content}</main>
      <footer className="foot">
        {me && (me.role === 'donor' || me.role === 'beneficiary') && <DeleteAccount onDeleted={logout} />}
        <p>{t('app.footer')}</p>
      </footer>
    </div>
  )
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const { t } = useLocale()
  const [confirm, setConfirm] = useState(false)
  const action = useAction()
  if (!confirm)
    return (
      <button className="link" onClick={() => setConfirm(true)}>
        {t('delete.link')}
      </button>
    )
  return (
    <div className="stack">
      <p>{t('delete.text')}</p>
      <ErrorBox message={action.error} />
      <div className="row">
        <button className="danger" onClick={() => void action.run(async () => (await api('DELETE', '/api/me'), onDeleted()))}>
          {t('delete.confirm')}
        </button>
        <button className="link" onClick={() => setConfirm(false)}>
          {t('delete.cancel')}
        </button>
      </div>
    </div>
  )
}
