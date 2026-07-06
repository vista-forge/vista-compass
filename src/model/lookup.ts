/**
 * Small membership/location lookups the hover and navigation need —
 * pure Store queries plus the container→host source-path mapping.
 */

import type { Store } from '../store/engine.js';
import type { CallerEdge } from './routine.js';

/** Membership test driving routine-vs-global token disambiguation. */
export function isRoutine(store: Store, name: string): boolean {
  return (
    store.get('SELECT 1 AS one FROM routines_comprehensive WHERE routine_name = ?', name) !==
    undefined
  );
}

/** Does TAG^ROUTINE exist in the measured tag index? */
export function tagExists(store: Store, routine: string, tag: string): boolean {
  return (
    store.get(
      'SELECT 1 AS one FROM xindex_tags WHERE routine_name = ? AND tag = ?',
      routine,
      tag,
    ) !== undefined
  );
}

/** External callers of TAG^ROUTINE, aggregated, busiest first. */
export function tagCallers(store: Store, routine: string, tag: string): CallerEdge[] {
  return store
    .all(
      `SELECT caller_routine, caller_package, SUM(ref_count) AS refs
         FROM routine_calls WHERE callee_routine = ? AND callee_tag = ?
        GROUP BY caller_routine, caller_package
        ORDER BY refs DESC, caller_routine`,
      routine,
      tag,
    )
    .map((row) => ({
      routine: String(row.caller_routine ?? ''),
      package: String(row.caller_package ?? ''),
      refCount: Number(row.refs ?? 0),
    }));
}

const CONTAINER_ROOT = '/opt/VistA-M/';

/**
 * Map a container-side source_path (`/opt/VistA-M/…`) to the
 * host-visible mirror under vista-m-host. The bake never sees the host
 * filesystem; this mapping bridges the two. Undefined when the path is
 * not under the container root.
 */
export function resolveSourcePath(sourcePath: string, hostRoot: string): string | undefined {
  if (!sourcePath.startsWith(CONTAINER_ROOT)) {
    return undefined;
  }
  const relative = sourcePath.slice(CONTAINER_ROOT.length);
  const root = hostRoot.endsWith('/') ? hostRoot.slice(0, -1) : hostRoot;
  return `${root}/${relative}`;
}

/** Routine name from an editor path: basename minus `.m`, or undefined. */
export function routineNameFromPath(path: string): string | undefined {
  const base = path.split('/').at(-1) ?? path;
  return base.endsWith('.m') ? base.slice(0, -2) : undefined;
}

/** Container-side source_path of a measured routine, for navigation. */
export function routineSourcePath(store: Store, name: string): string | undefined {
  const row = store.get(
    'SELECT source_path FROM routines_comprehensive WHERE routine_name = ?',
    name,
  );
  return row === undefined ? undefined : String(row.source_path ?? '');
}
