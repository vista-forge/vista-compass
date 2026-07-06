import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { openStore, type Store } from '../store/engine.ts';
import { fieldPiksForFile, listPackages, mentionCount, packageOverview } from './package.ts';

function buildFixture(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE package_namespace (
      package TEXT, package_name TEXT, namespace TEXT, prefixes TEXT, app_code TEXT, vdl_id INTEGER
    );
    INSERT INTO package_namespace VALUES
      ('Accounts Receivable', 'ACCOUNTS RECEIVABLE', 'PRCA', 'PRCA,PRY,RC', 'PRCA', 29);

    CREATE TABLE package_manifest (
      package TEXT, routine_count INTEGER, total_lines INTEGER, files_shipped INTEGER,
      p_files INTEGER, i_files INTEGER, k_files INTEGER, s_files INTEGER,
      rpc_routines INTEGER, option_routines INTEGER, distinct_globals_touched INTEGER,
      outbound_edges INTEGER, outbound_cross_pkg INTEGER
    );
    INSERT INTO package_manifest VALUES
      ('Accounts Receivable', 431, 90000, 40, 4, 6, 2, 28, 3, 55, 60, 900, 300);

    CREATE TABLE package_piks_summary (
      package TEXT, p_files INTEGER, i_files INTEGER, k_files INTEGER, s_files INTEGER,
      unclassified INTEGER, total_distinct_files INTEGER
    );
    INSERT INTO package_piks_summary VALUES ('Accounts Receivable', 4, 6, 2, 28, 0, 40);

    CREATE TABLE package_edge_matrix (
      source_package TEXT, dest_package TEXT, call_edges INTEGER,
      distinct_caller_routines INTEGER, distinct_callee_routines INTEGER
    );
    INSERT INTO package_edge_matrix VALUES
      ('Accounts Receivable', 'Kernel', 500, 200, 40),
      ('Accounts Receivable', 'VA FileMan', 300, 150, 20),
      ('Integrated Billing', 'Accounts Receivable', 250, 90, 30);

    CREATE TABLE routines_comprehensive (
      routine_name TEXT, package TEXT, line_count INTEGER, in_degree INTEGER, out_degree INTEGER
    );
    INSERT INTO routines_comprehensive VALUES
      ('PRCA45PT', 'Accounts Receivable', 74, 0, 5),
      ('PRCABIG', 'Accounts Receivable', 900, 40, 12),
      ('XPDUTL', 'Kernel', 200, 90, 3);

    CREATE TABLE packages (
      package TEXT, routine_count INTEGER, percent_routine_count INTEGER,
      total_lines INTEGER, total_bytes INTEGER
    );
    INSERT INTO packages VALUES
      ('Accounts Receivable', 431, 0, 90000, 3000000),
      ('Kernel', 800, 12, 200000, 7000000);

    CREATE TABLE entity_bridge (
      entity_id TEXT, entity_type TEXT, canonical_name TEXT, mention_count INTEGER,
      vista_tsv TEXT, vista_key_column TEXT, vista_key_value TEXT,
      join_method TEXT, join_confidence TEXT
    );
    INSERT INTO entity_bridge (entity_id, entity_type, canonical_name, mention_count) VALUES
      ('routine:XPDUTL', 'routine', 'XPDUTL', 42),
      ('global:^DPT', 'global', '^DPT', 120),
      ('rpc:ORWPT SELECT', 'rpc', 'ORWPT SELECT', 7);

    CREATE TABLE field_piks (
      file_number TEXT, field_number TEXT, field_name TEXT, data_type TEXT,
      file_piks TEXT, pointer_target TEXT, ref_piks TEXT, cross_piks TEXT, sensitivity_flag TEXT
    );
    INSERT INTO field_piks VALUES
      ('2', '.01', 'NAME', 'FREE TEXT', 'P', NULL, NULL, NULL, 'Y'),
      ('2', '.104', 'PROVIDER', 'POINTER', 'P', '200', 'S', 'P->S', NULL);
  `);
  db.close();
}

let dir: string;
let store: Store;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'vista-package-'));
  const dbPath = join(dir, 'meta.db');
  buildFixture(dbPath);
  store = openStore(dbPath);
});

after(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('packageOverview', () => {
  it('assembles namespace, manifest, PIKS mix, couplings, and leaderboard', () => {
    const view = packageOverview(store, 'Accounts Receivable');
    assert.ok(view);
    assert.equal(view.namespace?.namespace, 'PRCA');
    assert.equal(view.namespace?.appCode, 'PRCA');
    assert.equal(view.namespace?.vdlId, 29);
    assert.equal(view.manifest?.routineCount, 431);
    assert.deepEqual(view.piks, { p: 4, i: 6, k: 2, s: 28, unclassified: 0, total: 40 });
    // Couplings both directions, busiest first.
    assert.deepEqual(
      view.outbound.map((e) => e.otherPackage),
      ['Kernel', 'VA FileMan'],
    );
    assert.deepEqual(
      view.inbound.map((e) => e.otherPackage),
      ['Integrated Billing'],
    );
    assert.equal(view.outbound[0]?.callEdges, 500);
    // Leaderboard: biggest routines first.
    assert.deepEqual(
      view.topRoutines.map((r) => r.routineName),
      ['PRCABIG', 'PRCA45PT'],
    );
  });

  it('undefined for an unknown package', () => {
    assert.equal(packageOverview(store, 'Not A Package'), undefined);
  });
});

describe('listPackages', () => {
  it('lists package names with routine counts, largest first', () => {
    assert.deepEqual(listPackages(store), [
      { package: 'Kernel', routineCount: 800 },
      { package: 'Accounts Receivable', routineCount: 431 },
    ]);
  });
});

describe('mentionCount (the documented:/measured: bridge)', () => {
  it('finds routine mentions by bare name', () => {
    assert.equal(mentionCount(store, 'routine', 'XPDUTL'), 42);
  });
  // Bug-class variant: bridge global entity ids KEEP the caret
  // (global:^DPT) while the measured model stores bare names.
  it('finds global mentions from the BARE name (id carries the caret)', () => {
    assert.equal(mentionCount(store, 'global', 'DPT'), 120);
  });
  it('zero when the entity is not in the bridge', () => {
    assert.equal(mentionCount(store, 'routine', 'NOPE'), 0);
  });
});

describe('fieldPiksForFile', () => {
  it('lists field-level PIKS with cross-PIKS pointer flags', () => {
    const fields = fieldPiksForFile(store, '2');
    assert.equal(fields.length, 2);
    assert.deepEqual(fields[1], {
      fieldNumber: '.104',
      fieldName: 'PROVIDER',
      dataType: 'POINTER',
      pointerTarget: '200',
      refPiks: 'S',
      crossPiks: 'P->S',
      sensitive: false,
    });
    assert.equal(fields[0]?.sensitive, true);
  });
  it('empty for a file with no field rows', () => {
    assert.deepEqual(fieldPiksForFile(store, '999'), []);
  });
});
