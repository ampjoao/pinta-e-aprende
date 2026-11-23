/**
 * Rotas da API, sem nada de rede: recebe um pedido já desmontado e devolve estado + JSON.
 * Usado pelo servidor HTTP (http.ts) e pela demonstração que corre no browser (demo/).
 */
import { pickLanguage, translate } from './messages.ts'
import { HttpError, type Service, type User } from './service.ts'

type Handler = (ctx: { user: User | null; body: Record<string, unknown>; params: string[]; token?: string }) => unknown

interface Route {
  method: string
  pattern: RegExp
  auth: boolean
  handler: Handler
}

export interface ApiRequest {
  method: string
  path: string
  authorization?: string
  acceptLanguage?: string
  /** Lê o corpo JSON só quando a rota existe e a sessão é válida. */
  readBody: () => Promise<Record<string, unknown>>
}

export function createRouter(service: Service) {
  const routes: Route[] = []
  const add = (method: string, path: string, auth: boolean, handler: Handler) => {
    const pattern = new RegExp('^' + path.replace(/:[a-zA-Z]+/g, '([A-Za-z0-9_-]+)') + '$')
    routes.push({ method, pattern, auth, handler })
  }
  const u = (ctx: { user: User | null }) => ctx.user as User

  // Público
  add('GET', '/api/health', false, () => ({ ok: true }))
  add('GET', '/api/catalog', false, () => service.catalog())
  add('GET', '/api/stats', false, () => service.stats())
  add('GET', '/api/notes', false, () => service.approvedNotes())
  add('POST', '/api/auth/register', false, ({ body }) => service.register(body))
  add('POST', '/api/auth/login', false, ({ body }) => service.login(body))

  // Conta
  add('POST', '/api/auth/logout', true, ({ token }) => (token && service.logout(token), { ok: true }))
  add('GET', '/api/me', true, (c) => service.me(u(c)))
  add('DELETE', '/api/me', true, (c) => (service.deleteAccount(u(c)), { ok: true }))
  add('POST', '/api/identity', true, (c) => service.verifyIdentity(u(c), c.body))

  // Doador
  add('POST', '/api/donations', true, (c) => service.donate(u(c), c.body))
  add('GET', '/api/donations', true, (c) => service.listDonations(u(c)))

  // Beneficiário
  add('GET', '/api/application', true, (c) => service.getApplication(u(c)))
  add('PUT', '/api/application', true, (c) => service.saveApplication(u(c), c.body))
  add('POST', '/api/application/documents', true, (c) => service.addDocument(u(c), c.body))
  add('DELETE', '/api/application/documents/:id', true, (c) => service.deleteDocument(u(c), c.params[0]))
  add('POST', '/api/application/submit', true, (c) => service.submitApplication(u(c)))
  add('GET', '/api/payouts', true, (c) => service.listPayouts(u(c)))
  add('POST', '/api/thanks', true, (c) => service.submitNote(u(c), c.body))

  // Revisão
  add('GET', '/api/review/queue', true, (c) => service.reviewQueue(u(c)))
  add('GET', '/api/review/applications/:id', true, (c) => service.reviewDetail(u(c), c.params[0]))
  add('POST', '/api/review/applications/:id/vote', true, (c) => service.vote(u(c), c.params[0], c.body))
  add('POST', '/api/review/applications/:id/suspend', true, (c) => service.suspend(u(c), c.params[0], c.body))
  add('GET', '/api/review/documents/:id', true, (c) => service.getDocument(u(c), c.params[0]))
  add('GET', '/api/review/notes', true, (c) => service.pendingNotes(u(c)))
  add('POST', '/api/review/notes/:id', true, (c) => service.moderateNote(u(c), c.params[0], c.body))

  // Administração
  add('POST', '/api/admin/cycles', true, (c) => service.runCycle(u(c)))
  add('GET', '/api/admin/cycles', true, (c) => service.listCycles(u(c)))
  add('POST', '/api/admin/reviewers', true, (c) => service.createReviewer(u(c), c.body))

  return async function dispatch(req: ApiRequest): Promise<{ status: number; data: unknown }> {
    try {
      let params: string[] = []
      const route = routes.find((r) => {
        if (r.method !== req.method) return false
        const m = r.pattern.exec(req.path)
        if (m) params = m.slice(1)
        return Boolean(m)
      })
      if (!route) throw new HttpError(404, 'not_found')
      const token = req.authorization?.startsWith('Bearer ') ? req.authorization.slice(7) : undefined
      const user = service.authenticate(token)
      if (route.auth && !user) throw new HttpError(401, 'session_expired')
      const body = req.method === 'GET' ? {} : await req.readBody()
      return { status: 200, data: (await route.handler({ user, body, params, token })) ?? null }
    } catch (err) {
      const lang = pickLanguage(req.acceptLanguage)
      if (err instanceof HttpError) return { status: err.status, data: { code: err.code, error: translate(lang, err.code, err.params) } }
      console.error('[gota-a-gota]', err)
      return { status: 500, data: { code: 'internal', error: translate(lang, 'internal') } }
    }
  }
}
