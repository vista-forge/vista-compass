/**
 * In-host smoke suite (run by @vscode/test-electron inside the real
 * VSCode): activates the extension against the real data release and
 * drives the hover provider end-to-end — the P3 acceptance's automated
 * core. The visual sidebar walkthrough stays a human check.
 */

import { strict as assert } from 'node:assert';
import * as vscode from 'vscode';

function positionOf(
  doc: vscode.TextDocument,
  needle: string,
  offsetInNeedle: number,
): vscode.Position {
  const idx = doc.getText().indexOf(needle);
  assert.ok(idx >= 0, `fixture contains ${JSON.stringify(needle)}`);
  return doc.positionAt(idx + offsetInNeedle);
}

async function hoverMarkdown(doc: vscode.TextDocument, pos: vscode.Position): Promise<string> {
  const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider',
    doc.uri,
    pos,
  );
  return (hovers ?? [])
    .flatMap((h) => h.contents)
    .map((c) => (typeof c === 'string' ? c : c.value))
    .join('\n');
}

export async function run(): Promise<void> {
  const file = process.env.COMPASS_SMOKE_FILE;
  assert.ok(file, 'COMPASS_SMOKE_FILE set');

  const extension = vscode.extensions.getExtension('vista-forge.vista-compass');
  assert.ok(extension, 'vista-forge.vista-compass present in the host');

  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  await extension.activate();

  // 1. Routine card on a TAG^RTN call site, with the measured-tag badge.
  const routineCard = await hoverMarkdown(doc, positionOf(doc, 'BMES^XPDUTL', 1));
  assert.match(routineCard, /\*\*XPDUTL\*\* — Kernel/, `routine card, got: ${routineCard}`);
  assert.match(routineCard, /Tag `BMES` — found in measured tags/, 'tag badge');

  // 2. Global card on ^PRCA with the FileMan → PIKS join.
  const globalCardMd = await hoverMarkdown(doc, positionOf(doc, '^PRCA(', 2));
  assert.match(
    globalCardMd,
    /\*\*\^PRCA\*\* — referenced by \d+ routines/,
    `global card, got: ${globalCardMd}`,
  );
  assert.match(globalCardMd, /PIKS \*\*/, 'PIKS join present');

  // 3. Tag entry-point card at column 0.
  const tagLine = positionOf(doc, '\n430', 2);
  const tagCard = await hoverMarkdown(doc, tagLine);
  assert.match(tagCard, /\*\*430\^PRCA45PT\*\*/, `tag card, got: ${tagCard}`);

  // ── P4 surfaces ──
  // 4. The documented:/measured: bridge lines on the hover cards.
  assert.match(routineCard, /documented in 107 docs/, 'routine bridge mentions');
  assert.match(globalCardMd, /documented in 15 docs/, 'global bridge mentions');
  assert.match(globalCardMd, /File \*\*430\*\* ACCOUNTS RECEIVABLE/, 'FileMan join');

  // 5. Outline (document symbols): the five wireframe tags.
  const docSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    doc.uri,
  );
  assert.deepEqual(
    (docSymbols ?? []).map((s) => s.name),
    ['PRCA45PT', 'V', 'EN', '430', '433', 'XCLN'],
    'outline tags',
  );

  // 6. Workspace symbols from the measured tag index.
  const wsSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    'vscode.executeWorkspaceSymbolProvider',
    'XCLN',
  );
  assert.ok((wsSymbols ?? []).length > 0, 'workspace symbols non-empty');
  assert.ok(
    (wsSymbols ?? []).some((s) => s.name === 'XCLN^PRCA45PT'),
    'XCLN^PRCA45PT among workspace symbols',
  );

  // 7. Go-to-definition on the BMES^XPDUTL call site.
  const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
    'vscode.executeDefinitionProvider',
    doc.uri,
    positionOf(doc, 'BMES^XPDUTL', 1),
  );
  const definition = (definitions ?? [])[0];
  assert.ok(definition, 'definition resolved');
  assert.match(definition.uri.fsPath, /XPDUTL\.m$/, 'definition lands in XPDUTL.m');
  assert.ok(definition.range.start.line > 0, 'definition points at the BMES tag, not line 1');

  // 8. The P4 + P5 commands are registered.
  const commands = await vscode.commands.getCommands(true);
  for (const id of [
    'vistaCompass.findRpc',
    'vistaCompass.findOption',
    'vistaCompass.packageDashboard',
    'vistaCompass.search',
    'vistaCompass.lookup',
    'vistaCompass.openEntity',
    'vistaCompass.pins',
    'vista.openCitation',
  ]) {
    assert.ok(commands.includes(id), `command registered: ${id}`);
  }

  // ── P5: the twin-link seam, exercised against the REAL Atlas twin ──
  // 9. The twin is present in this host.
  assert.ok(
    vscode.extensions.getExtension('vista-forge.vista-atlas'),
    'vista-forge.vista-atlas installed and enabled',
  );

  // 10. Contract pins: Compass self-declares the Gate-R pair member.
  const pins = (await vscode.commands.executeCommand('vistaCompass.pins')) as {
    tag?: string;
    content_hash?: string;
  };
  assert.equal(pins.tag, 'data-v1', 'pins.tag');
  assert.match(pins.content_hash ?? '', /^23d037f1/, 'pins.content_hash');

  // 11. Hover cards carry the cross-jump + copy-citation command links.
  assert.match(
    routineCard,
    /documented in 107 docs → Atlas\]\(command:vistaCompass.openInAtlas/,
    'atlas cross-jump link',
  );
  assert.match(
    routineCard,
    /\[copy citation\]\(command:vistaCompass.copyCitation/,
    'copy-citation link',
  );

  // 12. vista.openCitation routes a measured citation to the source.
  await vscode.commands.executeCommand('vista.openCitation', {
    text: 'vista-meta data-v1 · code-model/routines.tsv · routine_name=XPDUTL',
  });
  assert.match(
    vscode.window.activeTextEditor?.document.fileName ?? '',
    /XPDUTL\.m$/,
    'citation routed to XPDUTL.m',
  );

  process.stdout.write(
    'SMOKE PASS: P3 hover set, P4 surfaces, P5 twin-link (pins, cross-jump links, citation routing) with the real Atlas twin\n',
  );
}
