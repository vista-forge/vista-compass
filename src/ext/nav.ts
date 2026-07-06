/**
 * Navigation helpers shared by the sidebar, pickers, and language
 * providers: measured routine → host file location.
 */

import { readFileSync } from 'node:fs';
import * as vscode from 'vscode';
import { resolveSourcePath, routineSourcePath } from '../model/lookup.js';
import { tagLineInSource } from '../model/symbols.js';
import type { Store } from '../store/engine.js';

/** Host-visible path of a measured routine, or undefined. */
export function hostPathForRoutine(
  store: Store,
  routine: string,
  hostRoot: string,
): string | undefined {
  if (hostRoot === '') {
    return undefined;
  }
  const source = routineSourcePath(store, routine);
  return source === undefined ? undefined : resolveSourcePath(source, hostRoot);
}

/** Location of TAG^ROUTINE (or the routine top when the tag is unknown). */
export function routineLocation(
  store: Store,
  routine: string,
  tag: string | undefined,
  hostRoot: string,
): vscode.Location | undefined {
  const path = hostPathForRoutine(store, routine, hostRoot);
  if (path === undefined) {
    return undefined;
  }
  let line = 1;
  if (tag !== undefined) {
    try {
      line = tagLineInSource(readFileSync(path, 'utf8'), tag) ?? 1;
    } catch {
      return undefined;
    }
  }
  return new vscode.Location(vscode.Uri.file(path), new vscode.Position(line - 1, 0));
}
