/**
 * Language providers (P4.2): outline symbols, workspace symbols over
 * the measured tag index, go-to-definition and find-references from
 * the measured call graph. Thin adapters over the tested model layer.
 */

import { readFileSync } from 'node:fs';
import * as vscode from 'vscode';
import { isRoutine, routineNameFromPath, tagCallers } from '../model/lookup.js';
import { classifyToken, parseTags } from '../model/mumps.js';
import { findTokenOccurrences, searchTags } from '../model/symbols.js';
import type { Store } from '../store/engine.js';
import { hostPathForRoutine, routineLocation } from './nav.js';

export class TagDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    return parseTags(document.getText()).map((t) => {
      const range = document.lineAt(t.line - 1).range;
      return new vscode.DocumentSymbol(t.tag, '', vscode.SymbolKind.Function, range, range);
    });
  }
}

export class CompassWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
  constructor(
    private readonly getStore: () => Store | undefined,
    private readonly getHostRoot: () => string,
  ) {}

  provideWorkspaceSymbols(query: string): vscode.SymbolInformation[] {
    const store = this.getStore();
    const hostRoot = this.getHostRoot();
    if (store === undefined || hostRoot === '' || query === '') {
      return [];
    }
    const symbols: vscode.SymbolInformation[] = [];
    for (const hit of searchTags(store, query)) {
      const path = hostPathForRoutine(store, hit.routine, hostRoot);
      if (path === undefined) {
        continue;
      }
      symbols.push(
        new vscode.SymbolInformation(
          hit.label,
          vscode.SymbolKind.Function,
          '',
          new vscode.Location(vscode.Uri.file(path), new vscode.Position(0, 0)),
        ),
      );
    }
    return symbols;
  }
}

export class CompassDefinitionProvider implements vscode.DefinitionProvider {
  constructor(
    private readonly getStore: () => Store | undefined,
    private readonly getHostRoot: () => string,
  ) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location | undefined {
    const store = this.getStore();
    if (store === undefined) {
      return undefined;
    }
    const line = document.lineAt(position.line).text;
    const classified = classifyToken(line, position.character, (name) => isRoutine(store, name));
    if (classified?.kind !== 'routine-call') {
      return undefined;
    }
    return routineLocation(store, classified.name, classified.token.tag, this.getHostRoot());
  }
}

const REFERENCE_CALLER_CAP = 50;

export class CompassReferenceProvider implements vscode.ReferenceProvider {
  constructor(
    private readonly getStore: () => Store | undefined,
    private readonly getHostRoot: () => string,
  ) {}

  provideReferences(document: vscode.TextDocument, position: vscode.Position): vscode.Location[] {
    const store = this.getStore();
    const routine = routineNameFromPath(document.fileName);
    if (store === undefined || routine === undefined) {
      return [];
    }
    const line = document.lineAt(position.line).text;
    const classified = classifyToken(line, position.character, (name) => isRoutine(store, name));
    if (classified?.kind !== 'tag-def') {
      return [];
    }
    const tag = classified.name;
    const locations: vscode.Location[] = [];
    for (const caller of tagCallers(store, routine, tag).slice(0, REFERENCE_CALLER_CAP)) {
      const path = hostPathForRoutine(store, caller.routine, this.getHostRoot());
      if (path === undefined) {
        continue;
      }
      let source: string;
      try {
        source = readFileSync(path, 'utf8');
      } catch {
        continue;
      }
      for (const occurrence of findTokenOccurrences(source, tag, routine)) {
        locations.push(
          new vscode.Location(
            vscode.Uri.file(path),
            new vscode.Position(occurrence.line - 1, occurrence.column),
          ),
        );
      }
    }
    return locations;
  }
}
