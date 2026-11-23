// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const catalog = {
  baseCurrency: 'EUR',
  donationCurrencies: ['EUR', 'USD'],
  donationPresets: { EUR: [1000, 2500], USD: [1100, 2800] },
  minDonationMinor: 500,
  maxDonationMinor: 1000000,
  countries: [
    { code: 'PT', currency: 'EUR', idType: 'nif', payoutMethods: ['iban'], maxMonthlyMinor: 30000, ageOfMajority: 18 },
    { code: 'BR', currency: 'BRL', idType: 'cpf', payoutMethods: ['pix'], maxMonthlyMinor: 60000, ageOfMajority: 18 },
  ],
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.endsWith('/api/stats')
        ? { currency: 'EUR', donors: null, donatedMinor: null, peopleHelped: null, distributedMinor: null, cycles: 0, minGroup: 5 }
        : url.endsWith('/api/catalog')
          ? catalog
          : []
      return new Response(JSON.stringify(body), { status: 200 })
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

it('mostra a página inicial em português e esconde estatísticas de grupos pequenos', async () => {
  render(<App language="pt-PT" />)
  expect(screen.getByRole('button', { name: 'Quero ajudar' })).toBeInTheDocument()
  expect(await screen.findByText(/doados por menos de 5 pessoas/)).toBeInTheDocument()
  expect(await screen.findByText(/Brasil · Portugal/)).toBeInTheDocument()
})

it('muda de língua no seletor', async () => {
  render(<App language="pt-PT" />)
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Língua' }), 'es')
  expect(screen.getByRole('button', { name: 'Quiero ayudar' })).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('es')
})

it('o registo exige aceitar os termos', async () => {
  render(<App language="en" />)
  await userEvent.click(screen.getByRole('button', { name: 'I need help' }))
  const submit = screen.getByRole('button', { name: 'Create account' })
  expect(submit).toBeDisabled()
  await userEvent.click(screen.getByRole('checkbox'))
  expect(submit).toBeEnabled()
  expect(screen.getByRole('radio', { name: 'I need help' })).toHaveAttribute('aria-checked', 'true')
})
