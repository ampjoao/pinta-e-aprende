import { useState } from 'react'
import { api, type Application, type Payout } from '../api'
import { CATEGORY_LABELS, DOCUMENT_LABELS, STATUS_LABELS, formatDate, formatEuro, parseEuro } from '../format'
import { Card, ErrorBox, Field, useAction, useLoad } from '../ui'

const MAX_FILE = 5 * 1024 * 1024

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'))
    reader.readAsDataURL(file)
  })

const euroText = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2).replace('.', ','))

export function Beneficiary() {
  const app = useLoad(() => api<Application | null>('GET', '/api/application'))
  if (!app.loaded) return <p className="muted">A carregar…</p>
  if (app.error) return <ErrorBox message={app.error} />
  const a = app.data
  const editable = !a || ['draft', 'rejected', 'expired'].includes(a.status)

  return (
    <div className="stack">
      {a && a.status !== 'draft' && <StatusCard app={a} />}
      {editable && <ApplicationForm app={a?.status === 'draft' ? a : null} onChange={app.reload} maxMonthly={a?.maxMonthlyCents ?? 30000} />}
      {a && (a.status === 'approved' || a.status === 'expired') && <Payouts />}
    </div>
  )
}

function StatusCard({ app }: { app: Application }) {
  const text: Record<string, string> = {
    pending: 'O seu pedido está a ser verificado por duas pessoas da equipa de revisão. Normalmente demora até 10 dias úteis.',
    approved: `Está aprovado${app.validUntil ? ` até ${formatDate(app.validUntil)}` : ''}. Recebe um apoio em cada distribuição mensal, por transferência para o IBAN terminado em ${app.ibanLast4}.`,
    rejected: 'O pedido não foi aprovado. Pode corrigir e enviar um novo pedido.',
    suspended: 'O pedido foi suspenso. Contacte o apoio para saber mais.',
    expired: 'A aprovação caducou. Para continuar a receber, envie um novo pedido com documentos atualizados.',
  }
  return (
    <Card title={`Estado: ${STATUS_LABELS[app.status]}`}>
      <p>{text[app.status]}</p>
      {app.decisionNote && (
        <p className="note">
          <strong>Motivo:</strong> {app.decisionNote}
        </p>
      )}
      {app.status === 'approved' && (
        <p className="hint">
          Ninguém que doou sabe que recebeu. Na sua conta bancária a transferência aparece como "Mão Amiga".
        </p>
      )}
    </Card>
  )
}

function ApplicationForm({ app, onChange, maxMonthly }: { app: Application | null; onChange: () => Promise<void>; maxMonthly: number }) {
  const [adults, setAdults] = useState(String(app?.householdAdults ?? 1))
  const [children, setChildren] = useState(String(app?.householdChildren ?? 0))
  const [income, setIncome] = useState(euroText(app?.monthlyIncomeCents ?? null))
  const [expenses, setExpenses] = useState(euroText(app?.monthlyExpensesCents ?? null))
  const [category, setCategory] = useState(app?.category ?? 'alimentacao')
  const [description, setDescription] = useState(app?.description ?? '')
  const [requested, setRequested] = useState(euroText(app?.requestedCents ?? null))
  const [iban, setIban] = useState('')
  const [saved, setSaved] = useState(false)
  const save = useAction()
  const upload = useAction()
  const submit = useAction()
  const [kind, setKind] = useState('rendimentos')

  const fields = () => {
    const body: Record<string, unknown> = {
      householdAdults: Number(adults),
      householdChildren: Number(children),
      category,
      description,
    }
    for (const [key, text, label] of [
      ['monthlyIncomeCents', income, 'Rendimento'],
      ['monthlyExpensesCents', expenses, 'Despesas'],
      ['requestedCents', requested, 'Valor pedido'],
    ] as const) {
      const v = parseEuro(text)
      if (v === null) throw new Error(`${label}: escreva um valor em euros, por exemplo 450,00.`)
      body[key] = v
    }
    if (iban.trim()) body.iban = iban
    return body
  }

  const onSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    void save.run(async () => {
      await api('PUT', '/api/application', fields())
      setIban('')
      setSaved(true)
      await onChange()
    })
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    void upload.run(async () => {
      if (file.size > MAX_FILE) throw new Error('O ficheiro tem mais de 5 MB.')
      const dataBase64 = await readAsBase64(file)
      await api('POST', '/api/application/documents', { kind, filename: file.name, mime: file.type, dataBase64 })
      await onChange()
    })
  }

  const removeDoc = (id: string) => void upload.run(async () => {
    await api('DELETE', `/api/application/documents/${id}`)
    await onChange()
  })

  const onSubmit = () => void submit.run(async () => {
    await api('POST', '/api/application/submit')
    await onChange()
  })

  return (
    <>
      <Card title="1. A sua situação">
        <p className="hint">
          Escreva só o necessário. Não ponha nomes, moradas ou contactos na descrição: os revisores veem os documentos.
        </p>
        <form className="stack" onSubmit={onSave}>
          <div className="grid2">
            <Field label="Adultos em casa (incluindo si)">
              <input type="number" min={1} max={15} value={adults} onChange={(e) => setAdults(e.target.value)} />
            </Field>
            <Field label="Crianças (menos de 14 anos)">
              <input type="number" min={0} max={15} value={children} onChange={(e) => setChildren(e.target.value)} />
            </Field>
            <Field label="Rendimento da casa por mês (€)" hint="Salários, pensões, subsídios, tudo somado.">
              <input inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} />
            </Field>
            <Field label="Despesas fixas por mês (€)" hint="Renda, luz, água, gás, transportes.">
              <input inputMode="decimal" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
            </Field>
          </div>
          <Field label="Para que precisa do apoio?">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Explique a situação" hint="Entre 20 e 2000 caracteres.">
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Quanto precisa por mês (€)" hint={`No máximo ${formatEuro(maxMonthly)}. Se o fundo não chegar para todos, é dividido em proporção.`}>
            <input inputMode="decimal" value={requested} onChange={(e) => setRequested(e.target.value)} />
          </Field>
          <Field
            label="IBAN para receber"
            hint={app?.ibanLast4 ? `Guardado: termina em ${app.ibanLast4}. Deixe vazio para manter.` : 'Tem de estar em seu nome.'}
          >
            <input autoComplete="off" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="PT50 …" />
          </Field>
          <ErrorBox message={save.error} />
          {saved && <p className="ok">Guardado.</p>}
          <button className="secondary" disabled={save.busy}>
            Guardar
          </button>
        </form>
      </Card>

      {app && (
        <Card title="2. Documentos de prova">
          <p>São obrigatórios: prova de rendimentos e prova de morada. PDF, JPEG ou PNG até 5 MB.</p>
          <p className="hint">Os documentos ficam cifrados e são apagados assim que o pedido for decidido.</p>
          {app.documents.length > 0 && (
            <ul className="list">
              {app.documents.map((d) => (
                <li key={d.id}>
                  <span>{d.filename}</span>
                  <span className="tag">{d.kind}</span>
                  <button className="link" onClick={() => removeDoc(d.id)}>
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid2">
            <Field label="Tipo de documento">
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(DOCUMENT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ficheiro">
              <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => {
                onFile(e.target.files?.[0])
                e.target.value = ''
              }} />
            </Field>
          </div>
          <ErrorBox message={upload.error} />
        </Card>
      )}

      {app && (
        <Card title="3. Enviar">
          <p>Ao enviar, confirma que tudo o que escreveu é verdade. Depois de enviado, o pedido não pode ser alterado.</p>
          <ErrorBox message={submit.error} />
          <button className="primary" disabled={submit.busy} onClick={onSubmit}>
            Enviar pedido
          </button>
        </Card>
      )}
    </>
  )
}

function Payouts() {
  const payouts = useLoad(() => api<Payout[]>('GET', '/api/payouts'))
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const action = useAction()
  const send = () => void action.run(async () => {
    await api('POST', '/api/thanks', { text })
    setText('')
    setSent(true)
  })
  const list = payouts.data ?? []
  return (
    <>
      <Card title="Apoios recebidos">
        <ErrorBox message={payouts.error} />
        {list.length === 0 && <p className="muted">Ainda não houve nenhuma distribuição desde que foi aprovado.</p>}
        <ul className="list">
          {list.map((p, i) => (
            <li key={i}>
              <span>{formatDate(p.createdAt)}</span>
              <span>{formatEuro(p.amountCents)}</span>
              <span className="tag">{p.from}</span>
            </li>
          ))}
        </ul>
      </Card>
      {list.length > 0 && (
        <Card title="Deixar um agradecimento (opcional)">
          <p className="hint">A mensagem aparece sem o seu nome, depois de revista. Não escreva dados pessoais.</p>
          <textarea rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
          <ErrorBox message={action.error} />
          {sent && <p className="ok">Obrigado. A mensagem vai ser revista antes de aparecer.</p>}
          <button className="secondary" disabled={action.busy || text.trim().length < 5} onClick={send}>
            Enviar mensagem
          </button>
        </Card>
      )}
    </>
  )
}
