/**
 * The package dashboard (proposal §5) as a pure HTML builder — the
 * per-package situational-awareness guide, materialized. The webview
 * layer only injects the result; everything here is node-testable.
 */

import type { PackageView } from './package.js';

const fmt = new Intl.NumberFormat('en-US');

function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function section(title: string, body: string): string {
  return body === '' ? '' : `<h2>${esc(title)}</h2>\n${body}`;
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) {
    return '';
  }
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = rows
    .map((cells) => `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('\n');
  return `<table><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table>`;
}

/** Self-contained dashboard HTML body (VSCode webview injects CSP/styles). */
export function renderPackageDashboardHtml(view: PackageView): string {
  const parts: string[] = [`<h1>${esc(view.package)}</h1>`];

  if (view.namespace !== undefined) {
    const ns = view.namespace;
    parts.push(
      table(
        ['namespace', 'prefixes', 'app_code', 'vdl_id'],
        [[ns.namespace, ns.prefixes, ns.appCode, ns.vdlId === undefined ? '—' : String(ns.vdlId)]],
      ),
    );
  }

  if (view.manifest !== undefined) {
    const m = view.manifest;
    parts.push(
      section(
        'Measured size',
        table(
          [
            'routines',
            'lines',
            'files shipped',
            'RPC routines',
            'option routines',
            'globals touched',
            'outbound edges',
            'cross-package',
          ],
          [
            [
              fmt.format(m.routineCount),
              fmt.format(m.totalLines),
              fmt.format(m.filesShipped),
              fmt.format(m.rpcRoutines),
              fmt.format(m.optionRoutines),
              fmt.format(m.distinctGlobals),
              fmt.format(m.outboundEdges),
              fmt.format(m.outboundCrossPkg),
            ],
          ],
        ),
      ),
    );
  }

  if (view.piks !== undefined) {
    const piks = view.piks;
    parts.push(
      section(
        'PIKS distribution (shipped files)',
        `<p>P: ${piks.p} · I: ${piks.i} · K: ${piks.k} · S: ${piks.s}` +
          `${piks.unclassified > 0 ? ` · unclassified: ${piks.unclassified}` : ''} · total: ${piks.total}</p>`,
      ),
    );
  }

  const couplingRows = (edges: PackageView['outbound']): string[][] =>
    edges.map((e) => [
      e.otherPackage,
      fmt.format(e.callEdges),
      fmt.format(e.callerRoutines),
      fmt.format(e.calleeRoutines),
    ]);
  parts.push(
    section(
      'Top outbound couplings',
      table(
        ['package', 'call edges', 'caller routines', 'callee routines'],
        couplingRows(view.outbound),
      ),
    ),
    section(
      'Top inbound couplings',
      table(
        ['package', 'call edges', 'caller routines', 'callee routines'],
        couplingRows(view.inbound),
      ),
    ),
    section(
      'Routine leaderboard (by size)',
      table(
        ['routine', 'lines', 'in', 'out'],
        view.topRoutines.map((r) => [
          r.routineName,
          fmt.format(r.lineCount),
          fmt.format(r.inDegree),
          fmt.format(r.outDegree),
        ]),
      ),
    ),
  );

  return parts.filter((p) => p !== '').join('\n');
}
