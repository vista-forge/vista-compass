import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { type Store, openStore } from '../store/engine.ts';
import { analyze, globalCard } from './routine.ts';

/** Fixture meta.db slice with the P3 tables. */
function buildFixture(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE routines_comprehensive (
      routine_name TEXT, package TEXT, source_path TEXT, line_count INTEGER,
      rpc_count INTEGER, option_count INTEGER, out_degree INTEGER, in_degree INTEGER
    );
    INSERT INTO routines_comprehensive VALUES
      ('PRCA45PT', 'Accounts Receivable', '/opt/VistA-M/Packages/AR/Routines/PRCA45PT.m', 74, 0, 0, 5, 0),
      ('XPDUTL', 'Kernel', '/opt/VistA-M/Packages/Kernel/Routines/XPDUTL.m', 200, 2, 1, 3, 90);

    CREATE TABLE routine_calls (
      caller_routine TEXT, caller_package TEXT, callee_tag TEXT,
      callee_routine TEXT, kind TEXT, ref_count INTEGER
    );
    INSERT INTO routine_calls VALUES
      ('PRCA45PT', 'Accounts Receivable', 'BMES', 'XPDUTL', 'do', 7),
      ('PRCA45PT', 'Accounts Receivable', 'MES', 'XPDUTL', 'do', 6),
      ('PRCA45PT', 'Accounts Receivable', NULL, 'DIK', 'do', 1),
      ('DGRP', 'Registration', 'BMES', 'XPDUTL', 'do', 3),
      ('DGRP', 'Registration', NULL, 'PRCA45PT', 'do', 2);

    CREATE TABLE routine_globals (
      routine_name TEXT, package TEXT, global_name TEXT, ref_count INTEGER
    );
    -- Bug class: global names are stored BARE (no caret).
    INSERT INTO routine_globals VALUES
      ('PRCA45PT', 'Accounts Receivable', 'PRCA', 18),
      ('DGRP', 'Registration', 'DPT', 40),
      ('XPDUTL', 'Kernel', 'DPT', 2);

    CREATE TABLE xindex_errors (
      routine_name TEXT, entry_index INTEGER, line_text TEXT, tag_offset TEXT, error_text TEXT
    );
    INSERT INTO xindex_errors VALUES
      ('PRCA45PT', 1, '41', '430+5', 'S - Lock missing Timeout.'),
      ('PRCA45PT', 2, 'S PRCA(4)=""', '433+5', 'F - Undefined variable.'),
      ('PRCA45PT', 3, '12', 'EN+1', 'W - Lowercase in routine.');

    CREATE TABLE files (
      file_number TEXT, file_name TEXT, global_root TEXT, parent_file TEXT, record_count INTEGER
    );
    INSERT INTO files VALUES
      ('2', 'PATIENT', '^DPT(', NULL, 1811),
      ('2.01', 'ALIAS SUB-FIELD', '^DPT(', '2', NULL),      -- subfile: excluded
      ('.4', 'PRINT TEMPLATE', '^DIPT(', NULL, 500),
      ('0', 'ATTRIBUTE', '^DD(', NULL, NULL),
      ('.31', 'KEY DEF', '^DD("KEY",', NULL, NULL),          -- same base DD
      ('99', 'DECOY', '^DDE(', NULL, NULL);                  -- LIKE-prefix decoy for DD

    CREATE TABLE piks (
      file_number TEXT, piks TEXT, piks_method TEXT, piks_confidence TEXT
    );
    INSERT INTO piks VALUES
      ('2', 'P', 'H-01', 'certain'),
      ('0', 'S', 'H-02', 'certain');
  `);
  db.close();
}

let dir: string;
let store: Store;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'vista-routine-'));
  const dbPath = join(dir, 'meta.db');
  buildFixture(dbPath);
  store = openStore(dbPath);
});

after(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('analyze', () => {
  it('builds the header from routines_comprehensive', () => {
    const info = analyze(store, 'PRCA45PT');
    assert.deepEqual(info.header, {
      routineName: 'PRCA45PT',
      package: 'Accounts Receivable',
      sourcePath: '/opt/VistA-M/Packages/AR/Routines/PRCA45PT.m',
      lineCount: 74,
      rpcCount: 0,
      optionCount: 0,
      inDegree: 0,
      outDegree: 5,
    });
  });

  it('has no header for a routine not in the model', () => {
    const info = analyze(store, 'NOPE');
    assert.equal(info.header, undefined);
    assert.deepEqual(info.callees, []);
  });

  it('lists callees per (tag, routine) with TAG^RTN labels, sorted by ref-count', () => {
    const { callees } = analyze(store, 'PRCA45PT');
    assert.deepEqual(callees, [
      { label: 'BMES^XPDUTL', tag: 'BMES', routine: 'XPDUTL', kind: 'do', refCount: 7 },
      { label: 'MES^XPDUTL', tag: 'MES', routine: 'XPDUTL', kind: 'do', refCount: 6 },
      { label: '^DIK', tag: undefined, routine: 'DIK', kind: 'do', refCount: 1 },
    ]);
  });

  it('aggregates callers by routine with package and summed ref-counts', () => {
    const { callers } = analyze(store, 'XPDUTL');
    assert.deepEqual(callers, [
      { routine: 'PRCA45PT', package: 'Accounts Receivable', refCount: 13 },
      { routine: 'DGRP', package: 'Registration', refCount: 3 },
    ]);
  });

  it('lists globals with BARE names (bug class: caret is display-only)', () => {
    const { globals } = analyze(store, 'PRCA45PT');
    assert.deepEqual(globals, [{ name: 'PRCA', refCount: 18 }]);
  });

  it('maps xindex severities (F→error, W→warning, rest→info)', () => {
    const { xindex } = analyze(store, 'PRCA45PT');
    assert.deepEqual(
      xindex.map((f) => f.severity),
      ['info', 'error', 'warning'],
    );
  });

  // Bug class: xindex line_text holds line NUMBERS as text — but can
  // also hold source text; only numeric values are navigable lines.
  it('parses numeric line_text as a line and leaves source-text rows without one', () => {
    const { xindex } = analyze(store, 'PRCA45PT');
    assert.equal(xindex[0]?.line, 41);
    assert.equal(xindex[1]?.line, undefined);
    assert.equal(xindex[2]?.line, 12);
    assert.equal(xindex[1]?.message, 'F - Undefined variable.');
    assert.equal(xindex[0]?.tagOffset, '430+5');
  });
});

describe('globalCard', () => {
  it('summarizes who references a bare global and joins files → PIKS', () => {
    const card = globalCard(store, 'DPT');
    assert.ok(card);
    assert.equal(card.name, 'DPT');
    assert.equal(card.routineCount, 2);
    assert.equal(card.totalRefs, 42);
    assert.deepEqual(card.topConsumers[0], { routine: 'DGRP', refCount: 40 });
    // Top-level file only (subfile 2.01 excluded), with its PIKS row.
    assert.deepEqual(card.files, [
      {
        fileNumber: '2',
        fileName: 'PATIENT',
        recordCount: 1811,
        piks: { cls: 'P', method: 'H-01', confidence: 'certain' },
      },
    ]);
    assert.equal(card.moreFiles, 0);
  });

  // Bug class: the files join must use globalBase(global_root), not a
  // LIKE prefix — '^DDE(' must not match DD, '^DD("KEY",' must.
  it('matches files by globalBase, not by name prefix', () => {
    const card = globalCard(store, 'DD');
    assert.ok(card);
    assert.deepEqual(card.files.map((f) => f.fileNumber).sort(), ['.31', '0']);
  });

  it('caps the file list and reports the overflow', () => {
    const card = globalCard(store, 'DD', { maxFiles: 1 });
    assert.ok(card);
    assert.equal(card.files.length, 1);
    assert.equal(card.moreFiles, 1);
  });

  it('returns undefined for a global with no refs and no files', () => {
    assert.equal(globalCard(store, 'NOPE'), undefined);
  });

  it('a file-only global still gets a card (no referencing routines)', () => {
    const card = globalCard(store, 'DIPT');
    assert.ok(card);
    assert.equal(card.routineCount, 0);
    assert.equal(card.files[0]?.fileNumber, '.4');
    assert.equal(card.files[0]?.piks, undefined);
  });
});

// ── Integration against the real published db (skips when absent) ──
const REAL_DB = join(
  process.env.VISTA_META_HOME ?? join(process.env.HOME ?? '', 'projects/vista-meta'),
  'dist/vista-meta-data-v1.db',
);

describe('against the real data-v1 release (guide walkthrough facts)', () => {
  it('PRCA45PT matches the vista-vscode-guide §2 wireframe', { skip: !existsSync(REAL_DB) }, () => {
    const real = openStore(REAL_DB);
    try {
      const info = analyze(real, 'PRCA45PT');
      assert.equal(info.header?.package, 'Accounts Receivable');
      assert.equal(info.header?.lineCount, 74);
      assert.equal(info.header?.inDegree, 0);
      assert.equal(info.header?.outDegree, 5);
      assert.equal(info.callees[0]?.label, 'BMES^XPDUTL');
      assert.equal(info.callees[0]?.refCount, 7);
      assert.deepEqual(info.globals, [{ name: 'PRCA', refCount: 18 }]);
      assert.equal(info.xindex.length, 2);
      assert.deepEqual(
        info.xindex.map((f) => f.line),
        [41, 53],
      );
    } finally {
      real.close();
    }
  });

  it(
    '^DPT resolves to File 2 PATIENT — PIKS P (the 0.2.0 headline hover)',
    { skip: !existsSync(REAL_DB) },
    () => {
      const real = openStore(REAL_DB);
      try {
        const card = globalCard(real, 'DPT');
        assert.ok(card);
        const patient = card.files.find((f) => f.fileNumber === '2');
        assert.ok(patient, 'File 2 in the card');
        assert.equal(patient.fileName, 'PATIENT');
        assert.equal(patient.piks?.cls, 'P');
        assert.ok(card.routineCount > 100, `many consumers, got ${card.routineCount}`);
      } finally {
        real.close();
      }
    },
  );
});
