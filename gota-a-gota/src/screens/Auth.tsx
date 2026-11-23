import { useState } from 'react'
import { api, setToken, type Role } from '../api'
import { useLocale } from '../i18n'
import { Card, ErrorBox, Field, useAction } from '../ui'

export function Auth(props: { mode: 'login' | 'register'; role?: Role; onDone: () => void; onBack: () => void }) {
  const { t } = useLocale()
  const [mode, setMode] = useState(props.mode)
  const [role, setRole] = useState<Role>(props.role ?? 'donor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const action = useAction()
  const register = mode === 'register'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void action.run(async () => {
      const { token } = await api<{ token: string }>('POST', register ? '/api/auth/register' : '/api/auth/login', { email, password, role })
      setToken(token)
      props.onDone()
    })
  }

  return (
    <Card title={register ? t('auth.register') : t('auth.login')}>
      <form onSubmit={submit} className="stack">
        {register && (
          <div className="choice" role="radiogroup" aria-label={t('auth.choice')}>
            {(['donor', 'beneficiary'] as const).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>
                {r === 'donor' ? t('welcome.help') : t('welcome.needHelp')}
              </button>
            ))}
          </div>
        )}
        <Field label={t('auth.email')} hint={register ? t('auth.emailHint') : undefined}>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('auth.password')} hint={register ? t('auth.passwordHint') : undefined}>
          <input
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            required
            minLength={register ? 10 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {register && (
          <label className="check">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>{t('auth.terms')}</span>
          </label>
        )}
        <ErrorBox message={action.error} />
        <button className="primary" disabled={action.busy || (register && !accepted)}>
          {register ? t('auth.register') : t('auth.login')}
        </button>
        <div className="row">
          <button type="button" className="link" onClick={() => setMode(register ? 'login' : 'register')}>
            {register ? t('welcome.haveAccount') : t('auth.noAccount')}
          </button>
          <button type="button" className="link" onClick={props.onBack}>
            {t('auth.back')}
          </button>
        </div>
      </form>
    </Card>
  )
}
