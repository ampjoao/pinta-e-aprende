import { useState } from 'react'
import { api, setToken, type Role } from '../api'
import { Card, ErrorBox, Field, useAction } from '../ui'

export function Auth(props: { mode: 'login' | 'register'; role?: Role; onDone: () => void; onBack: () => void }) {
  const [mode, setMode] = useState(props.mode)
  const [role, setRole] = useState<Role>(props.role ?? 'donor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const action = useAction()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void action.run(async () => {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const { token } = await api<{ token: string }>('POST', path, { email, password, role })
      setToken(token)
      props.onDone()
    })
  }

  return (
    <Card title={mode === 'login' ? 'Entrar' : 'Criar conta'}>
      <form onSubmit={submit} className="stack">
        {mode === 'register' && (
          <div className="choice" role="radiogroup" aria-label="O que pretende">
            <button type="button" role="radio" aria-checked={role === 'donor'} className={role === 'donor' ? 'on' : ''} onClick={() => setRole('donor')}>
              Quero ajudar
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={role === 'beneficiary'}
              className={role === 'beneficiary' ? 'on' : ''}
              onClick={() => setRole('beneficiary')}
            >
              Preciso de ajuda
            </button>
          </div>
        )}
        <Field label="Email" hint={mode === 'register' ? 'Nunca é mostrado a outras pessoas.' : undefined}>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Palavra-passe" hint={mode === 'register' ? 'Pelo menos 10 caracteres.' : undefined}>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 10 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {mode === 'register' && (
          <label className="check">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>
              Li e aceito os termos e a política de privacidade. Sei que dar informações falsas para receber apoio é crime
              (burla, art. 217.º do Código Penal) e leva ao fecho da conta.
            </span>
          </label>
        )}
        <ErrorBox message={action.error} />
        <button className="primary" disabled={action.busy || (mode === 'register' && !accepted)}>
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
        <div className="row">
          <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho conta'}
          </button>
          <button type="button" className="link" onClick={props.onBack}>
            Voltar
          </button>
        </div>
      </form>
    </Card>
  )
}
