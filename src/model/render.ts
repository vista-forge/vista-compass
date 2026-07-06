/**
 * Markdown card renderers for the hover set — pure string builders so
 * every card is node-testable; the vscode HoverProvider just wraps the
 * result in a MarkdownString.
 */

import type { CallerEdge, GlobalCard, RoutineInfo } from './routine.js';

export interface RoutineCardOptions {
  readonly topN?: number;
  /** Present when hovering TAG^RTN: the measured-tag badge. */
  readonly tagBadge?: { readonly tag: string; readonly exists: boolean };
}

const fmt = new Intl.NumberFormat('en-US');

/** The routine hover card (internals §7.1, Tier A). */
export function renderRoutineCard(info: RoutineInfo, options: RoutineCardOptions): string {
  const topN = options.topN ?? 5;
  const lines: string[] = [];

  if (info.header === undefined) {
    lines.push(`**${info.name}** — not measured in the data release`);
  } else {
    const h = info.header;
    const badges = [
      h.rpcCount > 0 ? `RPC×${h.rpcCount}` : undefined,
      h.optionCount > 0 ? `OPT×${h.optionCount}` : undefined,
    ].filter((b) => b !== undefined);
    lines.push(`**${h.routineName}** — ${h.package}`);
    lines.push('');
    lines.push(
      [`${h.lineCount} lines · in=${h.inDegree} · out=${h.outDegree}`, ...badges].join(' · '),
    );
  }

  if (options.tagBadge !== undefined) {
    const { tag, exists } = options.tagBadge;
    lines.push('');
    lines.push(`Tag \`${tag}\` — ${exists ? 'found' : 'not found'} in measured tags`);
  }

  if (info.callers.length > 0) {
    lines.push('');
    lines.push(
      `**Top callers:** ${info.callers
        .slice(0, topN)
        .map((c) => `${c.routine} ×${c.refCount}`)
        .join(', ')}`,
    );
  }
  if (info.callees.length > 0) {
    lines.push('');
    lines.push(
      `**Top callees:** ${info.callees
        .slice(0, topN)
        .map((c) => `${c.label} ×${c.refCount}`)
        .join(', ')}`,
    );
  }
  if (info.globals.length > 0) {
    lines.push('');
    lines.push(
      `**Globals:** ${info.globals
        .slice(0, topN)
        .map((g) => `^${g.name} ×${g.refCount}`)
        .join(', ')}`,
    );
  }
  return lines.join('\n');
}

/** The `^GLOBAL` hover card: who-references + FileMan → PIKS join. */
export function renderGlobalCard(card: GlobalCard): string {
  const lines: string[] = [
    `**^${card.name}** — referenced by ${card.routineCount} routines · ${card.totalRefs} refs`,
  ];
  if (card.topConsumers.length > 0) {
    lines.push('');
    lines.push(
      `Top consumers: ${card.topConsumers.map((c) => `${c.routine} ×${c.refCount}`).join(', ')}`,
    );
  }
  for (const file of card.files) {
    const piks =
      file.piks === undefined
        ? ''
        : ` — PIKS **${file.piks.cls}** (${file.piks.method}, ${file.piks.confidence})`;
    const records =
      file.recordCount === undefined ? '' : ` · ${fmt.format(file.recordCount)} records`;
    lines.push('');
    lines.push(`File **${file.fileNumber}** ${file.fileName}${piks}${records}`);
  }
  if (card.moreFiles > 0) {
    lines.push('');
    lines.push(`… ${card.moreFiles} more`);
  }
  return lines.join('\n');
}

/** The tag-at-column-0 hover card: external callers of TAG^ROUTINE. */
export function renderTagCard(
  routine: string,
  tag: string,
  callers: readonly CallerEdge[],
): string {
  const lines: string[] = [`**${tag}^${routine}** — entry point`];
  lines.push('');
  if (callers.length === 0) {
    lines.push('no external callers — likely private');
  } else {
    lines.push(
      `Called externally by: ${callers.map((c) => `${c.routine} ×${c.refCount}`).join(', ')}`,
    );
  }
  return lines.join('\n');
}
