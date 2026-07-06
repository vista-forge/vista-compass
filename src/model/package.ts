/**
 * Package-level queries (the dashboard, proposal §5), the entity-bridge
 * mention counts (the documented:/measured: human affordance), and the
 * field-level PIKS drill-down — pure Store queries.
 */

import type { SqlValue, Store } from '../store/engine.js';

function str(value: SqlValue | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function num(value: SqlValue | undefined): number {
  return Number(value ?? 0);
}

function opt(value: SqlValue | undefined): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

export interface PackageNamespaceInfo {
  readonly packageName: string;
  readonly namespace: string;
  readonly prefixes: string;
  readonly appCode: string;
  readonly vdlId: number | undefined;
}

export interface PackageManifestInfo {
  readonly routineCount: number;
  readonly totalLines: number;
  readonly filesShipped: number;
  readonly rpcRoutines: number;
  readonly optionRoutines: number;
  readonly distinctGlobals: number;
  readonly outboundEdges: number;
  readonly outboundCrossPkg: number;
}

export interface PiksMix {
  readonly p: number;
  readonly i: number;
  readonly k: number;
  readonly s: number;
  readonly unclassified: number;
  readonly total: number;
}

export interface PackageCoupling {
  readonly otherPackage: string;
  readonly callEdges: number;
  readonly callerRoutines: number;
  readonly calleeRoutines: number;
}

export interface RoutineLeader {
  readonly routineName: string;
  readonly lineCount: number;
  readonly inDegree: number;
  readonly outDegree: number;
}

export interface PackageView {
  readonly package: string;
  readonly namespace: PackageNamespaceInfo | undefined;
  readonly manifest: PackageManifestInfo | undefined;
  readonly piks: PiksMix | undefined;
  readonly outbound: readonly PackageCoupling[];
  readonly inbound: readonly PackageCoupling[];
  readonly topRoutines: readonly RoutineLeader[];
}

const TOP_COUPLINGS = 10;
const TOP_ROUTINES = 15;

/** Everything the package dashboard shows, in one call. */
export function packageOverview(store: Store, pkg: string): PackageView | undefined {
  const ns = store.get(
    `SELECT package_name, namespace, prefixes, app_code, vdl_id
       FROM package_namespace WHERE package = ?`,
    pkg,
  );
  const manifest = store.get(
    `SELECT routine_count, total_lines, files_shipped, rpc_routines, option_routines,
            distinct_globals_touched, outbound_edges, outbound_cross_pkg
       FROM package_manifest WHERE package = ?`,
    pkg,
  );
  const piks = store.get(
    `SELECT p_files, i_files, k_files, s_files, unclassified, total_distinct_files
       FROM package_piks_summary WHERE package = ?`,
    pkg,
  );
  if (ns === undefined && manifest === undefined && piks === undefined) {
    return undefined;
  }

  const coupling = (direction: 'source_package' | 'dest_package'): PackageCoupling[] => {
    const other = direction === 'source_package' ? 'dest_package' : 'source_package';
    return store
      .all(
        `SELECT ${other} AS other_package, call_edges,
                distinct_caller_routines, distinct_callee_routines
           FROM package_edge_matrix WHERE ${direction} = ?
          ORDER BY call_edges DESC LIMIT ?`,
        pkg,
        TOP_COUPLINGS,
      )
      .map((row) => ({
        otherPackage: str(row.other_package),
        callEdges: num(row.call_edges),
        callerRoutines: num(row.distinct_caller_routines),
        calleeRoutines: num(row.distinct_callee_routines),
      }));
  };

  const topRoutines = store
    .all(
      `SELECT routine_name, line_count, in_degree, out_degree
         FROM routines_comprehensive WHERE package = ?
        ORDER BY line_count DESC LIMIT ?`,
      pkg,
      TOP_ROUTINES,
    )
    .map((row) => ({
      routineName: str(row.routine_name),
      lineCount: num(row.line_count),
      inDegree: num(row.in_degree),
      outDegree: num(row.out_degree),
    }));

  return {
    package: pkg,
    namespace:
      ns === undefined
        ? undefined
        : {
            packageName: str(ns.package_name),
            namespace: str(ns.namespace),
            prefixes: str(ns.prefixes),
            appCode: str(ns.app_code),
            vdlId: ns.vdl_id === null ? undefined : num(ns.vdl_id),
          },
    manifest:
      manifest === undefined
        ? undefined
        : {
            routineCount: num(manifest.routine_count),
            totalLines: num(manifest.total_lines),
            filesShipped: num(manifest.files_shipped),
            rpcRoutines: num(manifest.rpc_routines),
            optionRoutines: num(manifest.option_routines),
            distinctGlobals: num(manifest.distinct_globals_touched),
            outboundEdges: num(manifest.outbound_edges),
            outboundCrossPkg: num(manifest.outbound_cross_pkg),
          },
    piks:
      piks === undefined
        ? undefined
        : {
            p: num(piks.p_files),
            i: num(piks.i_files),
            k: num(piks.k_files),
            s: num(piks.s_files),
            unclassified: num(piks.unclassified),
            total: num(piks.total_distinct_files),
          },
    outbound: coupling('source_package'),
    inbound: coupling('dest_package'),
    topRoutines,
  };
}

/** All packages, largest first — the dashboard picker. */
export function listPackages(store: Store): { package: string; routineCount: number }[] {
  return store
    .all('SELECT package, routine_count FROM packages ORDER BY routine_count DESC, package')
    .map((row) => ({ package: str(row.package), routineCount: num(row.routine_count) }));
}

export type BridgeEntityType = 'routine' | 'rpc' | 'global' | 'option' | 'fileman_file';

/**
 * "documented in N docs": mention_count from the entity bridge.
 * Bug-class variant: bridge GLOBAL entity ids keep the caret
 * (`global:^DPT`) while the measured model stores bare names — callers
 * always pass the bare name; the caret is added here.
 */
export function mentionCount(store: Store, type: BridgeEntityType, name: string): number {
  const key = type === 'global' && !name.startsWith('^') ? `^${name}` : name;
  const row = store.get(
    'SELECT mention_count FROM entity_bridge WHERE entity_id = ?',
    `${type}:${key}`,
  );
  return row === undefined ? 0 : num(row.mention_count);
}

export interface FieldPiks {
  readonly fieldNumber: string;
  readonly fieldName: string;
  readonly dataType: string;
  readonly pointerTarget: string | undefined;
  readonly refPiks: string | undefined;
  readonly crossPiks: string | undefined;
  readonly sensitive: boolean;
}

/** Field-level PIKS rows for a file — the file-hover drill-down. */
export function fieldPiksForFile(store: Store, fileNumber: string): FieldPiks[] {
  return store
    .all(
      `SELECT field_number, field_name, data_type, pointer_target,
              ref_piks, cross_piks, sensitivity_flag
         FROM field_piks WHERE file_number = ? ORDER BY CAST(field_number AS REAL)`,
      fileNumber,
    )
    .map((row) => ({
      fieldNumber: str(row.field_number),
      fieldName: str(row.field_name),
      dataType: str(row.data_type),
      pointerTarget: opt(row.pointer_target),
      refPiks: opt(row.ref_piks),
      crossPiks: opt(row.cross_piks),
      sensitive: str(row.sensitivity_flag) === 'Y',
    }));
}
