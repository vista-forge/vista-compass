/**
 * The twin-link seam, Compass side (proposal §6.1, contract v1):
 * Compass's own command surface + URI handler, the soft cross-jump
 * into VistA Atlas (presence-checked, degrades to Atlas search while
 * Atlas's entity tier is pending), the Gate-R mutual-pin handshake,
 * and copy-citation. The ID crosses the boundary, never the data.
 */

import { readFileSync } from 'node:fs';
import * as vscode from 'vscode';
import { citationFor, searchRoutines } from '../model/citation.js';
import { routineNameFromPath } from '../model/lookup.js';
import type { BridgeEntityType } from '../model/package.js';
import { globalCard } from '../model/routine.js';
import { searchOptions, searchRpcs } from '../model/surfaces.js';
import { searchTags } from '../model/symbols.js';
import type { Store } from '../store/engine.js';
import { ensureAsset } from '../store/fetch.js';
import type { ReleaseRecord } from '../store/release.js';
import { loadTwinLinkContract, parseCitation, parseDeepLink } from '../twinlink.js';
import { routineLocation } from './nav.js';

const ATLAS_ID = 'vista-forge.vista-atlas';
const BRIDGE_META_ASSET = 'entity-bridge.meta.json';

export function atlasPresent(): boolean {
  return vscode.extensions.getExtension(ATLAS_ID) !== undefined;
}

async function atlasCommand(): Promise<(command: string, payload: unknown) => Thenable<unknown>> {
  const atlas = vscode.extensions.getExtension(ATLAS_ID);
  if (atlas === undefined) {
    throw new Error('VistA Atlas is not installed');
  }
  await atlas.activate();
  return (command, payload) => vscode.commands.executeCommand(command, payload);
}

/** Cross-jump: openEntity when Atlas ships it, else seeded doc search. */
export async function openInAtlas(entityId: string, query: string): Promise<void> {
  if (!atlasPresent()) {
    vscode.window.showInformationMessage(
      'VistA Compass: install the VistA Atlas twin to jump into the documentation.',
    );
    return;
  }
  const run = await atlasCommand();
  const commands = await vscode.commands.getCommands(true);
  if (commands.includes('vistaAtlas.openEntity')) {
    await run('vistaAtlas.openEntity', { entity_id: entityId });
  } else {
    await run('vistaAtlas.search', { query });
  }
}

interface BridgePins {
  readonly vdocs?: { readonly tag?: string; readonly corpus_content_hash?: string };
  readonly vista_meta?: { readonly tag?: string; readonly content_hash?: string };
}

/**
 * Gate-R mutual-pin handshake: the bridge meta's pin pair is the
 * authority; warn when either side's live data disagrees with it.
 */
export async function pinsHandshake(
  record: ReleaseRecord,
  destDir: string,
  ownPins: { tag: string; contentHash: string },
): Promise<void> {
  let bridgePins: BridgePins;
  try {
    const asset = await ensureAsset({ record, name: BRIDGE_META_ASSET, destDir });
    bridgePins = (JSON.parse(readFileSync(asset.path, 'utf8')) as { pins?: BridgePins }).pins ?? {};
  } catch {
    return; // no bridge spec available — nothing to check against
  }
  const problems: string[] = [];
  const expectedMeta = bridgePins.vista_meta;
  if (expectedMeta?.tag !== undefined && expectedMeta.tag !== ownPins.tag) {
    problems.push(`own data ${ownPins.tag} vs bridge pin ${expectedMeta.tag}`);
  }
  if (
    expectedMeta?.content_hash !== undefined &&
    expectedMeta.content_hash !== ownPins.contentHash
  ) {
    problems.push('own content_hash differs from the bridge pin');
  }
  if (atlasPresent()) {
    try {
      const run = await atlasCommand();
      const atlasPins = (await run('vistaAtlas.pins', undefined)) as
        | { tag?: string; corpus_content_hash?: string }
        | undefined;
      const expectedDocs = bridgePins.vdocs;
      if (
        atlasPins?.tag !== undefined &&
        expectedDocs?.tag !== undefined &&
        atlasPins.tag !== expectedDocs.tag
      ) {
        problems.push(`Atlas corpus ${atlasPins.tag} vs bridge pin ${expectedDocs.tag}`);
      }
      if (
        atlasPins?.corpus_content_hash !== undefined &&
        expectedDocs?.corpus_content_hash !== undefined &&
        atlasPins.corpus_content_hash !== expectedDocs.corpus_content_hash
      ) {
        problems.push('Atlas corpus_content_hash differs from the bridge pin');
      }
    } catch {
      // Atlas present but pins unavailable — not a drift signal.
    }
  }
  if (problems.length > 0) {
    vscode.window.showWarningMessage(
      `VistA Compass: release-pair drift — ${problems.join('; ')}. Cross-links may mislead.`,
    );
  }
}

const TSV_TO_KIND: Record<string, BridgeEntityType> = {
  'code-model/routines.tsv': 'routine',
  'code-model/routines-comprehensive.tsv': 'routine',
  'code-model/rpcs.tsv': 'rpc',
  'code-model/options.tsv': 'option',
  'code-model/routine-globals.tsv': 'global',
  'data-model/files.tsv': 'fileman_file',
};

export interface TwinDeps {
  readonly getStore: () => Store | undefined;
  readonly getHostRoot: () => string;
  readonly findRoutineFor: (kind: BridgeEntityType, key: string) => string | undefined;
}

async function lookupEntity(deps: TwinDeps, kind: BridgeEntityType, key: string): Promise<void> {
  const store = deps.getStore();
  if (store === undefined) {
    return;
  }
  if (kind === 'routine' || kind === 'rpc' || kind === 'option') {
    const routine = kind === 'routine' ? key : deps.findRoutineFor(kind, key);
    const location =
      routine === undefined
        ? undefined
        : routineLocation(store, routine, undefined, deps.getHostRoot());
    if (location !== undefined) {
      await vscode.window.showTextDocument(location.uri, { selection: location.range });
      return;
    }
  }
  if (kind === 'global') {
    const bare = key.startsWith('^') ? key.slice(1) : key;
    const card = globalCard(store, bare);
    const files = (card?.files ?? [])
      .map((f) => `File ${f.fileNumber} ${f.fileName}${f.piks ? ` — PIKS ${f.piks.cls}` : ''}`)
      .join(' · ');
    vscode.window.showInformationMessage(
      `^${bare}: ${card?.routineCount ?? 0} routines · ${card?.totalRefs ?? 0} refs${files ? ` · ${files}` : ''}`,
    );
    return;
  }
  vscode.window.showInformationMessage(
    `VistA Compass: ${citationFor(store, kind, key)} (no navigable source for this kind)`,
  );
}

/** Register the contract-v1 surface + the internal glue commands. */
export function registerTwinLink(context: vscode.ExtensionContext, deps: TwinDeps): void {
  const contract = loadTwinLinkContract(context.asAbsolutePath('contracts/twin-link.v1.json'));

  const searchPicker = async (query: string): Promise<void> => {
    const store = deps.getStore();
    if (store === undefined) {
      return;
    }
    interface Item extends vscode.QuickPickItem {
      readonly action: () => Promise<void>;
    }
    const picker = vscode.window.createQuickPick<Item>();
    picker.placeholder = 'Search the measured model (routines, tags, RPCs, options)…';
    picker.value = query;
    const build = (value: string): Item[] => {
      const prefix = value.toUpperCase();
      const items: Item[] = [];
      if (prefix !== '') {
        items.push(
          ...searchRoutines(store, prefix, 20).map((hit) => ({
            label: `$(symbol-class) ${hit.routine}`,
            description: hit.package,
            action: () => lookupEntity(deps, 'routine', hit.routine),
          })),
          ...searchTags(store, prefix, 20).map((hit) => ({
            label: `$(symbol-function) ${hit.label}`,
            description: 'tag',
            action: () => lookupEntity(deps, 'routine', hit.routine),
          })),
          ...searchRpcs(store, prefix, 20).map((rpc) => ({
            label: `$(remote) ${rpc.name}`,
            description: rpc.routine,
            action: () => lookupEntity(deps, 'rpc', rpc.name),
          })),
          ...searchOptions(store, prefix, 20).map((option) => ({
            label: `$(menu) ${option.name}`,
            description: option.menuText,
            action: () => lookupEntity(deps, 'option', option.name),
          })),
        );
      }
      if (atlasPresent() && value !== '') {
        // The §6.1 seeded search handoff: one footer row to the twin.
        items.push({
          label: `$(book) Search docs for "${value}" → VistA Atlas`,
          description: 'documented:',
          action: async () => {
            const run = await atlasCommand();
            await run('vistaAtlas.search', { query: value });
          },
        });
      }
      return items;
    };
    picker.items = build(query);
    picker.onDidChangeValue((value) => {
      picker.items = build(value);
    });
    picker.onDidAccept(async () => {
      const item = picker.selectedItems[0];
      picker.hide();
      await item?.action();
    });
    picker.onDidHide(() => picker.dispose());
    picker.show();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('vistaCompass.pins', () => {
      const store = deps.getStore();
      if (store === undefined) {
        return undefined;
      }
      const meta = new Map(
        store.all('SELECT key, value FROM meta').map((row) => [String(row.key), String(row.value)]),
      );
      return { tag: meta.get('tag') ?? '', content_hash: meta.get('content_hash') ?? '' };
    }),

    vscode.commands.registerCommand(
      'vistaCompass.lookup',
      (payload?: { kind?: string; key?: string }) => {
        if (payload?.kind !== undefined && payload.key !== undefined) {
          const kind = payload.kind === 'file' ? 'fileman_file' : payload.kind;
          return lookupEntity(deps, kind as BridgeEntityType, payload.key);
        }
        return undefined;
      },
    ),

    vscode.commands.registerCommand(
      'vistaCompass.openEntity',
      (payload?: { entity_id?: string }) => {
        const id = payload?.entity_id;
        const colon = id?.indexOf(':') ?? -1;
        if (id === undefined || colon < 1) {
          return undefined;
        }
        const kind = id.slice(0, colon) as BridgeEntityType;
        return lookupEntity(deps, kind, id.slice(colon + 1));
      },
    ),

    vscode.commands.registerCommand('vistaCompass.search', (payload?: { query?: string }) =>
      searchPicker(payload?.query ?? ''),
    ),

    vscode.commands.registerCommand('vistaCompass.openInAtlas', (entityId: string, query: string) =>
      openInAtlas(entityId, query),
    ),

    vscode.commands.registerCommand('vistaCompass.copyCitation', async (text: string) => {
      await vscode.env.clipboard.writeText(text);
      vscode.window.setStatusBarMessage(`Copied: ${text}`, 3000);
    }),

    vscode.window.registerUriHandler({
      handleUri: async (uri) => {
        try {
          const link = parseDeepLink(contract, uri.toString());
          await vscode.commands.executeCommand(link.command, link.payload);
        } catch (err) {
          vscode.window.showWarningMessage(`VistA Compass: bad deep link — ${String(err)}`);
        }
      },
    }),
  );

  // vista.openCitation is implementedBy both twins; register defensively
  // so whichever activates second doesn't crash on the duplicate id.
  vscode.commands.getCommands(true).then((commands) => {
    if (commands.includes('vista.openCitation')) {
      return;
    }
    try {
      context.subscriptions.push(
        vscode.commands.registerCommand(
          'vista.openCitation',
          async (payload?: { text?: string }) => {
            const store = deps.getStore();
            const text = payload?.text ?? '';
            const citation = parseCitation(contract, text);
            if (citation === undefined) {
              vscode.window.showInformationMessage(`VistA Compass: not a citation — ${text}`);
              return;
            }
            if (citation.source === 'vdocs') {
              if (atlasPresent()) {
                const run = await atlasCommand();
                await run('vistaAtlas.openSection', { section_id: citation.section_id });
              } else {
                vscode.window.showInformationMessage(
                  'VistA Compass: a vdocs citation — install VistA Atlas to open it.',
                );
              }
              return;
            }
            const kind = TSV_TO_KIND[citation.tsv];
            if (store !== undefined && kind !== undefined) {
              await lookupEntity(deps, kind, citation.value);
            } else {
              vscode.window.showInformationMessage(`VistA Compass: measured citation — ${text}`);
            }
          },
        ),
      );
    } catch {
      // Lost the registration race to the twin — its handler routes here too.
    }
  });

  // Keep the editor-context entry cheap: reuse the search picker on the
  // current word (the §6.1 "find in docs" affordance).
  context.subscriptions.push(
    vscode.commands.registerCommand('vistaCompass.findInDocs', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined || !atlasPresent()) {
        return;
      }
      const range = editor.document.getWordRangeAtPosition(
        editor.selection.active,
        /[%A-Za-z0-9^]+/,
      );
      const word = range === undefined ? '' : editor.document.getText(range).replace(/^\^/, '');
      if (word !== '' && routineNameFromPath(editor.document.fileName) !== undefined) {
        const run = await atlasCommand();
        await run('vistaAtlas.search', { query: word.toUpperCase() });
      }
    }),
  );
}
