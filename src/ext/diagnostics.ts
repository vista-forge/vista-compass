/**
 * XINDEX findings as editor diagnostics (P4.3) — gated behind
 * vistaCompass.xindexAsDiagnostics, default off until the bake is
 * stable enough to avoid noise (internals §7.3). Only numeric-line
 * findings are mappable (the line_text bug class).
 */

import * as vscode from 'vscode';
import { routineNameFromPath } from '../model/lookup.js';
import { type XindexSeverity, analyze } from '../model/routine.js';
import type { Store } from '../store/engine.js';

const SEVERITY: Record<XindexSeverity, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

export function registerDiagnostics(
  context: vscode.ExtensionContext,
  getStore: () => Store | undefined,
  isEnabled: () => boolean,
): void {
  const collection = vscode.languages.createDiagnosticCollection('vista-compass-xindex');
  context.subscriptions.push(collection);

  const refresh = (document: vscode.TextDocument): void => {
    if (!document.fileName.endsWith('.m')) {
      return;
    }
    if (!isEnabled()) {
      collection.delete(document.uri);
      return;
    }
    const store = getStore();
    const routine = routineNameFromPath(document.fileName);
    if (store === undefined || routine === undefined) {
      return;
    }
    const diagnostics = analyze(store, routine)
      .xindex.filter((f) => f.line !== undefined)
      .map((f) => {
        const line = Math.max(0, (f.line ?? 1) - 1);
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(line, 0, line, 999),
          `${f.message} (${f.tagOffset})`,
          SEVERITY[f.severity],
        );
        diagnostic.source = 'vista-compass xindex';
        return diagnostic;
      });
    collection.set(document.uri, diagnostics);
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor !== undefined) {
        refresh(editor.document);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('vistaCompass.xindexAsDiagnostics')) {
        if (!isEnabled()) {
          collection.clear();
        } else if (vscode.window.activeTextEditor !== undefined) {
          refresh(vscode.window.activeTextEditor.document);
        }
      }
    }),
  );
  if (vscode.window.activeTextEditor !== undefined) {
    refresh(vscode.window.activeTextEditor.document);
  }
}
