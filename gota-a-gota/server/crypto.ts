/**
 * Cifra e pseudonimização. Tudo deriva de uma única chave mestra (MASTER_KEY):
 *  - encKey: cifra AES-256-GCM dos dados pessoais (nome, IBAN, documentos);
 *  - hmacKey: impressões digitais dos identificadores (NIF, IBAN, documentos) para detetar
 *    contas duplicadas sem guardar o valor original de forma legível.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

export interface Crypto {
  encrypt(plain: string | Buffer): string
  decrypt(token: string): Buffer
  decryptText(token: string): string
  fingerprint(kind: string, value: string): string
}

export function createCrypto(masterKeyHex: string): Crypto {
  const master = Buffer.from(masterKeyHex, 'hex')
  const derive = (info: string) => Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), info, 32))
  const encKey = derive('gota-a-gota/enc/v1')
  const hmacKey = derive('gota-a-gota/hmac/v1')

  const decrypt = (token: string) => {
    const [v, iv, tag, data] = token.split('.')
    if (v !== 'v1') throw new Error('Formato de cifra desconhecido')
    const decipher = createDecipheriv('aes-256-gcm', encKey, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()])
  }

  return {
    encrypt(plain) {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', encKey, iv)
      const input = typeof plain === 'string' ? Buffer.from(plain, 'utf8') : plain
      const data = Buffer.concat([cipher.update(input), cipher.final()])
      return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.')
    },
    decrypt,
    decryptText: (token) => decrypt(token).toString('utf8'),
    fingerprint: (kind, value) => createHmac('sha256', hmacKey).update(`${kind}:${value}`).digest('hex'),
  }
}

const SCRYPT = { N: 16384, r: 8, p: 1 }

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64, SCRYPT)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length, SCRYPT)
  return timingSafeEqual(expected, actual)
}

export const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
export const randomToken = () => randomBytes(32).toString('base64url')
export const randomId = () => randomBytes(12).toString('base64url')
