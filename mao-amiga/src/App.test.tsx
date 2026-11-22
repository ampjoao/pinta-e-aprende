// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.endsWith('/api/stats')
        ? { donors: null, donatedCents: null, peopleHelped: null, distributedCents: null, cycles: 0, minGroup: 5 }
        : []
      return new Response(JSON.stringify(body), { status: 200 })
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

it('mostra a página inicial com as duas escolhas e esconde estatísticas de grupos pequenos', async () => {
  render(<App />)
  expect(screen.getByRole('button', { name: 'Quero ajudar' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Preciso de ajuda' })).toBeInTheDocument()
  expect(await screen.findByText(/doados por menos de 5 pessoas/)).toBeInTheDocument()
})

it('o registo exige aceitar os termos', async () => {
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: 'Preciso de ajuda' }))
  const submit = screen.getByRole('button', { name: 'Criar conta' })
  expect(submit).toBeDisabled()
  await userEvent.click(screen.getByRole('checkbox'))
  expect(submit).toBeEnabled()
  expect(screen.getByRole('radio', { name: 'Preciso de ajuda' })).toHaveAttribute('aria-checked', 'true')
})
