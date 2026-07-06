/**
 * Language-feature backing: workspace-symbol search over the measured
 * tag index, and the pure source-scanning helpers the definition /
 * reference providers use. The `xindex_tags(tag COLLATE NOCASE)` index
 * published with data-v1 makes the prefix query fast (Track P-vm 3).
 */

import type { Store } from '../store/engine.js';
import { parseTags } from './mumps.js';

export interface TagSymbol {
  readonly tag: string;
  readonly routine: string;
  /** Display label, `TAG^RTN`. */
  readonly label: string;
}

const SYMBOL_CAP = 200;

/** Case-insensitive prefix search over all measured tags (~292k rows). */
export function searchTags(store: Store, prefix: string, cap = SYMBOL_CAP): TagSymbol[] {
  return store
    .all(
      `SELECT routine_name, tag FROM xindex_tags
        WHERE tag LIKE ? || '%' ORDER BY tag, routine_name LIMIT ?`,
      prefix,
      cap,
    )
    .map((row) => {
      const tag = String(row.tag ?? '');
      const routine = String(row.routine_name ?? '');
      return { tag, routine, label: `${tag}^${routine}` };
    });
}

/** 1-based line of a column-0 label in routine source, or undefined. */
export function tagLineInSource(source: string, tag: string): number | undefined {
  return parseTags(source).find((t) => t.tag === tag)?.line;
}

export interface TokenOccurrence {
  /** 1-based line. */
  readonly line: number;
  /** 0-based column of the occurrence start (the tag, not the `$$`). */
  readonly column: number;
}

/**
 * All `TAG^ROUTINE` call sites in a source file (reference provider).
 * Word-bounded on both sides so `BMES^XPDUTLX` never matches XPDUTL.
 */
export function findTokenOccurrences(
  source: string,
  tag: string,
  routine: string,
): TokenOccurrence[] {
  const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escapeRe(tag)}\\^${escapeRe(routine)}(?![A-Za-z0-9])`, 'g');
  const occurrences: TokenOccurrence[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? '';
    for (const match of text.matchAll(re)) {
      // Word-bound the front too: reject when preceded by an ident char.
      const before = match.index === 0 ? '' : text[match.index - 1];
      if (before !== undefined && /[A-Za-z0-9%]/.test(before)) {
        continue;
      }
      occurrences.push({ line: i + 1, column: match.index });
    }
  }
  return occurrences;
}
