import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { openStore, type Store } from '../store/engine.ts';
import { citationFor, searchRoutines } from './citation.ts';

function buildFixture(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE meta (key TEXT, value TEXT);
    INSERT INTO meta VALUES ('tag', 'data-v1');
    CREATE TABLE entity_bridge (
      entity_id TEXT, entity_type TEXT, canonical_name TEXT, mention_count INTEGER,
      vista_tsv TEXT, vista_key_column TEXT, vista_key_value TEXT,
      join_method TEXT, join_confidence TEXT
    );
    INSERT INTO entity_bridge VALUES
      ('rpc:ORWPT SELECT', 'rpc', 'ORWPT SELECT', 7,
       'code-model/rpcs.tsv', 'name', 'ORWPT SELECT', 'exact', '1.0'),
      ('global:^DPT', 'global', '^DPT', 120, NULL, NULL, NULL, NULL, NULL);
    CREATE TABLE routines_comprehensive (
      routine_name TEXT, package TEXT, line_count INTEGER
    );
    INSERT INTO routines_comprehensive VALUES
      ('PRCA45PT', 'Accounts Receivable', 74),
      ('PRCABIG', 'Accounts Receivable', 900),
      ('XPDUTL', 'Kernel', 200);
  `);
  db.close();
}

let dir: string;
let store: Store;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'vista-citation-'));
  const dbPath = join(dir, 'meta.db');
  buildFixture(dbPath);
  store = openStore(dbPath);
});

after(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('citationFor (the contract citation line)', () => {
  it('prefers the bridge row (tsv · key=value) when the entity is joined', () => {
    assert.equal(
      citationFor(store, 'rpc', 'ORWPT SELECT'),
      'vista-meta data-v1 · code-model/rpcs.tsv · name=ORWPT SELECT',
    );
  });

  it('falls back per kind when the bridge has no join (routine)', () => {
    assert.equal(
      citationFor(store, 'routine', 'PRCA45PT'),
      'vista-meta data-v1 · code-model/routines.tsv · routine_name=PRCA45PT',
    );
  });

  it('global fallback uses the BARE name against routine-globals', () => {
    assert.equal(
      citationFor(store, 'global', 'DPT'),
      'vista-meta data-v1 · code-model/routine-globals.tsv · global_name=DPT',
    );
  });

  it('option fallback', () => {
    assert.equal(
      citationFor(store, 'option', 'XPD INSTALL'),
      'vista-meta data-v1 · code-model/options.tsv · name=XPD INSTALL',
    );
  });
});

describe('searchRoutines', () => {
  it('prefix-matches routine names with package labels, capped', () => {
    assert.deepEqual(searchRoutines(store, 'PRCA'), [
      { routine: 'PRCA45PT', package: 'Accounts Receivable' },
      { routine: 'PRCABIG', package: 'Accounts Receivable' },
    ]);
    assert.equal(searchRoutines(store, 'PRCA', 1).length, 1);
  });
  it('empty for no match', () => {
    assert.deepEqual(searchRoutines(store, 'ZZZZ'), []);
  });
});
