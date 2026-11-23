import { useState } from 'react'
import { api, type Application, type ApplicationResponse, type Country, type Payout, type PayoutType } from '../api'
import type { Key } from '../i18n/en'
import { useLocale } from '../i18n'
import { Card, ErrorBox, Field, useAction, useLoad } from '../ui'

const MAX_FILE = 5 * 1024 * 1024
const CATEGORIES = ['food', 'housing', 'health', 'education', 'utilities', 'transport', 'other'] as const
const DOC_KINDS = ['income_proof', 'address_proof', 'expenses', 'other'] as const
/** Campos que cada forma de receber pede. */
const PAYOUT_FIELDS: Record<PayoutType, string[]> = {
  iban: ['iban'],
  pix: ['pixKey'],
  mobile_money: ['phone', 'operator'],
  bank_account: ['accountNumber', 'bankCode', 'bankName'],
  wallet: ['provider', 'handle'],
}

const readAsBase64 = (file: File, errorText: string) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error(errorText))
    reader.readAsDataURL(file)
  })

export function Beneficiary() {
  const res = useLoad(() => api<ApplicationResponse>('GET', '/api/application'))
  const { t } = useLocale()
  if (!res.loaded) return <p className="muted">{t('app.loading')}</p>
  if (res.error || !res.data) return <ErrorBox message={res.error} />
  const { application: a, country } = res.data
  const editable = !a || ['draft', 'rejected', 'expired'].includes(a.status)
  return (
    <div className="stack">
      {a && a.status !== 'draft' && <StatusCard app={a} />}
      {editable && country && <ApplicationForm app={a?.status === 'draft' ? a : null} country={country} onChange={res.reload} />}
      {a && (a.status === 'approved' || a.status === 'expired') && <Payouts />}
    </div>
  )
}

function StatusCard({ app }: { app: Application }) {
  const { t, date } = useLocale()
  const text =
    app.status === 'approved'
      ? t('ben.status.approved', { date: app.validUntil ? date(app.validUntil) : '—', payout: app.payoutMasked ?? '—' })
      : t(`ben.status.${app.status}` as Key)
  return (
    <Card title={t('ben.statusTitle', { status: t(`status.${app.status}`) })}>
      <p>{text}</p>
      {app.decisionNote && (
        <p className="note">
          <strong>{t('ben.reason')}</strong> {app.decisionNote}
        </p>
      )}
      {app.status === 'approved' && <p className="hint">{t('ben.private')}</p>}
    </Card>
  )
}

function ApplicationForm({ app, country, onChange }: { app: Application | null; country: Country; onChange: () => Promise<void> }) {
  const { t, money, parseMoney, currencyName } = useLocale()
  const cur = country.currency
  const asText = (minor: number | null) => (minor === null ? '' : money(minor, cur).replace(/[^\d.,\s]/g, '').trim())
  const [adults, setAdults] = useState(String(app?.householdAdults ?? 1))
  const [children, setChildren] = useState(String(app?.householdChildren ?? 0))
  const [income, setIncome] = useState(asText(app?.monthlyIncomeMinor ?? null))
  const [expenses, setExpenses] = useState(asText(app?.monthlyExpensesMinor ?? null))
  const [category, setCategory] = useState(app?.category ?? 'food')
  const [description, setDescription] = useState(app?.description ?? '')
  const [requested, setRequested] = useState(asText(app?.requestedMinor ?? null))
  const [payoutType, setPayoutType] = useState<PayoutType>(app?.payoutType ?? country.payoutMethods[0])
  const [payout, setPayout] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [kind, setKind] = useState<string>('income_proof')
  const save = useAction()
  const upload = useAction()
  const submit = useAction()

  const body = () => {
    const out: Record<string, unknown> = { householdAdults: Number(adults), householdChildren: Number(children), category, description }
    for (const [key, text, label] of [
      ['monthlyIncomeMinor', income, t('ben.income')],
      ['monthlyExpensesMinor', expenses, t('ben.expenses')],
      ['requestedMinor', requested, t('ben.requested')],
    ] as const) {
      const v = parseMoney(text, cur)
      if (v === null) throw new Error(t('ben.amountInvalid', { field: label }))
      out[key] = v
    }
    if (PAYOUT_FIELDS[payoutType].some((f) => payout[f]?.trim())) out.payout = { type: payoutType, ...payout }
    return out
  }

  const onSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    void save.run(async () => {
      await api('PUT', '/api/application', body())
      setPayout({})
      setSaved(true)
      await onChange()
    })
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    void upload.run(async () => {
      if (file.size > MAX_FILE) throw new Error(t('ben.fileTooBig'))
      const dataBase64 = await readAsBase64(file, t('ben.fileRead'))
      await api('POST', '/api/application/documents', { kind, filename: file.name, mime: file.type, dataBase64 })
      await onChange()
    })
  }

  const removeDoc = (id: string) =>
    void upload.run(async () => {
      await api('DELETE', `/api/application/documents/${id}`)
      await onChange()
    })

  const onSubmit = () =>
    void submit.run(async () => {
      await api('POST', '/api/application/submit')
      await onChange()
    })

  return (
    <>
      <Card title={t('ben.step1')}>
        <p className="hint">{t('ben.privacyHint')}</p>
        <p className="hint">{t('ben.currencyNote', { currency: `${cur} · ${currencyName(cur)}` })}</p>
        <form className="stack" onSubmit={onSave}>
          <div className="grid2">
            <Field label={t('ben.adults')}>
              <input type="number" min={1} max={15} value={adults} onChange={(e) => setAdults(e.target.value)} />
            </Field>
            <Field label={t('ben.children')}>
              <input type="number" min={0} max={15} value={children} onChange={(e) => setChildren(e.target.value)} />
            </Field>
            <Field label={`${t('ben.income')} (${cur})`} hint={t('ben.incomeHint')}>
              <input inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} />
            </Field>
            <Field label={`${t('ben.expenses')} (${cur})`} hint={t('ben.expensesHint')}>
              <input inputMode="decimal" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
            </Field>
          </div>
          <Field label={t('ben.category')}>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((k) => (
                <option key={k} value={k}>
                  {t(`category.${k}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('ben.description')} hint={t('ben.descriptionHint')}>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label={`${t('ben.requested')} (${cur})`} hint={t('ben.requestedHint', { max: money(country.maxMonthlyMinor, cur) })}>
            <input inputMode="decimal" value={requested} onChange={(e) => setRequested(e.target.value)} />
          </Field>

          <fieldset className="stack">
            <legend className="label">{t('ben.payout')}</legend>
            <span className="hint">{app?.payoutMasked ? t('ben.payoutSaved', { payout: app.payoutMasked }) : t('ben.payoutOwn')}</span>
            {country.payoutMethods.length > 1 && (
              <div className="choice">
                {country.payoutMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={payoutType === m ? 'on' : ''}
                    onClick={() => {
                      setPayoutType(m)
                      setPayout({})
                    }}
                  >
                    {t(`payout.${m}`)}
                  </button>
                ))}
              </div>
            )}
            {PAYOUT_FIELDS[payoutType].map((f) => (
              <Field key={f} label={t(`payout.${payoutType}.${f}` as Key)}>
                <input autoComplete="off" value={payout[f] ?? ''} onChange={(e) => setPayout({ ...payout, [f]: e.target.value })} />
              </Field>
            ))}
          </fieldset>

          <ErrorBox message={save.error} />
          {saved && <p className="ok">{t('ben.saved')}</p>}
          <button className="secondary" disabled={save.busy}>
            {t('ben.save')}
          </button>
        </form>
      </Card>

      {app && (
        <Card title={t('ben.step2')}>
          <p>{t('ben.docsRequired')}</p>
          <p className="hint">{t('ben.docsDeleted')}</p>
          {app.documents.length > 0 && (
            <ul className="list">
              {app.documents.map((d) => (
                <li key={d.id}>
                  <span>{d.filename}</span>
                  <span className="tag">{t(`docShort.${d.kind}` as Key)}</span>
                  <button className="link" onClick={() => removeDoc(d.id)}>
                    {t('ben.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid2">
            <Field label={t('ben.docType')}>
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {DOC_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`doc.${k}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('ben.file')}>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => {
                  onFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </Field>
          </div>
          <ErrorBox message={upload.error} />
        </Card>
      )}

      {app && (
        <Card title={t('ben.step3')}>
          <p>{t('ben.sendText')}</p>
          <ErrorBox message={submit.error} />
          <button className="primary" disabled={submit.busy} onClick={onSubmit}>
            {t('ben.send')}
          </button>
        </Card>
      )}
    </>
  )
}

function Payouts() {
  const { t, money, date } = useLocale()
  const payouts = useLoad(() => api<Payout[]>('GET', '/api/payouts'))
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const action = useAction()
  const list = payouts.data ?? []
  const send = () =>
    void action.run(async () => {
      await api('POST', '/api/thanks', { text })
      setText('')
      setSent(true)
    })
  return (
    <>
      <Card title={t('ben.received')}>
        <ErrorBox message={payouts.error} />
        {payouts.loaded && list.length === 0 && <p className="muted">{t('ben.noneYet')}</p>}
        <ul className="list">
          {list.map((p, i) => (
            <li key={i}>
              <span>{date(p.createdAt)}</span>
              <span>{money(p.localAmountMinor, p.localCurrency)}</span>
              <span className="tag">{t('ben.fromCommunity')}</span>
            </li>
          ))}
        </ul>
      </Card>
      {list.length > 0 && (
        <Card title={t('ben.thanksTitle')}>
          <p className="hint">{t('ben.thanksHint')}</p>
          <textarea aria-label={t('ben.thanksTitle')} rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
          <ErrorBox message={action.error} />
          {sent && <p className="ok">{t('ben.thanksSent')}</p>}
          <button className="secondary" disabled={action.busy || text.trim().length < 5} onClick={send}>
            {t('ben.sendMessage')}
          </button>
        </Card>
      )}
    </>
  )
}
