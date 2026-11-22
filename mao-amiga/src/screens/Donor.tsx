import { useState } from 'react'
import { api, type Donation } from '../api'
import { formatDate, formatEuro, parseEuro } from '../format'
import { Card, ErrorBox, useAction, useLoad } from '../ui'

const PRESETS = [1000, 2500, 5000, 10000]

export function Donor() {
  const donations = useLoad(() => api<Donation[]>('GET', '/api/donations'))
  const [amount, setAmount] = useState<number | null>(2500)
  const [custom, setCustom] = useState('')
  const [thanks, setThanks] = useState<number | null>(null)
  const action = useAction()
  const total = (donations.data ?? []).reduce((s, d) => s + d.amountCents, 0)

  const donate = () =>
    void action.run(async () => {
      const value = amount ?? parseEuro(custom)
      if (!value) throw new Error('Indique um valor.')
      await api('POST', '/api/donations', { amountCents: value })
      setThanks(value)
      setCustom('')
      await donations.reload()
    })

  return (
    <div className="stack">
      <Card title="Fazer uma doação">
        <p>O valor entra no fundo comum e é distribuído no próximo ciclo mensal por pessoas com necessidade verificada.</p>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p} className={amount === p ? 'on' : ''} onClick={() => setAmount(p)}>
              {formatEuro(p)}
            </button>
          ))}
          <button className={amount === null ? 'on' : ''} onClick={() => setAmount(null)}>
            Outro valor
          </button>
        </div>
        {amount === null && (
          <input aria-label="Outro valor em euros" inputMode="decimal" placeholder="Ex.: 15,00" value={custom} onChange={(e) => setCustom(e.target.value)} />
        )}
        <ErrorBox message={action.error} />
        {thanks !== null && <p className="ok">Obrigado! {formatEuro(thanks)} entraram no fundo comum.</p>}
        <button className="primary" disabled={action.busy} onClick={donate}>
          Doar {amount ? formatEuro(amount) : ''}
        </button>
        <p className="hint">
          Doações a uma associação reconhecida podem ser deduzidas no IRS. O recibo fica disponível em nome de quem doou,
          nunca é mostrado a quem recebe.
        </p>
      </Card>

      <Card title="As minhas doações">
        {donations.error && <ErrorBox message={donations.error} />}
        {donations.data?.length === 0 && <p className="muted">Ainda não fez nenhuma doação.</p>}
        {donations.data && donations.data.length > 0 && (
          <>
            <p>
              Total: <strong>{formatEuro(total)}</strong>
            </p>
            <ul className="list">
              {donations.data.map((d) => (
                <li key={d.id}>
                  <span>{formatDate(d.createdAt)}</span>
                  <span>{formatEuro(d.amountCents)}</span>
                  <span className="tag">{d.distributed ? 'Distribuída' : 'À espera do ciclo'}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="hint">Não mostramos a quem foi o seu dinheiro: ele junta-se ao de outras pessoas e é dividido por todos.</p>
      </Card>
    </div>
  )
}
