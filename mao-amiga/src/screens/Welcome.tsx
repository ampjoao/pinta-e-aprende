import { api, type Note, type Role, type Stats } from '../api'
import { useLocale } from '../i18n'
import { useCatalog, useLoad } from '../ui'

export function Welcome({ onStart }: { onStart: (mode: 'login' | 'register', role?: Role) => void }) {
  const { t, money, country } = useLocale()
  const stats = useLoad(() => api<Stats>('GET', '/api/stats'))
  const notes = useLoad(() => api<Note[]>('GET', '/api/notes'))
  const catalog = useCatalog()
  const s = stats.data
  const count = (v: number | null) => (v === null ? t('welcome.lessThan', { n: s?.minGroup ?? 5 }) : String(v))
  const countryNames = (catalog.data?.countries ?? []).map((c) => country(c.code)).sort((a, b) => a.localeCompare(b))

  return (
    <div className="stack">
      <section className="hero">
        <h1>{t('welcome.title')}</h1>
        <p>{t('welcome.lead')}</p>
        <div className="actions">
          <button className="primary" onClick={() => onStart('register', 'donor')}>
            {t('welcome.help')}
          </button>
          <button className="secondary" onClick={() => onStart('register', 'beneficiary')}>
            {t('welcome.needHelp')}
          </button>
          <button className="link" onClick={() => onStart('login')}>
            {t('welcome.haveAccount')}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>{t('welcome.how')}</h2>
        <ol className="steps">
          {(['1', '2', '3', '4'] as const).map((n) => (
            <li key={n}>
              <strong>{t(`welcome.step${n}.title`)}</strong> {t(`welcome.step${n}.text`)}
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>{t('welcome.sofar')}</h2>
        {s && (
          <div className="stats">
            <div>
              <span className="big">{s.donatedMinor === null ? '—' : money(s.donatedMinor, s.currency)}</span>
              <span>{t('welcome.donatedBy', { n: count(s.donors) })}</span>
            </div>
            <div>
              <span className="big">{s.distributedMinor === null ? '—' : money(s.distributedMinor, s.currency)}</span>
              <span>{t('welcome.deliveredTo', { n: count(s.peopleHelped) })}</span>
            </div>
            <div>
              <span className="big">{s.cycles}</span>
              <span>{t('welcome.cycles')}</span>
            </div>
          </div>
        )}
        <p className="hint">{t('welcome.smallGroups')}</p>
        {countryNames.length > 0 && (
          <p className="hint">
            <strong>{t('welcome.countries')}:</strong> {countryNames.join(' · ')}
          </p>
        )}
      </section>

      {notes.data && notes.data.length > 0 && (
        <section className="card">
          <h2>{t('welcome.notes')}</h2>
          <ul className="notes">
            {notes.data.map((n, i) => (
              <li key={i}>“{n.text}”</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
