import { useState } from 'react'
import { api } from '../api'
import { Card, ErrorBox, Field, useAction } from '../ui'

export function Identity({ onDone }: { onDone: () => void }) {
  const [legalName, setLegalName] = useState('')
  const [nif, setNif] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const action = useAction()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void action.run(async () => {
      await api('POST', '/api/identity', { legalName, nif, birthDate })
      onDone()
    })
  }

  return (
    <Card title="Confirmar identidade">
      <p>
        A lei portuguesa e europeia contra o branqueamento de capitais obriga a saber quem envia e quem recebe dinheiro.
        Também é assim que impedimos contas falsas e pessoas a pedir ajuda duas vezes.
      </p>
      <ul className="bullets">
        <li>O nome fica cifrado. O NIF não é guardado, só uma impressão digital para detetar contas repetidas.</li>
        <li>Doadores e beneficiários nunca veem os dados uns dos outros.</li>
        <li>Na versão final, a confirmação é feita com a Chave Móvel Digital ou o Cartão de Cidadão.</li>
      </ul>
      <form onSubmit={submit} className="stack">
        <Field label="Nome completo (como no Cartão de Cidadão)">
          <input required autoComplete="name" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </Field>
        <Field label="NIF">
          <input required inputMode="numeric" pattern="\d{9}" maxLength={9} value={nif} onChange={(e) => setNif(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Data de nascimento">
          <input required type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <ErrorBox message={action.error} />
        <button className="primary" disabled={action.busy}>
          Confirmar
        </button>
      </form>
    </Card>
  )
}
