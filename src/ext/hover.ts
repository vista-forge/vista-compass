/**
 * The Tier A hover set — a thin vscode adapter: classifyToken decides
 * what the cursor is on, the model layer answers, the tested renderers
 * produce the markdown.
 */

import * as vscode from 'vscode';
import { isRoutine, routineNameFromPath, tagCallers, tagExists } from '../model/lookup.js';
import { classifyToken } from '../model/mumps.js';
import { fieldPiksForFile, mentionCount } from '../model/package.js';
import { renderGlobalCard, renderRoutineCard, renderTagCard } from '../model/render.js';
import { analyze, globalCard } from '../model/routine.js';
import type { Store } from '../store/engine.js';

export class CompassHoverProvider implements vscode.HoverProvider {
  constructor(
    private readonly getStore: () => Store | undefined,
    private readonly getTopN: () => number,
  ) {}

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    const store = this.getStore();
    if (store === undefined) {
      return undefined;
    }
    const line = document.lineAt(position.line).text;
    const classified = classifyToken(line, position.character, (name) => isRoutine(store, name));
    if (classified === undefined) {
      return undefined;
    }

    let markdown: string | undefined;
    switch (classified.kind) {
      case 'routine-call': {
        const info = analyze(store, classified.name);
        const tag = classified.token.tag;
        markdown = renderRoutineCard(info, {
          topN: this.getTopN(),
          mentions: mentionCount(store, 'routine', classified.name),
          ...(tag === undefined
            ? {}
            : { tagBadge: { tag, exists: tagExists(store, classified.name, tag) } }),
        });
        break;
      }
      case 'global': {
        const card = globalCard(store, classified.name);
        if (card !== undefined) {
          const fieldPiks = Object.fromEntries(
            card.files.map((file) => [file.fileNumber, fieldPiksForFile(store, file.fileNumber)]),
          );
          markdown = renderGlobalCard(card, {
            mentions: mentionCount(store, 'global', classified.name),
            fieldPiks,
          });
        }
        break;
      }
      case 'tag-def': {
        const routine = routineNameFromPath(document.fileName);
        if (routine !== undefined) {
          markdown = renderTagCard(
            routine,
            classified.name,
            tagCallers(store, routine, classified.name),
          );
        }
        break;
      }
    }
    return markdown === undefined
      ? undefined
      : new vscode.Hover(new vscode.MarkdownString(markdown));
  }
}
