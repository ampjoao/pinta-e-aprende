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
import { SCHEMA } from './schema.ts'

export type Db = DatabaseSync

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
