/** Servidor HTTP sem dependências externas. Todas as respostas são JSON. As rotas estão em router.ts. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { pickLanguage, translate } from './messages.ts'
import { createRouter } from './router.ts'
import { HttpError, type Service } from './service.ts'

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

const send = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })
  res.end(JSON.stringify(data ?? null))
}

export function createApp(service: Service, options: { allowedOrigins: string[] }) {
  const dispatch = createRouter(service)
  const sensitive = rateLimiter(20, 15 * 60 * 1000)
  const SENSITIVE = new Set(['/api/auth/login', '/api/auth/register', '/api/identity'])

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

    const path = new URL(req.url ?? '/', 'http://x').pathname
    if (SENSITIVE.has(path) && !sensitive(req.socket.remoteAddress ?? '?')) {
      return send(res, 429, { code: 'too_many_requests', error: translate(pickLanguage(req.headers['accept-language']), 'too_many_requests') })
    }
    const { status, data } = await dispatch({
      method: req.method ?? 'GET',
      path,
      authorization: req.headers.authorization,
      acceptLanguage: req.headers['accept-language'],
      readBody: () => readBody(req),
    })
    send(res, status, data)
  })
}
