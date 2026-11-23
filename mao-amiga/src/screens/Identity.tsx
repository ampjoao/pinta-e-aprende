import { useState } from 'react'
import { api } from '../api'
import { useLocale } from '../i18n'
import { Card, ErrorBox, Field, useAction, useCatalog } from '../ui'

export function Identity({ onDone }: { onDone: () => void }) {
  const { t, country } = useLocale()
  const catalog = useCatalog()
  const [countryCode, setCountryCode] = useState('')
  const [legalName, setLegalName] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const action = useAction()
  const countries = [...(catalog.data?.countries ?? [])].sort((a, b) => country(a.code).localeCompare(country(b.code)))
  const selected = countries.find((c) => c.code === countryCode)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void action.run(async () => {
      await api('POST', '/api/identity', { legalName, country: countryCode, nationalId, birthDate })
      onDone()
    })
  }

  return (
    <Card title={t('identity.title')}>
      <p>{t('identity.intro')}</p>
      <ul className="bullets">
        <li>{t('identity.point1')}</li>
        <li>{t('identity.point2')}</li>
        <li>{t('identity.point3')}</li>
      </ul>
      <ErrorBox message={catalog.error} />
      <form onSubmit={submit} className="stack">
        <Field label={t('identity.country')} hint={t('identity.countryHint')}>
          <select required value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
            <option value="" disabled>
              —
            </option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {country(c.code)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('identity.name')}>
          <input required autoComplete="name" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </Field>
        <Field label={t(`idType.${selected?.idType ?? 'national_id'}`)}>
          <input required autoComplete="off" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
        </Field>
        <Field label={t('identity.birthDate')}>
          <input required type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <ErrorBox message={action.error} />
        <button className="primary" disabled={action.busy || !countryCode}>
          {t('identity.confirm')}
        </button>
      </form>
    </Card>
  )
}
