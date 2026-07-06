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

  process.stdout.write(
    'SMOKE PASS: activation + routine/global/tag hovers against the real release\n',
  );
}
