/**
 * Base de dados (SQLite incluído no Node.js).
 *
 * Regra de ouro do anonimato: NÃO existe nenhuma tabela nem coluna que ligue uma doação a um
 * pagamento. As doações entram num fundo comum (tabela donations) e os pagamentos saem desse
 * fundo (tabela payouts). Nem a própria plataforma consegue dizer "o dinheiro do doador X foi
 * para o beneficiário Y", porque essa ligação nunca é criada.
 */
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type Db = DatabaseSync

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('donor','beneficiary','reviewer','admin')),
  suspended INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

-- Identidade verificada (obrigatória por lei: prevenção de branqueamento de capitais).
-- O nome fica cifrado; o NIF só existe como impressão digital (HMAC) para impedir contas duplicadas.
CREATE TABLE IF NOT EXISTS identities (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legal_name_enc TEXT NOT NULL,
  nif_fp TEXT NOT NULL UNIQUE,
  birth_date_enc TEXT NOT NULL,
  provider_ref TEXT NOT NULL,
  verified_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('draft','pending','approved','rejected','suspended','expired')),
  household_adults INTEGER,
  household_children INTEGER,
  monthly_income_cents INTEGER,
  monthly_expenses_cents INTEGER,
  category TEXT,
  description TEXT,
  requested_cents INTEGER,
  iban_enc TEXT,
  iban_fp TEXT,
  decision_note TEXT,
  created_at INTEGER NOT NULL,
  submitted_at INTEGER,
  decided_at INTEGER,
  valid_until INTEGER
);
CREATE INDEX IF NOT EXISTS applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS applications_status ON applications(status);

-- Documentos de prova, cifrados. São apagados assim que o pedido é decidido (minimização de dados).
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  content_fp TEXT NOT NULL,
  data_enc TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
-- Impressões digitais de documentos já usados: detetam o mesmo ficheiro em contas diferentes.
CREATE TABLE IF NOT EXISTS document_fingerprints (
  content_fp TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (content_fp, user_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject')),
  note TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (application_id, reviewer_id)
);

-- Entradas no fundo comum. cycle_id indica em que ciclo a doação foi contada, nada mais.
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  donor_id TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  provider_ref TEXT NOT NULL,
  cycle_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cycles (
  id TEXT PRIMARY KEY,
  run_at INTEGER NOT NULL,
  pool_cents INTEGER NOT NULL,
  distributed_cents INTEGER NOT NULL,
  donor_count INTEGER NOT NULL,
  beneficiary_count INTEGER NOT NULL
);

-- Saídas do fundo comum. Não têm qualquer referência a doadores ou doações.
CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL REFERENCES cycles(id),
  beneficiary_id TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL CHECK (status IN ('pending','sent','failed')),
  provider_ref TEXT,
  created_at INTEGER NOT NULL
);

-- Mensagens de agradecimento à comunidade (moderadas, publicadas sem autor).
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  created_at INTEGER NOT NULL
);

-- Registo de quem consultou ou decidiu o quê (obrigatório para auditoria).
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  created_at INTEGER NOT NULL
);
`

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec(SCHEMA)
  return db
}

/** Corre uma função dentro de uma transação. */
export function tx<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
