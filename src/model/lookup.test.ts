import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { type Store, openStore } from '../store/engine.ts';
import { isRoutine, resolveSourcePath, tagCallers, tagExists } from './lookup.ts';

function buildFixture(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE routines_comprehensive (routine_name TEXT PRIMARY KEY, package TEXT);
    INSERT INTO routines_comprehensive VALUES ('XPDUTL', 'Kernel'), ('DGRP', 'Registration');
    CREATE TABLE xindex_tags (routine_name TEXT, tag TEXT, data TEXT);
    INSERT INTO xindex_tags VALUES ('XPDUTL', 'BMES', ''), ('XPDUTL', 'MES', '');
    CREATE TABLE routine_calls (
      caller_routine TEXT, caller_package TEXT, callee_tag TEXT,
      callee_routine TEXT, kind TEXT, ref_count INTEGER
    );
    INSERT INTO routine_calls VALUES
      ('PRCA45PT', 'Accounts Receivable', 'BMES', 'XPDUTL', 'do', 7),
      ('DGRP', 'Registration', 'BMES', 'XPDUTL', 'do', 3),
      ('DGRP', 'Registration', 'MES', 'XPDUTL', 'do', 1);
  `);
  db.close();
}

let dir: string;
let store: Store;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'vista-lookup-'));
  const dbPath = join(dir, 'meta.db');
  buildFixture(dbPath);
  store = openStore(dbPath);
});

after(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('isRoutine', () => {
  it('true for a routine in the model', () => {
    assert.equal(isRoutine(store, 'XPDUTL'), true);
  });
  it('false for a global-only name', () => {
    assert.equal(isRoutine(store, 'DPT'), false);
  });
});

describe('tagExists', () => {
  it('finds a measured tag', () => {
    assert.equal(tagExists(store, 'XPDUTL', 'BMES'), true);
  });
  it('rejects an unknown tag', () => {
    assert.equal(tagExists(store, 'XPDUTL', 'NOPE'), false);
  });
});

describe('tagCallers', () => {
  it('lists external callers of TAG^ROUTINE sorted by ref-count', () => {
    assert.deepEqual(tagCallers(store, 'XPDUTL', 'BMES'), [
      { routine: 'PRCA45PT', package: 'Accounts Receivable', refCount: 7 },
      { routine: 'DGRP', package: 'Registration', refCount: 3 },
    ]);
  });
  it('empty for a tag nobody calls', () => {
    assert.deepEqual(tagCallers(store, 'XPDUTL', 'PRIVATE'), []);
  });
});

describe('resolveSourcePath', () => {
  // The bake never sees the host filesystem: source_path is the
  // container-side path; the host mirror lives under vista-m-host/.
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly sourcePath: string;
    readonly hostRoot: string;
    readonly expected: string | undefined;
  }> = [
    {
      name: 'container path maps under the host root',
      sourcePath: '/opt/VistA-M/Packages/Accounts Receivable/Routines/PRCA45PT.m',
      hostRoot: '/home/u/vista-meta/vista/vista-m-host',
      expected:
        '/home/u/vista-meta/vista/vista-m-host/Packages/Accounts Receivable/Routines/PRCA45PT.m',
    },
    {
      name: 'trailing slash on the host root is tolerated',
      sourcePath: '/opt/VistA-M/Packages/Kernel/Routines/XPDUTL.m',
      hostRoot: '/data/host/',
      expected: '/data/host/Packages/Kernel/Routines/XPDUTL.m',
    },
    {
      name: 'a path outside the container root is not mapped',
      sourcePath: '/somewhere/else/X.m',
      hostRoot: '/data/host',
      expected: undefined,
    },
    {
      name: 'empty source path is not mapped',
      sourcePath: '',
      hostRoot: '/data/host',
      expected: undefined,
    },
  ];
  for (const tc of cases) {
    it(tc.name, () => {
      assert.equal(resolveSourcePath(tc.sourcePath, tc.hostRoot), tc.expected);
    });
  }
});
