/**
 * Activation and wiring only (the 0.2.0 discipline): acquire the data
 * release via vista-store (fetch-verify into globalStorage, or a local
 * dataPath override), open it read-only, surface the vintage badge,
 * and register the sidebar + hover providers.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { checkMetaDb, ensureAsset, loadReleaseRecord, openStore } from '../index.js';
import type { Store } from '../store/engine.js';
import { CompassHoverProvider } from './hover.js';
import { RoutineTreeProvider, type TreeConfig } from './treeProvider.js';

const DB_ASSET = 'vista-meta-data-v1.db';

let store: Store | undefined;

function config(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('vistaCompass');
}

function treeConfig(): TreeConfig {
  return {
    topN: config().get<number>('topN', 15),
    vistaMHostPath: expandHome(config().get<string>('vistaMHostPath', '')),
  };
}

function expandHome(path: string): string {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

async function acquireDbPath(context: vscode.ExtensionContext): Promise<string> {
  const override = expandHome(config().get<string>('dataPath', ''));
  if (override !== '') {
    return override;
  }
  const record = loadReleaseRecord(
    context.asAbsolutePath('contracts/releases/vista-meta-data-v1.json'),
  );
  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: 'Vista Compass: verifying data release…',
    },
    () => ensureAsset({ record, name: DB_ASSET, destDir: context.globalStorageUri.fsPath }),
  );
  if (result.status === 'downloaded') {
    vscode.window.showInformationMessage(
      `Vista Compass: fetched and verified ${DB_ASSET} (${record.tag}).`,
    );
  }
  return result.path;
}

async function openData(
  context: vscode.ExtensionContext,
  view: vscode.TreeView<unknown>,
): Promise<void> {
  const record = loadReleaseRecord(
    context.asAbsolutePath('contracts/releases/vista-meta-data-v1.json'),
  );
  const dbPath = await acquireDbPath(context);
  store?.close();
  store = openStore(dbPath);

  const report = checkMetaDb(store, {
    tag: record.tag,
    ...(record.content_hash === undefined ? {} : { contentHash: record.content_hash }),
  });
  const meta = new Map(
    store.all('SELECT key, value FROM meta').map((row) => [String(row.key), String(row.value)]),
  );
  const hash = meta.get('content_hash') ?? '';
  view.description = `${meta.get('tag') ?? 'unknown'} · ${hash.slice(0, 8)}`;
  if (!report.ok) {
    vscode.window.showWarningMessage(
      `Vista Compass: data contract mismatch — ${report.problems.join('; ')}`,
    );
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const provider = new RoutineTreeProvider(() => store, treeConfig);
  const view = vscode.window.createTreeView('vistaCompassRoutine', {
    treeDataProvider: provider,
  });
  context.subscriptions.push(view);

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      [{ language: 'mumps' }, { pattern: '**/*.m' }],
      new CompassHoverProvider(
        () => store,
        () => treeConfig().topN,
      ),
    ),
  );

  const setFromEditor = (editor: vscode.TextEditor | undefined): void => {
    if (editor?.document.fileName.endsWith('.m')) {
      provider.setActiveFile(editor.document.fileName);
    }
  };
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(setFromEditor));

  context.subscriptions.push(
    vscode.commands.registerCommand('vistaCompass.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('vistaCompass.reloadData', async () => {
      await openData(context, view);
      provider.refresh();
    }),
  );

  await openData(context, view);
  setFromEditor(vscode.window.activeTextEditor);
}

export function deactivate(): void {
  store?.close();
  store = undefined;
}
