/** Arranque do servidor: `npm run server`. */
import { loadConfig } from './config.ts'
import { createCrypto } from './crypto.ts'
import { openDb } from './db.ts'
import { createApp } from './http.ts'
import { MockKycProvider, MockPaymentProvider } from './providers.ts'
import { createService } from './service.ts'

const config = loadConfig()
if (process.env.NODE_ENV === 'production') {
  // Em produção é obrigatório ligar fornecedores reais (ver providers.ts e docs/legal.md).
  throw new Error('Configure fornecedores reais de pagamento e identidade antes de usar em produção.')
}

const service = createService({
  db: openDb(config.dbPath),
  crypto: createCrypto(config.masterKeyHex),
  config,
  payments: new MockPaymentProvider(),
  kyc: new MockKycProvider(),
})

if (config.adminEmail && config.adminPassword && service.ensureAdmin(config.adminEmail, config.adminPassword)) {
  console.log(`[mao-amiga] conta de administração criada: ${config.adminEmail}`)
}

createApp(service, { allowedOrigins: config.allowedOrigins }).listen(config.port, () => {
  console.log(`[mao-amiga] servidor em http://localhost:${config.port}`)
})
