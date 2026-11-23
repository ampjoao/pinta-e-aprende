/**
 * Substitui server/crypto.ts na demonstração: a mesma cifra (AES-256-GCM, HMAC, HKDF, scrypt),
 * feita em JavaScript puro para correr no browser. O scrypt usa um custo mais baixo para a
 * demonstração arrancar depressa.
 */
import { gcm } from '@noble/ciphers/aes'
import { hkdf } from '@noble/hashes/hkdf'
import { hmac } from '@noble/hashes/hmac'
import { scrypt } from '@noble/hashes/scrypt'
import { sha256 as sha256raw } from '@noble/hashes/sha2'
import { bytesToHex } from '@noble/hashes/utils'

export interface Crypto {
  encrypt(plain: string | Buffer): string
  decrypt(token: string): Buffer
  decryptText(token: string): string
  fingerprint(kind: string, value: string): string
}

const enc = new TextEncoder()
const bytes = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n))
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64')
const toBytes = (v: string | Uint8Array) => (typeof v === 'string' ? enc.encode(v) : new Uint8Array(v))

export function createCrypto(masterKeyHex: string): Crypto {
  const master = Buffer.from(masterKeyHex, 'hex')
  const encKey = hkdf(sha256raw, master, new Uint8Array(0), 'gota-a-gota/enc/v1', 32)
  const hmacKey = hkdf(sha256raw, master, new Uint8Array(0), 'gota-a-gota/hmac/v1', 32)
  const decrypt = (token: string) => {
    const [v, iv, tag, data] = token.split('.')
    if (v !== 'v1') throw new Error('Formato de cifra desconhecido')
    const sealed = new Uint8Array([...Buffer.from(data, 'base64'), ...Buffer.from(tag, 'base64')])
    return Buffer.from(gcm(encKey, Buffer.from(iv, 'base64')).decrypt(sealed))
  }
  return {
    encrypt(plain) {
      const iv = bytes(12)
      const sealed = gcm(encKey, iv).encrypt(toBytes(plain))
      return ['v1', b64(iv), b64(sealed.slice(-16)), b64(sealed.slice(0, -16))].join('.')
    },
    decrypt,
    decryptText: (token) => decrypt(token).toString('utf8'),
    fingerprint: (kind, value) => bytesToHex(hmac(sha256raw, hmacKey, enc.encode(`${kind}:${value}`))),
  }
}

const SCRYPT = { N: 1024, r: 8, p: 1, dkLen: 32 }

export function hashPassword(password: string): string {
  const salt = bytes(16)
  return `scrypt$${b64(salt)}$${b64(scrypt(password, salt, SCRYPT))}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  return b64(scrypt(password, Buffer.from(salt, 'base64'), SCRYPT)) === hash
}

export const sha256 = (data: string | Uint8Array) => bytesToHex(sha256raw(toBytes(data)))
const b64url = (u: Uint8Array) => b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const randomToken = () => b64url(bytes(32))
export const randomId = () => b64url(bytes(12))
