import { useState } from 'react'
import { api, type QueueItem, type ReviewDetail } from '../api'
import { CATEGORY_LABELS, formatDate, formatEuro } from '../format'
import { Card, ErrorBox, Field, useAction, useLoad } from '../ui'

export function Reviewer() {
  const [tab, setTab] = useState<'queue' | 'notes'>('queue')
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div className="stack">
      <div className="choice">
        <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>
          Pedidos
        </button>
        <button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>
          Mensagens
        </button>
      </div>
      {tab === 'queue' && !openId && <Queue onOpen={setOpenId} />}
      {tab === 'queue' && openId && <Detail id={openId} onClose={() => setOpenId(null)} />}
      {tab === 'notes' && <NotesModeration />}
    </div>
  )
}

function Queue({ onOpen }: { onOpen: (id: string) => void }) {
  const queue = useLoad(() => api<QueueItem[]>('GET', '/api/review/queue'))
  return (
    <Card title="Pedidos por verificar">
      <ErrorBox message={queue.error} />
      {queue.data?.length === 0 && <p className="muted">Não há pedidos à espera.</p>}
      <ul className="list">
        {queue.data?.map((q) => (
          <li key={q.id}>
            <button className="rowbtn" onClick={() => onOpen(q.id)}>
              <strong>{q.alias}</strong>
              <span>{CATEGORY_LABELS[q.category]}</span>
              <span>
                {q.householdAdults} adulto(s), {q.householdChildren} criança(s)
              </span>
              <span>{formatEuro(q.requestedCents)}/mês</span>
              <span className="tag">
                {q.myVote ? 'Já votou' : `${q.approvals}/${q.approvalsRequired} aprovações`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useLoad(() => api<ReviewDetail>('GET', `/api/review/applications/${id}`), [id])
  const [note, setNote] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const action = useAction()
  const docAction = useAction()
  const d = detail.data

  const openDoc = (docId: string) =>
    void docAction.run(async () => {
      const doc = await api<{ filename: string; mime: string; dataBase64: string }>('GET', `/api/review/documents/${docId}`)
      const bytes = Uint8Array.from(atob(doc.dataBase64), (c) => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: doc.mime }))
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    })

  const vote = (decision: 'approve' | 'reject') =>
    void action.run(async () => {
      const r = await api<{ status: string }>('POST', `/api/review/applications/${id}/vote`, { decision, note })
      setResult(r.status === 'approved' ? 'Pedido aprovado.' : r.status === 'rejected' ? 'Pedido recusado.' : 'Voto registado. Falta outro revisor.')
      await detail.reload()
    })

  const suspend = () =>
    void action.run(async () => {
      await api('POST', `/api/review/applications/${id}/suspend`, { note })
      setResult('Pedido suspenso por suspeita de fraude.')
      await detail.reload()
    })

  return (
    <Card title={d ? `Pedido ${d.alias}` : 'Pedido'}>
      <button className="link" onClick={onClose}>
        ← Voltar à lista
      </button>
      <ErrorBox message={detail.error} />
      {d && (
        <div className="stack">
          <dl className="facts">
            <dt>Nome verificado</dt>
            <dd>
              {d.legalName} {d.age !== null && `(${d.age} anos)`}
            </dd>
            <dt>Agregado</dt>
            <dd>
              {d.householdAdults} adulto(s), {d.householdChildren} criança(s)
            </dd>
            <dt>Rendimento mensal</dt>
            <dd>{formatEuro(d.monthlyIncomeCents)}</dd>
            <dt>Despesas fixas</dt>
            <dd>{formatEuro(d.monthlyExpensesCents)}</dd>
            <dt>Pede</dt>
            <dd>
              {formatEuro(d.requestedCents)}/mês · {CATEGORY_LABELS[d.category]}
            </dd>
            <dt>IBAN</dt>
            <dd>{d.ibanMasked}</dd>
          </dl>
          <p className="note">{d.description}</p>

          <div className="checks">
            <Check ok={d.checks.belowPovertyLine}>
              Rendimento por adulto equivalente: {formatEuro(d.checks.equivalentIncomeCents)} (limiar de pobreza:{' '}
              {formatEuro(d.checks.povertyLineCents)})
            </Check>
            <Check ok={d.checks.expensesExceedIncome}>Despesas {d.checks.expensesExceedIncome ? 'maiores' : 'menores'} que o rendimento</Check>
            <Check ok={d.checks.documentsSeenInOtherAccounts === 0}>
              {d.checks.documentsSeenInOtherAccounts === 0
                ? 'Documentos não aparecem noutras contas'
                : `Documentos iguais em ${d.checks.documentsSeenInOtherAccounts} outra(s) conta(s) — confirmar se é o mesmo agregado`}
            </Check>
            <Check ok={d.checks.previousRejections === 0}>Pedidos recusados antes: {d.checks.previousRejections}</Check>
          </div>

          <div>
            <h3>Documentos</h3>
            {d.documents.length === 0 && <p className="muted">Sem documentos (já foram apagados após a decisão).</p>}
            <ul className="list">
              {d.documents.map((doc) => (
                <li key={doc.id}>
                  <span>{doc.filename}</span>
                  <span className="tag">{doc.kind}</span>
                  <button className="link" onClick={() => openDoc(doc.id)}>
                    Abrir
                  </button>
                </li>
              ))}
            </ul>
            <ErrorBox message={docAction.error} />
            <p className="hint">Cada abertura fica registada. Confirme que o nome nos documentos é o nome verificado.</p>
          </div>

          {d.status === 'pending' && !d.myVote ? (
            <>
              <Field label="Justificação (obrigatória)" hint="Se recusar, a pessoa vê este texto.">
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <ErrorBox message={action.error} />
              <div className="row">
                <button className="primary" disabled={action.busy} onClick={() => vote('approve')}>
                  Aprovar
                </button>
                <button className="danger" disabled={action.busy} onClick={() => vote('reject')}>
                  Recusar
                </button>
                <button className="link" disabled={action.busy} onClick={suspend}>
                  Suspeita de fraude
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Estado: {d.status}{d.myVote ? ' · já votou' : ''}</p>
          )}
          {result && <p className="ok">{result}</p>}
        </div>
      )}
    </Card>
  )
}

const Check = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <p className={ok ? 'check-ok' : 'check-warn'}>
    <span aria-hidden>{ok ? '✓' : '!'}</span> {children}
  </p>
)

function NotesModeration() {
  const notes = useLoad(() => api<{ id: string; text: string; createdAt: number }[]>('GET', '/api/review/notes'))
  const action = useAction()
  const decide = (id: string, decision: 'approve' | 'reject') =>
    void action.run(async () => {
      await api('POST', `/api/review/notes/${id}`, { decision })
      await notes.reload()
    })
  return (
    <Card title="Mensagens de agradecimento por rever">
      <p className="hint">Recuse mensagens com nomes, contactos, moradas ou qualquer coisa que identifique alguém.</p>
      <ErrorBox message={notes.error ?? action.error} />
      {notes.data?.length === 0 && <p className="muted">Nada por rever.</p>}
      <ul className="list">
        {notes.data?.map((n) => (
          <li key={n.id} className="col">
            <span>“{n.text}”</span>
            <span className="hint">{formatDate(n.createdAt)}</span>
            <div className="row">
              <button className="secondary" onClick={() => decide(n.id, 'approve')}>
                Publicar
              </button>
              <button className="danger" onClick={() => decide(n.id, 'reject')}>
                Recusar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
