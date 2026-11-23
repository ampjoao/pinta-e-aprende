/**
 * Demonstração: a app completa a correr no browser, sem servidor. O mesmo código do servidor
 * (server/service.ts e server/router.ts) corre aqui com SQLite em JavaScript e dados fictícios.
 * Os pedidos da app ao servidor são apanhados e respondidos localmente.
 */
import './polyfills'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { API_URL, setToken } from '../src/api'
import App from '../src/App'
import '../src/styles.css'
import { loadConfig } from '../server/config.ts'
import { createCrypto } from '../server/crypto.ts'
import { initDemoDb } from './db'
import { MockKycProvider, MockPaymentProvider } from '../server/providers.ts'
import { createRouter } from '../server/router.ts'
import { createService } from '../server/service.ts'
import { openDb } from '../server/db.ts'
import { ACCOUNTS, DEMO_PASSWORD, seedDemo } from './seed'
import './demo.css'

const TEXT: Record<string, Record<string, string>> = {
  'pt-PT': {
    title: 'Demonstração',
    note: 'Tudo corre no seu browser com pessoas e dinheiro fictícios. Recarregar a página recomeça do início.',
    enter: 'Entrar como:',
    donor: 'Doador (Portugal)',
    approved: 'Beneficiária aprovada (Portugal)',
    pending: 'Pedido em análise (Brasil)',
    reviewer: 'Revisor',
    admin: 'Administração',
    visitor: 'Visitante',
    loading: 'A preparar a demonstração…',
  },
  'pt-BR': {
    title: 'Demonstração',
    note: 'Tudo roda no seu navegador com pessoas e dinheiro fictícios. Recarregar a página recomeça do zero.',
    enter: 'Entrar como:',
    donor: 'Doador (Portugal)',
    approved: 'Beneficiária aprovada (Portugal)',
    pending: 'Pedido em análise (Brasil)',
    reviewer: 'Revisor',
    admin: 'Administração',
    visitor: 'Visitante',
    loading: 'Preparando a demonstração…',
  },
  en: {
    title: 'Demo',
    note: 'Everything runs in your browser with made-up people and money. Reloading the page starts over.',
    enter: 'Sign in as:',
    donor: 'Donor (Portugal)',
    approved: 'Approved recipient (Portugal)',
    pending: 'Request under review (Brazil)',
    reviewer: 'Reviewer',
    admin: 'Administration',
    visitor: 'Visitor',
    loading: 'Preparing the demo…',
  },
  es: {
    title: 'Demostración',
    note: 'Todo funciona en su navegador con personas y dinero ficticios. Al recargar la página se empieza de nuevo.',
    enter: 'Entrar como:',
    donor: 'Donante (Portugal)',
    approved: 'Beneficiaria aprobada (Portugal)',
    pending: 'Solicitud en revisión (Brasil)',
    reviewer: 'Revisor',
    admin: 'Administración',
    visitor: 'Visitante',
    loading: 'Preparando la demostración…',
  },
  fr: {
    title: 'Démonstration',
    note: 'Tout fonctionne dans votre navigateur avec des personnes et de l’argent fictifs. Recharger la page recommence à zéro.',
    enter: 'Se connecter en tant que :',
    donor: 'Donateur (Portugal)',
    approved: 'Bénéficiaire approuvée (Portugal)',
    pending: 'Demande en cours (Brésil)',
    reviewer: 'Vérificateur',
    admin: 'Administration',
    visitor: 'Visiteur',
    loading: 'Préparation de la démonstration…',
  },
}

const textFor = (lang: string) => TEXT[lang] ?? TEXT[lang.split('-')[0]] ?? TEXT.en

async function start() {
  await initDemoDb()
  const config = loadConfig({ NODE_ENV: 'test', MIN_DONORS_PER_CYCLE: '2', ALLOWED_ORIGINS: '*' })
  const service = createService({
    db: openDb(':memory:'),
    crypto: createCrypto('5d'.repeat(32)),
    config,
    payments: new MockPaymentProvider(),
    kyc: new MockKycProvider(),
  })
  await seedDemo(service)
  const dispatch = createRouter(service)

  // A app fala com o "servidor" por fetch; aqui as respostas vêm do serviço local.
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(API_URL)) return realFetch(input, init)
    const headers = new Headers(init?.headers)
    const { status, data } = await dispatch({
      method: init?.method ?? 'GET',
      path: new URL(url).pathname,
      authorization: headers.get('authorization') ?? undefined,
      acceptLanguage: headers.get('accept-language') ?? undefined,
      readBody: async () => (typeof init?.body === 'string' ? JSON.parse(init.body) : {}),
    })
    return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
  }

  const loginAs = (email: string | null) => {
    setToken(email ? service.login({ email, password: DEMO_PASSWORD }).token : null)
  }
  setToken(null)
  return loginAs
}

function useDocumentLang() {
  const [lang, setLang] = useState(document.documentElement.lang || 'en')
  useEffect(() => {
    const obs = new MutationObserver(() => setLang(document.documentElement.lang || 'en'))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    setLang(document.documentElement.lang || 'en')
    return () => obs.disconnect()
  }, [])
  return lang
}

function Demo({ loginAs }: { loginAs: (email: string | null) => void }) {
  const [session, setSession] = useState<{ key: number; who: string }>({ key: 0, who: 'visitor' })
  const tx = textFor(useDocumentLang())
  const choose = (who: string, email: string | null) => {
    loginAs(email)
    setSession((s) => ({ key: s.key + 1, who }))
    window.scrollTo({ top: 0 })
  }
  const options: [string, string | null][] = [
    ['visitor', null],
    ['donor', ACCOUNTS.donor],
    ['approved', ACCOUNTS.approved],
    ['pending', ACCOUNTS.pending],
    ['reviewer', ACCOUNTS.reviewer],
    ['admin', ACCOUNTS.admin],
  ]
  return (
    <>
      <aside className="demo-bar" aria-label={tx.title}>
        <div className="demo-inner">
          <p>
            <strong>{tx.title}.</strong> {tx.note}
          </p>
          <div className="demo-row" role="group" aria-label={tx.enter}>
            <span className="demo-label">{tx.enter}</span>
            {options.map(([who, email]) => (
              <button key={who} className={session.who === who ? 'on' : ''} aria-pressed={session.who === who} onClick={() => choose(who, email)}>
                {tx[who]}
              </button>
            ))}
          </div>
        </div>
      </aside>
      <App key={session.key} />
    </>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<p className="demo-loading">{textFor(navigator.language).loading}</p>)
start()
  .then((loginAs) =>
    root.render(
      <StrictMode>
        <Demo loginAs={loginAs} />
      </StrictMode>,
    ),
  )
  .catch((err) => {
    console.error(err)
    root.render(<p className="demo-loading">Erro: {String(err)}</p>)
  })
