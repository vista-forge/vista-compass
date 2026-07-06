/**
 * The Tier A hover set — a thin vscode adapter: classifyToken decides
 * what the cursor is on, the model layer answers, the tested renderers
 * produce the markdown.
 */

import * as vscode from 'vscode';
import { citationFor } from '../model/citation.js';
import { isRoutine, routineNameFromPath, tagCallers, tagExists } from '../model/lookup.js';
import { classifyToken } from '../model/mumps.js';
import type { BridgeEntityType } from '../model/package.js';
import { fieldPiksForFile, mentionCount } from '../model/package.js';
import type { CardLinks } from '../model/render.js';
import { renderGlobalCard, renderRoutineCard, renderTagCard } from '../model/render.js';
import { analyze, globalCard } from '../model/routine.js';
import type { Store } from '../store/engine.js';
import { atlasPresent } from './twin.js';

function commandUri(command: string, args: readonly unknown[]): string {
  return `command:${command}?${encodeURIComponent(JSON.stringify(args))}`;
}

function cardLinks(store: Store, kind: BridgeEntityType, name: string): CardLinks {
  const entityKey = kind === 'global' ? `^${name}` : name;
  return {
    ...(atlasPresent()
      ? { atlas: commandUri('vistaCompass.openInAtlas', [`${kind}:${entityKey}`, name]) }
      : {}),
    copyCitation: commandUri('vistaCompass.copyCitation', [citationFor(store, kind, name)]),
  };
}

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
          links: cardLinks(store, 'routine', classified.name),
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
            links: cardLinks(store, 'global', classified.name),
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
    if (markdown === undefined) {
      return undefined;
    }
    const rendered = new vscode.MarkdownString(markdown);
    // Command links on the cards are ours alone; scope trust to them.
    rendered.isTrusted = {
      enabledCommands: ['vistaCompass.openInAtlas', 'vistaCompass.copyCitation'],
    };
    return new vscode.Hover(rendered);
  }
}
