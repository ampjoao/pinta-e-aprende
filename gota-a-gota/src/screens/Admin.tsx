import { useState } from 'react'
import { api, type Cycle } from '../api'
import { useLocale } from '../i18n'
import { Card, ErrorBox, Field, useAction, useCatalog, useLoad } from '../ui'
import { Reviewer } from './Reviewer'

export function Admin() {
  const { t, money, date, country } = useLocale()
  const cycles = useLoad(() => api<Cycle[]>('GET', '/api/admin/cycles'))
  const catalog = useCatalog()
  const run = useAction()
  const create = useAction()
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reviewCountries, setReviewCountries] = useState<string[]>([])

  const runCycle = () =>
    void run.run(async () => {
      const r = await api<{ currency: string; distributedMinor: number; beneficiaryCount: number; carryOverMinor: number; failed: number }>(
        'POST',
        '/api/admin/cycles',
      )
      setMessage(
        t('admin.result', { amount: money(r.distributedMinor, r.currency), n: r.beneficiaryCount, carry: money(r.carryOverMinor, r.currency) }) +
          (r.failed ? ' ' + t('admin.failed', { n: r.failed }) : ''),
      )
      await cycles.reload()
    })

  const addReviewer = (e: React.FormEvent) => {
    e.preventDefault()
    void create.run(async () => {
      await api('POST', '/api/admin/reviewers', { email, password, countries: reviewCountries })
      setMessage(t('admin.created', { email }))
      setEmail('')
      setPassword('')
      setReviewCountries([])
    })
  }

  const toggle = (code: string) =>
    setReviewCountries((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]))

  return (
    <div className="stack">
      <Card title={t('admin.cycleTitle')}>
        <p>{t('admin.cycleText')}</p>
        <ErrorBox message={run.error} />
        {message && <p className="ok">{message}</p>}
        <button className="primary" disabled={run.busy} onClick={runCycle}>
          {t('admin.run')}
        </button>
        <ul className="list">
          {cycles.data?.map((c) => (
            <li key={c.id}>
              <span>{date(c.runAt)}</span>
              <span>{t('admin.cycleLine', { distributed: money(c.distributedMinor, c.currency), pool: money(c.poolMinor, c.currency) })}</span>
              <span className="tag">{t('admin.cycleTag', { donors: c.donorCount, beneficiaries: c.beneficiaryCount })}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t('admin.reviewerTitle')}>
        <p className="hint">{t('admin.reviewerHint')}</p>
        <form className="stack" onSubmit={addReviewer}>
          <Field label={t('auth.email')}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t('admin.initialPassword')}>
            <input type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <fieldset className="stack">
            <legend className="label">{t('admin.countries')}</legend>
            <span className="hint">{t('admin.countriesHint')}</span>
            <div className="presets">
              {catalog.data?.countries.map((c) => (
                <button type="button" key={c.code} className={reviewCountries.includes(c.code) ? 'on' : ''} onClick={() => toggle(c.code)}>
                  {country(c.code)}
                </button>
              ))}
            </div>
          </fieldset>
          <ErrorBox message={create.error} />
          <button className="secondary" disabled={create.busy}>
            {t('admin.create')}
          </button>
        </form>
      </Card>

      <Reviewer countries={[]} />
    </div>
  )
}
