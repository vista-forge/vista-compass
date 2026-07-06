/**
 * The routine query layer over meta.db — everything the sidebar and
 * hovers show, as pure Store queries (no vscode imports). Clean-room
 * re-spec of the 0.2.0 cross-join from the internals guide §3/§7.1.
 */

import type { SqlValue, Store } from '../store/engine.js';
import { globalBase } from './mumps.js';

export interface RoutineHeader {
  readonly routineName: string;
  readonly package: string;
  readonly sourcePath: string;
  readonly lineCount: number;
  readonly rpcCount: number;
  readonly optionCount: number;
  readonly inDegree: number;
  readonly outDegree: number;
}

export interface CalleeEdge {
  /** Display label: `TAG^RTN`, or `^RTN` when the call has no tag. */
  readonly label: string;
  readonly tag: string | undefined;
  readonly routine: string;
  readonly kind: string;
  readonly refCount: number;
}

export interface CallerEdge {
  readonly routine: string;
  readonly package: string;
  readonly refCount: number;
}

export type XindexSeverity = 'error' | 'warning' | 'info';

export interface XindexFinding {
  readonly severity: XindexSeverity;
  readonly message: string;
  readonly tagOffset: string;
  /**
   * 1-based line when line_text is numeric. Bug class: line_text holds
   * line NUMBERS as text, but some rows carry source text instead —
   * only numeric values are navigable.
   */
  readonly line: number | undefined;
}

export interface GlobalRef {
  /** BARE global name (bug class: the caret is display-only). */
  readonly name: string;
  readonly refCount: number;
}

export interface RoutineInfo {
  readonly name: string;
  readonly header: RoutineHeader | undefined;
  readonly callers: readonly CallerEdge[];
  readonly callees: readonly CalleeEdge[];
  readonly globals: readonly GlobalRef[];
  readonly xindex: readonly XindexFinding[];
}

function str(value: SqlValue | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function num(value: SqlValue | undefined): number {
  return Number(value ?? 0);
}

function severityOf(message: string): XindexSeverity {
  if (message.startsWith('F ')) {
    return 'error';
  }
  if (message.startsWith('W ')) {
    return 'warning';
  }
  return 'info';
}

/** Everything the sidebar shows for one routine, in one call. */
export function analyze(store: Store, name: string): RoutineInfo {
  const headerRow = store.get(
    `SELECT routine_name, package, source_path, line_count, rpc_count,
            option_count, in_degree, out_degree
       FROM routines_comprehensive WHERE routine_name = ?`,
    name,
  );
  const header: RoutineHeader | undefined =
    headerRow === undefined
      ? undefined
      : {
          routineName: str(headerRow.routine_name),
          package: str(headerRow.package),
          sourcePath: str(headerRow.source_path),
          lineCount: num(headerRow.line_count),
          rpcCount: num(headerRow.rpc_count),
          optionCount: num(headerRow.option_count),
          inDegree: num(headerRow.in_degree),
          outDegree: num(headerRow.out_degree),
        };

  const callers = store
    .all(
      `SELECT caller_routine, caller_package, SUM(ref_count) AS refs
         FROM routine_calls WHERE callee_routine = ?
        GROUP BY caller_routine, caller_package
        ORDER BY refs DESC, caller_routine`,
      name,
    )
    .map((row) => ({
      routine: str(row.caller_routine),
      package: str(row.caller_package),
      refCount: num(row.refs),
    }));

  const callees = store
    .all(
      `SELECT callee_tag, callee_routine, kind, SUM(ref_count) AS refs
         FROM routine_calls WHERE caller_routine = ?
        GROUP BY callee_tag, callee_routine, kind
        ORDER BY refs DESC, callee_routine, callee_tag`,
      name,
    )
    .map((row) => {
      const tag = row.callee_tag === null ? undefined : str(row.callee_tag);
      const routine = str(row.callee_routine);
      return {
        label: tag === undefined ? `^${routine}` : `${tag}^${routine}`,
        tag,
        routine,
        kind: str(row.kind),
        refCount: num(row.refs),
      };
    });

  const globals = store
    .all(
      `SELECT global_name, SUM(ref_count) AS refs
         FROM routine_globals WHERE routine_name = ?
        GROUP BY global_name ORDER BY refs DESC, global_name`,
      name,
    )
    .map((row) => ({ name: str(row.global_name), refCount: num(row.refs) }));

  const xindex = store
    .all(
      `SELECT line_text, tag_offset, error_text
         FROM xindex_errors WHERE routine_name = ? ORDER BY entry_index`,
      name,
    )
    .map((row) => {
      const lineText = str(row.line_text);
      const message = str(row.error_text);
      return {
        severity: severityOf(message),
        message,
        tagOffset: str(row.tag_offset),
        line: /^\d+$/.test(lineText) ? Number(lineText) : undefined,
      };
    });

  return { name, header, callers, callees, globals, xindex };
}

export interface FilePiks {
  readonly cls: string;
  readonly method: string;
  readonly confidence: string;
}

export interface FileCard {
  readonly fileNumber: string;
  readonly fileName: string;
  readonly recordCount: number | undefined;
  readonly piks: FilePiks | undefined;
}

export interface GlobalCard {
  /** BARE global name. */
  readonly name: string;
  readonly routineCount: number;
  readonly totalRefs: number;
  readonly topConsumers: readonly { routine: string; refCount: number }[];
  readonly files: readonly FileCard[];
  /** Files beyond the cap, for an "… N more" overflow line. */
  readonly moreFiles: number;
}

export interface GlobalCardOptions {
  readonly maxFiles?: number;
  readonly maxConsumers?: number;
}

/**
 * The `^GLOBAL` hover: who-references summary + the two-models join —
 * TOP-LEVEL files.tsv rows (parent_file empty) matched on
 * globalBase(global_root), then file_number → piks. The LIKE prefix
 * only narrows; the real match is globalBase (bug class: `^DDE(` must
 * not match `DD`, `^DD("KEY",` must).
 */
export function globalCard(
  store: Store,
  bareName: string,
  options: GlobalCardOptions = {},
): GlobalCard | undefined {
  const maxFiles = options.maxFiles ?? 5;
  const maxConsumers = options.maxConsumers ?? 5;

  const consumers = store
    .all(
      `SELECT routine_name, ref_count FROM routine_globals
        WHERE global_name = ? ORDER BY ref_count DESC, routine_name`,
      bareName,
    )
    .map((row) => ({ routine: str(row.routine_name), refCount: num(row.ref_count) }));

  const fileRows = store
    .all(
      `SELECT file_number, file_name, global_root, record_count
         FROM files
        WHERE parent_file IS NULL AND global_root LIKE '^' || ? || '%'
        ORDER BY file_number`,
      bareName,
    )
    .filter((row) => globalBase(str(row.global_root)) === bareName);

  if (consumers.length === 0 && fileRows.length === 0) {
    return undefined;
  }

  const files = fileRows.slice(0, maxFiles).map((row) => {
    const piksRow = store.get(
      'SELECT piks, piks_method, piks_confidence FROM piks WHERE file_number = ?',
      str(row.file_number),
    );
    return {
      fileNumber: str(row.file_number),
      fileName: str(row.file_name),
      recordCount: row.record_count === null ? undefined : num(row.record_count),
      piks:
        piksRow === undefined
          ? undefined
          : {
              cls: str(piksRow.piks),
              method: str(piksRow.piks_method),
              confidence: str(piksRow.piks_confidence),
            },
    };
  });

  return {
    name: bareName,
    routineCount: consumers.length,
    totalRefs: consumers.reduce((sum, c) => sum + c.refCount, 0),
    topConsumers: consumers.slice(0, maxConsumers),
    files,
    moreFiles: fileRows.length - files.length,
  };
}
