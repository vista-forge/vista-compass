import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { openStore, type Store } from '../store/engine.ts';
import { findTokenOccurrences, searchTags, tagLineInSource } from './symbols.ts';

let dir: string;
let store: Store;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'vista-symbols-'));
  const dbPath = join(dir, 'meta.db');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE xindex_tags (routine_name TEXT, tag TEXT, data TEXT);
    INSERT INTO xindex_tags VALUES
      ('XPDUTL', 'BMES', NULL),
      ('XPDUTL', 'MES', NULL),
      ('ORWPT', 'SELECT', NULL),
      ('PRCA45PT', 'EN', NULL),
      ('DGRP', 'EN', NULL);
  `);
  db.close();
  store = openStore(dbPath);
});

after(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('searchTags (workspace symbols)', () => {
  it('prefix-matches tags case-insensitively with TAG^RTN labels', () => {
    const hits = searchTags(store, 'en');
    assert.deepEqual(hits.map((h) => h.label).sort(), ['EN^DGRP', 'EN^PRCA45PT']);
  });
  it('caps results', () => {
    assert.equal(searchTags(store, '', 2).length, 2);
  });
});

describe('tagLineInSource', () => {
  const source = 'PRCA45PT ;header\n V ;indented, not a tag\nEN(X) ;entry\n430 ;numeric\n';
  it('finds the 1-based line of a column-0 tag', () => {
    assert.equal(tagLineInSource(source, 'EN'), 3);
    assert.equal(tagLineInSource(source, '430'), 4);
  });
  it('undefined for a tag that is not a label', () => {
    assert.equal(tagLineInSource(source, 'V'), undefined);
    assert.equal(tagLineInSource(source, 'NOPE'), undefined);
  });
});

describe('findTokenOccurrences', () => {
  const source = [
    'CALLER ;', // 1
    ' D BMES^XPDUTL("x") ; call', // 2
    ' S Y=$$BMES^XPDUTL(1) D MES^XPDUTL', // 3
    ' ; BMES^XPDUTLX is a different routine', // 4
    ' W "BMES^XPDUTL in a string still counts as a ref"', // 5
  ].join('\n');

  it('finds TAG^ROUTINE call sites with 1-based line and 0-based column', () => {
    const hits = findTokenOccurrences(source, 'BMES', 'XPDUTL');
    assert.deepEqual(hits, [
      { line: 2, column: 3 },
      { line: 3, column: 7 },
      { line: 5, column: 4 },
    ]);
  });

  it('does not match a longer routine name (XPDUTLX)', () => {
    const hits = findTokenOccurrences(source, 'BMES', 'XPDUTL');
    assert.ok(hits.every((h) => h.line !== 4));
  });
});
