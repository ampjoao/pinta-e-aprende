/**
 * Substitui server/db.ts na demonstração: a mesma base de dados SQLite, mas a correr no browser
 * (sql.js, versão JavaScript pura) e com a interface do node:sqlite que o serviço espera.
 */
import initSqlJs, { type Database, type SqlValue } from 'sql.js/dist/sql-asm.js'
import { SCHEMA } from '../server/schema.ts'

type Param = string | number | null | Uint8Array

class Statement {
  db: Database
  sql: string
  constructor(db: Database, sql: string) {
    this.db = db
    this.sql = sql
  }
  private rows(params: Param[]) {
    const stmt = this.db.prepare(this.sql)
    try {
      stmt.bind(params as SqlValue[])
      const out: Record<string, unknown>[] = []
      while (stmt.step()) out.push(stmt.getAsObject())
      return out
    } finally {
      stmt.free()
    }
  }
  get(...params: Param[]) {
    return this.rows(params)[0]
  }
  all(...params: Param[]) {
    return this.rows(params)
  }
  run(...params: Param[]) {
    this.rows(params)
    return { changes: this.db.getRowsModified() }
  }
}

export class DemoDatabase {
  db: Database
  constructor(db: Database) {
    this.db = db
  }
  exec(sql: string) {
    this.db.exec(sql)
  }
  prepare(sql: string) {
    return new Statement(this.db, sql)
  }
}

export type Db = DemoDatabase

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null

/** Tem de ser chamado (e esperado) antes de openDb. */
export async function initDemoDb() {
  SQL ??= await initSqlJs()
}

export function openDb(_path: string): Db {
  if (!SQL) throw new Error('initDemoDb() em falta')
  const db = new DemoDatabase(new SQL.Database())
  db.exec(SCHEMA.replace('PRAGMA journal_mode = WAL;', ''))
  return db
}

export function tx<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
