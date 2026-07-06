/**
 * P4 first-class surfaces: RPCs, options, and protocols — per-routine
 * sections and the workspace-wide picker queries (proposal §5), as
 * pure Store queries.
 */

import type { SqlValue, Store } from '../store/engine.js';

function str(value: SqlValue | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function opt(value: SqlValue | undefined): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

export interface RpcEntry {
  readonly name: string;
  readonly tag: string | undefined;
  readonly routine: string;
  readonly returnType: string;
  readonly package: string;
}

export interface OptionEntry {
  readonly name: string;
  readonly menuText: string;
  readonly type: string;
  readonly tag: string | undefined;
  readonly routine: string;
  readonly package: string;
}

export interface ProtocolInvocation {
  readonly name: string;
  readonly package: string | undefined;
  readonly actionKind: string;
  /** The invoked entry point, `TAG^RTN` or `^RTN`. */
  readonly label: string;
  readonly refCount: number;
}

function rpcFromRow(row: Record<string, SqlValue | undefined>): RpcEntry {
  return {
    name: str(row.name),
    tag: opt(row.tag),
    routine: str(row.routine_name),
    returnType: str(row.return_type_label),
    package: str(row.package),
  };
}

function optionFromRow(row: Record<string, SqlValue | undefined>): OptionEntry {
  return {
    name: str(row.name),
    menuText: str(row.menu_text),
    type: str(row.type),
    tag: opt(row.tag),
    routine: str(row.routine_name),
    package: str(row.package),
  };
}

/** RPCs whose broker entry point lives in this routine. */
export function rpcsForRoutine(store: Store, routine: string): RpcEntry[] {
  return store
    .all(
      `SELECT name, tag, routine_name, return_type_label, package
         FROM rpcs WHERE routine_name = ? ORDER BY name`,
      routine,
    )
    .map(rpcFromRow);
}

/** Options whose entry action runs through this routine. */
export function optionsForRoutine(store: Store, routine: string): OptionEntry[] {
  return store
    .all(
      `SELECT name, menu_text, type, tag, routine_name, package
         FROM options WHERE routine_name = ? ORDER BY name`,
      routine,
    )
    .map(optionFromRow);
}

/** Protocols with an entry/exit action calling into this routine. */
export function protocolsInvoking(store: Store, routine: string): ProtocolInvocation[] {
  return store
    .all(
      `SELECT protocol_name, protocol_package, action_kind, callee_tag, ref_count
         FROM protocol_calls WHERE callee_routine = ?
        ORDER BY ref_count DESC, protocol_name`,
      routine,
    )
    .map((row) => {
      const tag = opt(row.callee_tag);
      return {
        name: str(row.protocol_name),
        package: opt(row.protocol_package),
        actionKind: str(row.action_kind),
        label: tag === undefined ? `^${routine}` : `${tag}^${routine}`,
        refCount: Number(row.ref_count ?? 0),
      };
    });
}

const PICKER_CAP = 200;

/** Prefix search over RPC names — the "find RPC" picker (indexed). */
export function searchRpcs(store: Store, prefix: string, cap = PICKER_CAP): RpcEntry[] {
  return store
    .all(
      `SELECT name, tag, routine_name, return_type_label, package
         FROM rpcs WHERE name LIKE ? || '%' ORDER BY name LIMIT ?`,
      prefix,
      cap,
    )
    .map(rpcFromRow);
}

/** Prefix search over option names — the "find option" picker. */
export function searchOptions(store: Store, prefix: string, cap = PICKER_CAP): OptionEntry[] {
  return store
    .all(
      `SELECT name, menu_text, type, tag, routine_name, package
         FROM options WHERE name LIKE ? || '%' ORDER BY name LIMIT ?`,
      prefix,
      cap,
    )
    .map(optionFromRow);
}
