/**
 * Activation and wiring only (the 0.2.0 discipline): acquire the data
 * release via vista-store (fetch-verify into globalStorage, or a local
 * dataPath override), open it read-only, surface the vintage badge,
 * and register the sidebar + hover providers.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { checkMetaDb } from '../store/contract.js';
import { openStore, type Store } from '../store/engine.js';
import { ensureAsset } from '../store/fetch.js';
import { loadReleaseRecord } from '../store/release.js';
import { registerCommands } from './commands.js';
import { registerDiagnostics } from './diagnostics.js';
import { CompassHoverProvider } from './hover.js';
import {
  CompassDefinitionProvider,
  CompassReferenceProvider,
  CompassWorkspaceSymbolProvider,
  TagDocumentSymbolProvider,
} from './providers.js';
import { RoutineTreeProvider, type TreeConfig } from './treeProvider.js';
import { pinsHandshake, registerTwinLink } from './twin.js';

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
      title: 'VistA Compass: verifying data release…',
    },
    () => ensureAsset({ record, name: DB_ASSET, destDir: context.globalStorageUri.fsPath }),
  );
  if (result.status === 'downloaded') {
    vscode.window.showInformationMessage(
      `VistA Compass: fetched and verified ${DB_ASSET} (${record.tag}).`,
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
      `VistA Compass: data contract mismatch — ${report.problems.join('; ')}`,
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

  // P4: language features, pickers, dashboard, gated diagnostics.
  const selector = [{ language: 'mumps' }, { pattern: '**/*.m' }];
  const getStore = (): Store | undefined => store;
  const getHostRoot = (): string => treeConfig().vistaMHostPath;
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(selector, new TagDocumentSymbolProvider()),
    vscode.languages.registerWorkspaceSymbolProvider(
      new CompassWorkspaceSymbolProvider(getStore, getHostRoot),
    ),
    vscode.languages.registerDefinitionProvider(
      selector,
      new CompassDefinitionProvider(getStore, getHostRoot),
    ),
    vscode.languages.registerReferenceProvider(
      selector,
      new CompassReferenceProvider(getStore, getHostRoot),
    ),
  );
  registerCommands(context, getStore, getHostRoot);
  registerDiagnostics(context, getStore, () => config().get<boolean>('xindexAsDiagnostics', false));

  // Twin-link contract v1 (P5): Compass command surface, URI handler,
  // cross-jump glue, seeded search, copy-citation.
  registerTwinLink(context, {
    getStore,
    getHostRoot,
    findRoutineFor: (kind, key) => {
      if (store === undefined) {
        return undefined;
      }
      const table = kind === 'rpc' ? 'rpcs' : 'options';
      const row = store.get(`SELECT routine_name FROM ${table} WHERE name = ?`, key);
      return row === undefined ? undefined : String(row.routine_name ?? '');
    },
  });

  await openData(context, view);
  setFromEditor(vscode.window.activeTextEditor);

  // Gate-R mutual-pin handshake (§6.1) — after data is open, non-blocking.
  const record = loadReleaseRecord(
    context.asAbsolutePath('contracts/releases/vista-meta-data-v1.json'),
  );
  const meta = new Map(
    (store as Store | undefined)
      ?.all('SELECT key, value FROM meta')
      .map((row) => [String(row.key), String(row.value)]) ?? [],
  );
  void pinsHandshake(record, context.globalStorageUri.fsPath, {
    tag: meta.get('tag') ?? '',
    contentHash: meta.get('content_hash') ?? '',
  });
}

export function deactivate(): void {
  store?.close();
  store = undefined;
}
