/** Servidor HTTP sem dependências externas. Todas as respostas são JSON. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { pickLanguage, translate } from './messages.ts'
import { HttpError, type Service, type User } from './service.ts'

type Handler = (ctx: { user: User | null; body: Record<string, unknown>; params: string[]; token?: string }) => unknown

interface Route {
  method: string
  pattern: RegExp
  auth: boolean
  handler: Handler
}

const MAX_BODY_BYTES = 8 * 1024 * 1024 // documentos até 5 MB em base64

/** Limite simples de tentativas por IP (entrar, registar, verificar identidade). */
function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>()
  return (key: string) => {
    const t = Date.now()
    const h = hits.get(key)
    if (!h || h.reset < t) {
      hits.set(key, { count: 1, reset: t + windowMs })
      if (hits.size > 10000) for (const [k, v] of hits) if (v.reset < t) hits.delete(k)
      return true
    }
    h.count++
    return h.count <= limit
  }
}

export function createApp(service: Service, options: { allowedOrigins: string[] }) {
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

  const sensitive = rateLimiter(20, 15 * 60 * 1000)
  const SENSITIVE = new Set(['/api/auth/login', '/api/auth/register', '/api/identity'])

  const send = (res: ServerResponse, status: number, data: unknown) => {
    const body = JSON.stringify(data ?? null)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    })
    res.end(body)
  }

  const readBody = (req: IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      let size = 0
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => {
        size += c.length
        if (size > MAX_BODY_BYTES) {
          reject(new HttpError(413, 'too_large'))
          req.destroy()
        } else chunks.push(c)
      })
      req.on('end', () => {
        if (!chunks.length) return resolve({})
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {})
        } catch {
          reject(new HttpError(400, 'invalid_json'))
        }
      })
      req.on('error', reject)
    })

  return createServer(async (req, res) => {
    const origin = req.headers.origin
    if (origin && options.allowedOrigins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin)
      res.setHeader('vary', 'Origin')
      res.setHeader('access-control-allow-headers', 'authorization, content-type, accept-language')
      res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('access-control-max-age', '600')
    }
    if (req.method === 'OPTIONS') return res.writeHead(204).end()

    try {
      const path = new URL(req.url ?? '/', 'http://x').pathname
      if (SENSITIVE.has(path) && !sensitive(req.socket.remoteAddress ?? '?')) {
        throw new HttpError(429, 'too_many_requests')
      }
      let params: string[] = []
      const route = routes.find((r) => {
        if (r.method !== req.method) return false
        const m = r.pattern.exec(path)
        if (m) params = m.slice(1)
        return Boolean(m)
      })
      if (!route) throw new HttpError(404, 'not_found')
      const auth = req.headers.authorization
      const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined
      const user = service.authenticate(token)
      if (route.auth && !user) throw new HttpError(401, 'session_expired')
      const body = req.method === 'GET' ? {} : await readBody(req)
      const result = await route.handler({ user, body, params, token })
      send(res, 200, result)
    } catch (err) {
      const lang = pickLanguage(req.headers['accept-language'])
      if (err instanceof HttpError) return send(res, err.status, { code: err.code, error: translate(lang, err.code, err.params) })
      console.error('[mao-amiga]', err)
      send(res, 500, { code: 'internal', error: translate(lang, 'internal') })
    }
  })
}
