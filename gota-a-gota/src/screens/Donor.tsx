import { useEffect, useState } from 'react'
import { api, type Donation } from '../api'
import { useLocale } from '../i18n'
import { Card, ErrorBox, Field, useAction, useCatalog, useLoad } from '../ui'

export function Donor({ country }: { country: string | null }) {
  const { t, money, parseMoney, currencyName } = useLocale()
  const catalog = useCatalog()
  const donations = useLoad(() => api<Donation[]>('GET', '/api/donations'))
  const [currency, setCurrency] = useState<string | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [thanks, setThanks] = useState<string | null>(null)
  const action = useAction()
  const cat = catalog.data

  // Moeda por omissão: a do país do doador, se for aceite; senão a moeda base.
  useEffect(() => {
    if (!cat || currency) return
    const local = cat.countries.find((c) => c.code === country)?.currency
    const initial = local && cat.donationCurrencies.includes(local) ? local : cat.baseCurrency
    setCurrency(initial)
    setAmount(cat.donationPresets[initial]?.[1] ?? null)
  }, [cat, country, currency])

  const presets = (currency && cat?.donationPresets[currency]) || []
  const chosen = amount ?? (currency ? parseMoney(custom, currency) : null)
  const list = donations.data ?? []
  const totals = new Map<string, number>()
  for (const d of list) totals.set(d.currency, (totals.get(d.currency) ?? 0) + d.amountMinor)

  const donate = () =>
    void action.run(async () => {
      if (!currency || !chosen) throw new Error(t('donor.amountRequired'))
      await api('POST', '/api/donations', { amountMinor: chosen, currency })
      setThanks(money(chosen, currency))
      setCustom('')
      await donations.reload()
    })

  return (
    <div className="stack">
      <Card title={t('donor.title')}>
        <p>{t('donor.intro')}</p>
        <ErrorBox message={catalog.error} />
        {cat && currency && (
          <div className="stack">
            <Field label={t('donor.currency')}>
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value)
                  setAmount(cat.donationPresets[e.target.value]?.[1] ?? null)
                }}
              >
                {cat.donationCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c} · {currencyName(c)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="presets">
              {presets.map((p) => (
                <button key={p} className={amount === p ? 'on' : ''} onClick={() => setAmount(p)}>
                  {money(p, currency)}
                </button>
              ))}
              <button className={amount === null ? 'on' : ''} onClick={() => setAmount(null)}>
                {t('donor.other')}
              </button>
            </div>
            {amount === null && <input aria-label={t('donor.otherLabel')} inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} />}
            <ErrorBox message={action.error} />
            {thanks && <p className="ok">{t('donor.thanks', { amount: thanks })}</p>}
            <button className="primary" disabled={action.busy || !chosen} onClick={donate}>
              {t('donor.give', { amount: chosen ? money(chosen, currency) : '' })}
            </button>
          </div>
        )}
        <p className="hint">{t('donor.tax')}</p>
      </Card>

      <Card title={t('donor.history')}>
        <ErrorBox message={donations.error} />
        {donations.loaded && list.length === 0 && <p className="muted">{t('donor.none')}</p>}
        {list.length > 0 && (
          <>
            <p>
              <strong>{t('donor.total', { amount: [...totals].map(([c, v]) => money(v, c)).join(' + ') })}</strong>
            </p>
            <ul className="list">
              {list.map((d) => (
                <li key={d.id}>
                  <DonationDate ms={d.createdAt} />
                  <span>{money(d.amountMinor, d.currency)}</span>
                  <span className="tag">{d.distributed ? t('donor.distributed') : t('donor.waiting')}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="hint">{t('donor.whereTo')}</p>
      </Card>
    </div>
  )
}

const DonationDate = ({ ms }: { ms: number }) => <span>{useLocale().date(ms)}</span>
