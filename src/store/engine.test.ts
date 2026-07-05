import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { openStore } from './engine.ts';

/** Build a small fixture db the way the producer would. */
function buildFixtureDb(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE rpcs (name TEXT PRIMARY KEY, tag TEXT, routine_name TEXT);
    INSERT INTO rpcs VALUES
      ('ORWPT SELECT', 'SELECT', 'ORWPT'),
      ('XWB GET VARIABLE VALUE', 'VARVAL', 'XWBLIB');
    CREATE VIEW v_rpc_names AS SELECT name FROM rpcs;
  `);
  db.close();
}

describe('openStore', () => {
  let dir: string;
  let dbPath: string;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'vista-store-'));
    dbPath = join(dir, 'fixture.db');
    buildFixtureDb(dbPath);
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('opens an existing db and reads rows as objects', () => {
    const store = openStore(dbPath);
    try {
      const rows = store.all('SELECT name, routine_name FROM rpcs ORDER BY name');
      assert.equal(rows.length, 2);
      assert.deepEqual(rows[0], { name: 'ORWPT SELECT', routine_name: 'ORWPT' });
    } finally {
      store.close();
    }
  });

  it('binds positional parameters', () => {
    const store = openStore(dbPath);
    try {
      const row = store.get('SELECT tag FROM rpcs WHERE name = ?', 'ORWPT SELECT');
      assert.deepEqual(row, { tag: 'SELECT' });
    } finally {
      store.close();
    }
  });

  it('get returns undefined when no row matches', () => {
    const store = openStore(dbPath);
    try {
      assert.equal(store.get('SELECT * FROM rpcs WHERE name = ?', 'NOPE'), undefined);
    } finally {
      store.close();
    }
  });

  it('reads views like tables', () => {
    const store = openStore(dbPath);
    try {
      assert.equal(store.all('SELECT * FROM v_rpc_names').length, 2);
    } finally {
      store.close();
    }
  });

  it('is read-only: writes are rejected', () => {
    const store = openStore(dbPath);
    try {
      assert.throws(() => store.all("INSERT INTO rpcs VALUES ('X', 'Y', 'Z') RETURNING name"));
    } finally {
      store.close();
    }
  });

  it('throws a clear error for a missing file', () => {
    const missing = join(dir, 'no-such.db');
    assert.throws(
      () => openStore(missing),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /no-such\.db/);
        return true;
      },
    );
  });

  it('queries after close throw', () => {
    const store = openStore(dbPath);
    store.close();
    assert.throws(() => store.all('SELECT 1 AS one'));
  });
});
