import { useState, type ReactNode } from 'react'
import { api, type QueueItem, type ReviewDetail } from '../api'
import type { Key } from '../i18n/en'
import { useLocale } from '../i18n'
import { Card, ErrorBox, Field, useAction, useLoad } from '../ui'

export function Reviewer({ countries }: { countries: string[] }) {
  const { t, country } = useLocale()
  const [tab, setTab] = useState<'queue' | 'notes'>('queue')
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div className="stack">
      <div className="choice">
        <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>
          {t('rev.requests')}
        </button>
        <button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>
          {t('rev.messages')}
        </button>
      </div>
      <p className="hint">{countries.length ? t('rev.yourCountries', { list: countries.map(country).join(', ') }) : t('rev.allCountries')}</p>
      {tab === 'queue' && !openId && <Queue onOpen={setOpenId} />}
      {tab === 'queue' && openId && <Detail id={openId} onClose={() => setOpenId(null)} />}
      {tab === 'notes' && <NotesModeration />}
    </div>
  )
}

function Queue({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, money, country } = useLocale()
  const queue = useLoad(() => api<QueueItem[]>('GET', '/api/review/queue'))
  return (
    <Card title={t('rev.queueTitle')}>
      <ErrorBox message={queue.error} />
      {queue.data?.length === 0 && <p className="muted">{t('rev.queueEmpty')}</p>}
      <ul className="list">
        {queue.data?.map((q) => (
          <li key={q.id}>
            <button className="rowbtn" onClick={() => onOpen(q.id)}>
              <strong>{q.alias}</strong>
              <span>{country(q.country)}</span>
              <span>{t(`category.${q.category}` as Key)}</span>
              <span>{t('rev.household', { adults: q.householdAdults, children: q.householdChildren })}</span>
              <span>{t('rev.perMonth', { amount: money(q.requestedMinor, q.currency) })}</span>
              <span className="tag">{q.myVote ? t('rev.voted') : t('rev.approvals', { n: q.approvals, total: q.approvalsRequired })}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, money, country } = useLocale()
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
      setResult(r.status === 'approved' ? t('rev.resultApproved') : r.status === 'rejected' ? t('rev.resultRejected') : t('rev.resultPending'))
      await detail.reload()
    })

  const suspend = () =>
    void action.run(async () => {
      await api('POST', `/api/review/applications/${id}/suspend`, { note })
      setResult(t('rev.resultSuspended'))
      await detail.reload()
    })

  return (
    <Card title={d ? t('rev.request', { alias: d.alias }) : undefined}>
      <button className="link" onClick={onClose}>
        {t('rev.back')}
      </button>
      <ErrorBox message={detail.error} />
      {d && (
        <div className="stack">
          <dl className="facts">
            <dt>{t('rev.verifiedName')}</dt>
            <dd>
              {d.legalName} {d.age !== null && t('rev.age', { age: d.age })}
            </dd>
            <dt>{t('rev.country')}</dt>
            <dd>{country(d.country)}</dd>
            <dt>{t('rev.household.label')}</dt>
            <dd>{t('rev.household', { adults: d.householdAdults, children: d.householdChildren })}</dd>
            <dt>{t('rev.income')}</dt>
            <dd>{money(d.monthlyIncomeMinor, d.currency)}</dd>
            <dt>{t('rev.expenses')}</dt>
            <dd>{money(d.monthlyExpensesMinor, d.currency)}</dd>
            <dt>{t('rev.asks')}</dt>
            <dd>
              {t('rev.perMonth', { amount: money(d.requestedMinor, d.currency) })} · {t(`category.${d.category}` as Key)}
            </dd>
            <dt>{t('rev.payout')}</dt>
            <dd>{d.payoutMasked}</dd>
          </dl>
          <p className="note">{d.description}</p>

          <div className="checks">
            <Check ok={d.checks.belowPovertyLine}>
              {t('rev.checkPoverty', { income: money(d.checks.equivalentIncomeMinor, d.currency), line: money(d.checks.povertyLineMinor, d.currency) })}
              {d.checks.povertyLineIsExample && <em> ({t('rev.exampleLine')})</em>}
            </Check>
            <Check ok={d.checks.expensesExceedIncome}>{d.checks.expensesExceedIncome ? t('rev.checkExpensesMore') : t('rev.checkExpensesLess')}</Check>
            <Check ok={d.checks.documentsSeenInOtherAccounts === 0}>
              {d.checks.documentsSeenInOtherAccounts === 0 ? t('rev.checkDocsOk') : t('rev.checkDocsShared', { n: d.checks.documentsSeenInOtherAccounts })}
            </Check>
            <Check ok={d.checks.previousRejections === 0}>{t('rev.checkRejections', { n: d.checks.previousRejections })}</Check>
          </div>

          <div>
            <h3>{t('rev.documents')}</h3>
            {d.documents.length === 0 && <p className="muted">{t('rev.noDocs')}</p>}
            <ul className="list">
              {d.documents.map((doc) => (
                <li key={doc.id}>
                  <span>{doc.filename}</span>
                  <span className="tag">{t(`docShort.${doc.kind}` as Key)}</span>
                  <button className="link" onClick={() => openDoc(doc.id)}>
                    {t('rev.open')}
                  </button>
                </li>
              ))}
            </ul>
            <ErrorBox message={docAction.error} />
            <p className="hint">{t('rev.openLogged')}</p>
          </div>

          {d.status === 'pending' && !d.myVote ? (
            <>
              <Field label={t('rev.justification')} hint={t('rev.justificationHint')}>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <ErrorBox message={action.error} />
              <div className="row">
                <button className="primary" disabled={action.busy} onClick={() => vote('approve')}>
                  {t('rev.approve')}
                </button>
                <button className="danger" disabled={action.busy} onClick={() => vote('reject')}>
                  {t('rev.reject')}
                </button>
                <button className="link" disabled={action.busy} onClick={suspend}>
                  {t('rev.fraud')}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">
              {t('rev.stateLine', { status: t(`status.${d.status}` as Key) })}
              {d.myVote ? t('rev.youVoted') : ''}
            </p>
          )}
          {result && <p className="ok">{result}</p>}
        </div>
      )}
    </Card>
  )
}

const Check = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
  <p className={ok ? 'check-ok' : 'check-warn'}>
    <span aria-hidden>{ok ? '✓' : '!'}</span> {children}
  </p>
)

function NotesModeration() {
  const { t, date } = useLocale()
  const notes = useLoad(() => api<{ id: string; text: string; createdAt: number }[]>('GET', '/api/review/notes'))
  const action = useAction()
  const decide = (id: string, decision: 'approve' | 'reject') =>
    void action.run(async () => {
      await api('POST', `/api/review/notes/${id}`, { decision })
      await notes.reload()
    })
  return (
    <Card title={t('rev.notesTitle')}>
      <p className="hint">{t('rev.notesHint')}</p>
      <ErrorBox message={notes.error ?? action.error} />
      {notes.data?.length === 0 && <p className="muted">{t('rev.notesEmpty')}</p>}
      <ul className="list">
        {notes.data?.map((n) => (
          <li key={n.id} className="col">
            <span>“{n.text}”</span>
            <span className="hint">{date(n.createdAt)}</span>
            <div className="row">
              <button className="secondary" onClick={() => decide(n.id, 'approve')}>
                {t('rev.publish')}
              </button>
              <button className="danger" onClick={() => decide(n.id, 'reject')}>
                {t('rev.reject')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
