import { useState } from 'react'
import { api, type Cycle } from '../api'
import { formatDate, formatEuro } from '../format'
import { Card, ErrorBox, Field, useAction, useLoad } from '../ui'
import { Reviewer } from './Reviewer'

export function Admin() {
  const cycles = useLoad(() => api<Cycle[]>('GET', '/api/admin/cycles'))
  const run = useAction()
  const create = useAction()
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const runCycle = () =>
    void run.run(async () => {
      const r = await api<{ distributedCents: number; beneficiaryCount: number; carryOverCents: number; failed: number }>('POST', '/api/admin/cycles')
      setMessage(
        `Distribuídos ${formatEuro(r.distributedCents)} por ${r.beneficiaryCount} pessoas. Ficam ${formatEuro(r.carryOverCents)} para o próximo ciclo.` +
          (r.failed ? ` ${r.failed} transferência(s) falharam.` : ''),
      )
      await cycles.reload()
    })

  const addReviewer = (e: React.FormEvent) => {
    e.preventDefault()
    void create.run(async () => {
      await api('POST', '/api/admin/reviewers', { email, password })
      setMessage(`Conta de revisão criada para ${email}.`)
      setEmail('')
      setPassword('')
    })
  }

  return (
    <div className="stack">
      <Card title="Distribuição mensal">
        <p>Divide o saldo do fundo por todas as pessoas aprovadas. Só corre se houver doadores suficientes para garantir o anonimato.</p>
        <ErrorBox message={run.error} />
        {message && <p className="ok">{message}</p>}
        <button className="primary" disabled={run.busy} onClick={runCycle}>
          Correr distribuição agora
        </button>
        <ul className="list">
          {cycles.data?.map((c) => (
            <li key={c.id}>
              <span>{formatDate(c.runAt)}</span>
              <span>{formatEuro(c.distributedCents)} de {formatEuro(c.poolCents)}</span>
              <span className="tag">
                {c.donorCount} doadores · {c.beneficiaryCount} beneficiários
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Nova conta de revisão">
        <p className="hint">Revisores devem ter formação (por exemplo, assistentes sociais) e assinar um termo de confidencialidade.</p>
        <form className="stack" onSubmit={addReviewer}>
          <Field label="Email">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Palavra-passe inicial">
            <input type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <ErrorBox message={create.error} />
          <button className="secondary" disabled={create.busy}>
            Criar
          </button>
        </form>
      </Card>

      <Reviewer />
    </div>
  )
}
