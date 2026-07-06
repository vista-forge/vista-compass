/**
 * P4 commands: the workspace-wide RPC / option pickers and the package
 * dashboard webview. Thin adapters over the tested model layer.
 */

import * as vscode from 'vscode';
import { renderPackageDashboardHtml } from '../model/dashboard.js';
import { routineNameFromPath } from '../model/lookup.js';
import { listPackages, packageOverview } from '../model/package.js';
import { analyze } from '../model/routine.js';
import { searchOptions, searchRpcs } from '../model/surfaces.js';
import type { Store } from '../store/engine.js';
import { routineLocation } from './nav.js';

interface RoutineItem extends vscode.QuickPickItem {
  readonly routine: string;
  readonly tag: string | undefined;
}

async function openPicked(store: Store, hostRoot: string, item: RoutineItem): Promise<void> {
  const location = routineLocation(store, item.routine, item.tag, hostRoot);
  if (location === undefined) {
    vscode.window.showInformationMessage(
      `VistA Compass: no host source for ${item.routine} — set vistaCompass.vistaMHostPath.`,
    );
    return;
  }
  await vscode.window.showTextDocument(location.uri, { selection: location.range });
}

async function runPicker(
  store: Store,
  hostRoot: string,
  placeholder: string,
  search: (prefix: string) => RoutineItem[],
): Promise<void> {
  const picker = vscode.window.createQuickPick<RoutineItem>();
  picker.placeholder = placeholder;
  picker.matchOnDescription = true;
  picker.items = search('');
  picker.onDidChangeValue((value) => {
    picker.items = search(value.toUpperCase());
  });
  picker.onDidAccept(async () => {
    const item = picker.selectedItems[0];
    picker.hide();
    if (item !== undefined) {
      await openPicked(store, hostRoot, item);
    }
  });
  picker.onDidHide(() => picker.dispose());
  picker.show();
}

export function registerCommands(
  context: vscode.ExtensionContext,
  getStore: () => Store | undefined,
  getHostRoot: () => string,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('vistaCompass.findRpc', async () => {
      const store = getStore();
      if (store === undefined) {
        return;
      }
      await runPicker(store, getHostRoot(), 'Find RPC by name prefix…', (prefix) =>
        searchRpcs(store, prefix).map((rpc) => ({
          label: rpc.name,
          description: `${rpc.tag === undefined ? '^' : `${rpc.tag}^`}${rpc.routine} · ${rpc.returnType}`,
          detail: rpc.package,
          routine: rpc.routine,
          tag: rpc.tag,
        })),
      );
    }),

    vscode.commands.registerCommand('vistaCompass.findOption', async () => {
      const store = getStore();
      if (store === undefined) {
        return;
      }
      await runPicker(store, getHostRoot(), 'Find option by name prefix…', (prefix) =>
        searchOptions(store, prefix).map((option) => ({
          label: option.name,
          description: `${option.menuText} · ${option.type}`,
          detail: option.package,
          routine: option.routine,
          tag: option.tag,
        })),
      );
    }),

    vscode.commands.registerCommand('vistaCompass.packageDashboard', async () => {
      const store = getStore();
      if (store === undefined) {
        return;
      }
      // Default to the active routine's package; fall back to a picker.
      const activePath = vscode.window.activeTextEditor?.document.fileName;
      const activeRoutine =
        activePath?.endsWith('.m') === true ? routineNameFromPath(activePath) : undefined;
      const activePackage =
        activeRoutine === undefined ? undefined : analyze(store, activeRoutine).header?.package;

      let pkg = activePackage;
      if (pkg === undefined) {
        const picked = await vscode.window.showQuickPick(
          listPackages(store).map((p) => ({
            label: p.package,
            description: `${p.routineCount} routines`,
          })),
          { placeHolder: 'Package dashboard for…' },
        );
        pkg = picked?.label;
      }
      if (pkg === undefined) {
        return;
      }
      const view = packageOverview(store, pkg);
      if (view === undefined) {
        vscode.window.showInformationMessage(`VistA Compass: no measured data for ${pkg}.`);
        return;
      }
      const panel = vscode.window.createWebviewPanel(
        'vistaCompassPackage',
        `Package: ${pkg}`,
        vscode.ViewColumn.Beside,
        { enableScripts: false },
      );
      panel.webview.html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: var(--vscode-font-family); padding: 1em 2em; }
  table { border-collapse: collapse; margin: 0.5em 0 1em; }
  th, td { border: 1px solid var(--vscode-panel-border); padding: 4px 10px; text-align: left; }
  th { background: var(--vscode-editor-inactiveSelectionBackground); }
  h1 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 0.3em; }
</style></head><body>
${renderPackageDashboardHtml(view)}
</body></html>`;
    }),
  );
}
