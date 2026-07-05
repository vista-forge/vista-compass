import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';
import { META_DB_VIEWS, checkMetaDb, tsvTableName } from './contract.ts';
import { type Store, openStore } from './engine.ts';

describe('tsvTableName', () => {
  const cases: ReadonlyArray<{ readonly tsv: string; readonly table: string }> = [
    { tsv: 'code-model/options.tsv', table: 'options' },
    { tsv: 'code-model/routine-calls.tsv', table: 'routine_calls' },
    { tsv: 'data-model/field-piks.tsv', table: 'field_piks' },
    { tsv: 'code-model/vista-file-9-8.tsv', table: 'vista_file_9_8' },
  ];
  for (const tc of cases) {
    it(`${tc.tsv} → ${tc.table}`, () => {
      assert.equal(tsvTableName(tc.tsv), tc.table);
    });
  }
});

/** Fixture meta.db: meta pins + two catalog tables + one view. */
function buildFixture(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO meta VALUES
      ('tag', 'data-v1'),
      ('schema_version', '1'),
      ('content_hash', 'cafe01');
    CREATE TABLE rpcs (name TEXT, tag TEXT, routine_name TEXT);
    CREATE TABLE routine_calls (caller TEXT, callee TEXT);
    CREATE VIEW v_rpc_impl AS SELECT name FROM rpcs;
  `);
  db.close();
}

const CATALOG = {
  tables: {
    'code-model/rpcs.tsv': { columns: ['name', 'tag', 'routine_name'] },
    'code-model/routine-calls.tsv': { columns: ['caller', 'callee'] },
  },
};

describe('checkMetaDb', () => {
  let dir: string;
  let store: Store;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'vista-contract-'));
    const dbPath = join(dir, 'meta.db');
    buildFixture(dbPath);
    store = openStore(dbPath);
  });

  after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes on a conforming db', () => {
    const report = checkMetaDb(store, {
      tag: 'data-v1',
      contentHash: 'cafe01',
      catalog: CATALOG,
      requiredViews: ['v_rpc_impl'],
    });
    assert.deepEqual(report, { ok: true, problems: [] });
  });

  const badCases: ReadonlyArray<{
    readonly name: string;
    readonly expectation: Parameters<typeof checkMetaDb>[1];
    readonly problem: RegExp;
  }> = [
    {
      name: 'tag mismatch',
      expectation: { tag: 'data-v2', catalog: CATALOG, requiredViews: [] },
      problem: /tag/,
    },
    {
      name: 'content_hash mismatch',
      expectation: { tag: 'data-v1', contentHash: 'beef', catalog: CATALOG, requiredViews: [] },
      problem: /content_hash/,
    },
    {
      name: 'missing table',
      expectation: {
        tag: 'data-v1',
        catalog: { tables: { 'code-model/xindex-tags.tsv': { columns: ['tag'] } } },
        requiredViews: [],
      },
      problem: /xindex_tags/,
    },
    {
      name: 'missing column',
      expectation: {
        tag: 'data-v1',
        catalog: { tables: { 'code-model/rpcs.tsv': { columns: ['name', 'formal_list'] } } },
        requiredViews: [],
      },
      problem: /formal_list/,
    },
    {
      name: 'missing view',
      expectation: { tag: 'data-v1', catalog: CATALOG, requiredViews: ['v_package_overview'] },
      problem: /v_package_overview/,
    },
  ];

  for (const tc of badCases) {
    it(`reports ${tc.name}`, () => {
      const report = checkMetaDb(store, tc.expectation);
      assert.equal(report.ok, false);
      assert.ok(
        report.problems.some((p) => tc.problem.test(p)),
        `no problem matching ${tc.problem}: ${JSON.stringify(report.problems)}`,
      );
    });
  }
});

// Integration: the real published meta.db + the producer's ai-manifest,
// when the local checkout has them (skipped elsewhere, e.g. CI).
const REAL_DB = join(
  process.env.VISTA_META_HOME ?? join(process.env.HOME ?? '', 'projects/vista-meta'),
  'dist/vista-meta-data-v1.db',
);
const REAL_MANIFEST = join(
  process.env.VISTA_META_HOME ?? join(process.env.HOME ?? '', 'projects/vista-meta'),
  'vista/export/ai-manifest.json',
);

describe('checkMetaDb against the real data-v1 release', () => {
  it(
    'the published meta.db satisfies the full ai-manifest catalog',
    { skip: !(existsSync(REAL_DB) && existsSync(REAL_MANIFEST)) },
    async () => {
      const { readFileSync } = await import('node:fs');
      const manifest = JSON.parse(readFileSync(REAL_MANIFEST, 'utf8')) as {
        tables: Record<string, { columns: string[] }>;
      };
      const store = openStore(REAL_DB);
      try {
        const report = checkMetaDb(store, {
          tag: 'data-v1',
          contentHash: '23d037f1e08adc206d251eea9adb4ec62051032c06b593737bebfcaf67e4c754',
          catalog: { tables: manifest.tables },
          requiredViews: META_DB_VIEWS,
        });
        assert.deepEqual(report.problems, []);
        assert.equal(report.ok, true);
        assert.equal(Object.keys(manifest.tables).length, 24);
      } finally {
        store.close();
      }
    },
  );
});
