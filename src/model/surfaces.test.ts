import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { type Store, openStore } from '../store/engine.ts';
import {
  optionsForRoutine,
  protocolsInvoking,
  rpcsForRoutine,
  searchOptions,
  searchRpcs,
} from './surfaces.ts';

function buildFixture(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE rpcs (
      ien TEXT, name TEXT, tag TEXT, routine_name TEXT, return_type TEXT,
      return_type_label TEXT, availability TEXT, inactive TEXT,
      inactive_label TEXT, version TEXT, package TEXT, package_dir TEXT
    );
    INSERT INTO rpcs (name, tag, routine_name, return_type_label, package) VALUES
      ('ORWPT SELECT', 'SELECT', 'ORWPT', 'SINGLE VALUE', 'Order Entry Results Reporting'),
      ('ORWPT ID INFO', 'IDINFO', 'ORWPT', 'SINGLE VALUE', 'Order Entry Results Reporting'),
      ('XWB IS', 'IS', 'XWBLIB', 'ARRAY', 'RPC Broker');

    CREATE TABLE options (
      ien TEXT, name TEXT, menu_text TEXT, type TEXT, package TEXT,
      routine_raw TEXT, tag TEXT, routine_name TEXT, package_dir TEXT
    );
    INSERT INTO options (name, menu_text, type, tag, routine_name, package) VALUES
      ('PRCAF SUPERVISOR', 'Supervisor Menu', 'menu', NULL, 'PRCA45PT', 'Accounts Receivable'),
      ('XPD INSTALL', 'Install Package', 'run routine', 'EN', 'XPDUTL', 'Kernel');

    CREATE TABLE protocol_calls (
      protocol_name TEXT, protocol_package TEXT, action_kind TEXT,
      callee_tag TEXT, callee_routine TEXT, call_kind TEXT, ref_count INTEGER
    );
    INSERT INTO protocol_calls VALUES
      ('DGPM MOVEMENT EVENTS', 'Registration', 'entry', 'EN', 'PRCA45PT', 'do', 2),
      ('PRCA EVENT', NULL, 'exit', NULL, 'PRCA45PT', 'do', 1),
      ('XU USER TERMINATE', 'Kernel', 'entry', 'X', 'OTHER', 'do', 1);
  `);
  db.close();
}

let dir: string;
let store: Store;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'vista-surfaces-'));
  const dbPath = join(dir, 'meta.db');
  buildFixture(dbPath);
  store = openStore(dbPath);
});

after(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('rpcsForRoutine', () => {
  it('lists RPCs implemented by a routine', () => {
    const rpcs = rpcsForRoutine(store, 'ORWPT');
    assert.deepEqual(
      rpcs.map((r) => r.name),
      ['ORWPT ID INFO', 'ORWPT SELECT'],
    );
    assert.equal(rpcs[1]?.tag, 'SELECT');
    assert.equal(rpcs[1]?.returnType, 'SINGLE VALUE');
  });
  it('empty for a routine with no RPCs', () => {
    assert.deepEqual(rpcsForRoutine(store, 'PRCA45PT'), []);
  });
});

describe('optionsForRoutine', () => {
  it('lists options entering through a routine', () => {
    const options = optionsForRoutine(store, 'PRCA45PT');
    assert.equal(options.length, 1);
    assert.deepEqual(options[0], {
      name: 'PRCAF SUPERVISOR',
      menuText: 'Supervisor Menu',
      type: 'menu',
      tag: undefined,
      routine: 'PRCA45PT',
      package: 'Accounts Receivable',
    });
  });
});

describe('protocolsInvoking', () => {
  it('lists protocols whose actions call into the routine', () => {
    const protocols = protocolsInvoking(store, 'PRCA45PT');
    assert.deepEqual(
      protocols.map((p) => p.name),
      ['DGPM MOVEMENT EVENTS', 'PRCA EVENT'],
    );
    assert.equal(protocols[0]?.actionKind, 'entry');
    assert.equal(protocols[0]?.label, 'EN^PRCA45PT');
    assert.equal(protocols[1]?.label, '^PRCA45PT');
  });
});

describe('searchRpcs / searchOptions (the workspace pickers)', () => {
  it('prefix-matches RPC names case-insensitively, capped', () => {
    assert.deepEqual(
      searchRpcs(store, 'orwpt').map((r) => r.name),
      ['ORWPT ID INFO', 'ORWPT SELECT'],
    );
    assert.equal(searchRpcs(store, 'orwpt', 1).length, 1);
  });
  it('empty prefix lists everything up to the cap', () => {
    assert.equal(searchRpcs(store, '').length, 3);
  });
  it('option search carries the routine for navigation', () => {
    const hits = searchOptions(store, 'XPD');
    assert.equal(hits[0]?.routine, 'XPDUTL');
    assert.equal(hits[0]?.menuText, 'Install Package');
  });
});
