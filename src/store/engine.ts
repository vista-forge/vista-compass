/**
 * Thin read-only wrapper over `node:sqlite` — the P0-decided engine
 * (proposal §3.3 / §11). The interface is deliberately small so the
 * documented fallback (better-sqlite3 + platform VSIX) can swap in
 * behind it if the experimental Node API ever regresses.
 */

import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export type SqlValue = null | number | bigint | string | Uint8Array;
export type SqlRow = Record<string, SqlValue>;

export interface Store {
  /** Absolute or relative path this store was opened from. */
  readonly path: string;
  /** Run a query and return every row as a column→value object. */
  all(sql: string, ...params: SqlValue[]): SqlRow[];
  /** Run a query and return the first row, or undefined when none match. */
  get(sql: string, ...params: SqlValue[]): SqlRow | undefined;
  close(): void;
}

/** Open a SQLite database read-only. Throws if the file does not exist. */
export function openStore(path: string): Store {
  if (!existsSync(path)) {
    throw new Error(`openStore: database file not found: ${path}`);
  }
  const db = new DatabaseSync(path, { readOnly: true });
  // node:sqlite returns null-prototype row objects; copy to plain objects so
  // consumers (and deepEqual in tests) see ordinary records.
  return {
    path,
    all(sql, ...params) {
      return (db.prepare(sql).all(...params) as SqlRow[]).map((row) => ({ ...row }));
    },
    get(sql, ...params) {
      const row = db.prepare(sql).get(...params) as SqlRow | undefined;
      return row === undefined ? undefined : { ...row };
    },
    close() {
      db.close();
    },
  };
}
