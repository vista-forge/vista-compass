/**
 * Citation discipline for humans (proposal §3.5): build the EXACT
 * contract line the skills/agents/MCP servers use —
 * `vista-meta <tag> · <tsv path> · <key>=<value>` — preferring the
 * entity bridge's own (tsv, key, value) when the entity is joined.
 * Plus the routine prefix search backing the combined search picker.
 */

import type { Store } from '../store/engine.js';
import type { BridgeEntityType } from './package.js';

const FALLBACK: Record<BridgeEntityType, { tsv: string; key: string }> = {
  routine: { tsv: 'code-model/routines.tsv', key: 'routine_name' },
  rpc: { tsv: 'code-model/rpcs.tsv', key: 'name' },
  option: { tsv: 'code-model/options.tsv', key: 'name' },
  global: { tsv: 'code-model/routine-globals.tsv', key: 'global_name' },
  fileman_file: { tsv: 'data-model/files.tsv', key: 'file_number' },
};

/** The copyable citation line for an entity, per the published format. */
export function citationFor(store: Store, kind: BridgeEntityType, name: string): string {
  const tag = String(store.get("SELECT value FROM meta WHERE key = 'tag'")?.value ?? 'data-v1');
  const entityKey = kind === 'global' && !name.startsWith('^') ? `^${name}` : name;
  const bridged = store.get(
    `SELECT vista_tsv, vista_key_column, vista_key_value FROM entity_bridge
      WHERE entity_id = ? AND vista_tsv IS NOT NULL`,
    `${kind}:${entityKey}`,
  );
  if (bridged !== undefined) {
    return `vista-meta ${tag} · ${String(bridged.vista_tsv)} · ${String(bridged.vista_key_column)}=${String(bridged.vista_key_value)}`;
  }
  const fallback = FALLBACK[kind];
  return `vista-meta ${tag} · ${fallback.tsv} · ${fallback.key}=${name}`;
}

export interface RoutineHit {
  readonly routine: string;
  readonly package: string;
}

const SEARCH_CAP = 200;

/** Prefix search over routine names — the combined search picker. */
export function searchRoutines(store: Store, prefix: string, cap = SEARCH_CAP): RoutineHit[] {
  return store
    .all(
      `SELECT routine_name, package FROM routines_comprehensive
        WHERE routine_name LIKE ? || '%' ORDER BY routine_name LIMIT ?`,
      prefix,
      cap,
    )
    .map((row) => ({
      routine: String(row.routine_name ?? ''),
      package: String(row.package ?? ''),
    }));
}
