/**
 * Contract check for the vista-meta meta.db (proposal §3.2): before any
 * feature reads the db, verify its self-declared pins (meta table) match
 * the pinned release, and that every table/column the ai-manifest
 * catalog declares — plus the join views — actually exists. No hardcoded
 * schemas: the catalog is data, shipped by the producer.
 */

import type { Store } from './engine.js';

/** ai-manifest `tables` subset the check needs: tsv path → columns. */
export interface MetaDbCatalog {
  readonly tables: Readonly<Record<string, { readonly columns: readonly string[] }>>;
}

export interface ContractExpectation {
  /** Release tag the db must self-declare (meta.tag), e.g. "data-v1". */
  readonly tag: string;
  /** Producer content hash (meta.content_hash), when pinned. */
  readonly contentHash?: string;
  /** Catalog of tables/columns to require, from ai-manifest.json. */
  readonly catalog?: MetaDbCatalog;
  /** View names to require; defaults to the published join views. */
  readonly requiredViews?: readonly string[];
}

export interface ContractReport {
  readonly ok: boolean;
  readonly problems: readonly string[];
}

/** The six join views published in meta.db (data-v1). */
export const META_DB_VIEWS: readonly string[] = [
  'v_global_file_piks',
  'v_option_impl',
  'v_package_overview',
  'v_routine_global_piks',
  'v_rpc_data_piks',
  'v_rpc_impl',
];

/** Map a catalog TSV path to its meta.db table name: basename, dashes → underscores. */
export function tsvTableName(tsvPath: string): string {
  const base = tsvPath.split('/').at(-1) ?? tsvPath;
  return base.replace(/\.tsv$/, '').replaceAll('-', '_');
}

/** Check an opened meta.db against the pinned expectation. */
export function checkMetaDb(store: Store, expected: ContractExpectation): ContractReport {
  const problems: string[] = [];

  const meta = new Map<string, string>();
  for (const row of store.all('SELECT key, value FROM meta')) {
    meta.set(String(row.key), String(row.value));
  }
  if (meta.get('tag') !== expected.tag) {
    problems.push(`meta.tag: expected ${expected.tag}, got ${meta.get('tag') ?? '(absent)'}`);
  }
  if (expected.contentHash !== undefined && meta.get('content_hash') !== expected.contentHash) {
    problems.push(
      `meta.content_hash: expected ${expected.contentHash}, got ${meta.get('content_hash') ?? '(absent)'}`,
    );
  }

  const names = (type: 'table' | 'view'): Set<string> =>
    new Set(
      store
        .all('SELECT name FROM sqlite_master WHERE type = ?', type)
        .map((row) => String(row.name)),
    );
  const tables = names('table');
  const views = names('view');

  for (const [tsvPath, spec] of Object.entries(expected.catalog?.tables ?? {})) {
    const table = tsvTableName(tsvPath);
    if (!tables.has(table)) {
      problems.push(`missing table ${table} (${tsvPath})`);
      continue;
    }
    const actualColumns = new Set(
      store.all(`PRAGMA table_info(${JSON.stringify(table)})`).map((row) => String(row.name)),
    );
    for (const column of spec.columns) {
      if (!actualColumns.has(column)) {
        problems.push(`table ${table}: missing column ${column}`);
      }
    }
  }

  for (const view of expected.requiredViews ?? META_DB_VIEWS) {
    if (!views.has(view)) {
      problems.push(`missing view ${view}`);
    }
  }

  return { ok: problems.length === 0, problems };
}
