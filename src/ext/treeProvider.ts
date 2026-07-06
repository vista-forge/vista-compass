/**
 * The VistA Routine sidebar — a thin vscode adapter over the tested
 * model layer (analyze + parseTags). All data shaping lives in
 * src/model/; this file only builds TreeItems.
 */

import { readFileSync } from 'node:fs';
import * as vscode from 'vscode';
import { resolveSourcePath, routineNameFromPath, routineSourcePath } from '../model/lookup.js';
import { parseTags, type TagLocation } from '../model/mumps.js';
import { analyze, type RoutineInfo, type XindexSeverity } from '../model/routine.js';
import { optionsForRoutine, protocolsInvoking, rpcsForRoutine } from '../model/surfaces.js';
import type { Store } from '../store/engine.js';

export interface TreeConfig {
  readonly topN: number;
  readonly vistaMHostPath: string;
}

interface Node {
  readonly item: vscode.TreeItem;
  readonly children: readonly Node[];
}

function leaf(item: vscode.TreeItem): Node {
  return { item, children: [] };
}

function openAtLine(path: string, line: number): vscode.Command {
  const position = new vscode.Position(Math.max(0, line - 1), 0);
  return {
    command: 'vscode.open',
    title: 'Open',
    arguments: [vscode.Uri.file(path), { selection: new vscode.Range(position, position) }],
  };
}

const SEVERITY_ICON: Record<XindexSeverity, vscode.ThemeIcon> = {
  error: new vscode.ThemeIcon('error'),
  warning: new vscode.ThemeIcon('warning'),
  info: new vscode.ThemeIcon('info'),
};

export class RoutineTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly changeEmitter = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  private activeFile: string | undefined;
  private roots: Node[] = [];

  constructor(
    private readonly getStore: () => Store | undefined,
    private readonly getConfig: () => TreeConfig,
  ) {}

  setActiveFile(path: string | undefined): void {
    this.activeFile = path;
    this.refresh();
  }

  refresh(): void {
    this.roots = this.build();
    this.changeEmitter.fire(undefined);
  }

  getTreeItem(node: Node): vscode.TreeItem {
    return node.item;
  }

  getChildren(node?: Node): Node[] {
    return node === undefined ? this.roots : [...node.children];
  }

  private message(text: string): Node[] {
    return [leaf(new vscode.TreeItem(text, vscode.TreeItemCollapsibleState.None))];
  }

  private build(): Node[] {
    const store = this.getStore();
    if (store === undefined) {
      return this.message('Data not loaded yet…');
    }
    if (this.activeFile === undefined) {
      return this.message('Open a .m file to see its measured model.');
    }
    const name = routineNameFromPath(this.activeFile);
    if (name === undefined) {
      return this.message('Open a .m file to see its measured model.');
    }
    const info = analyze(store, name);
    const tags = this.readTags();
    if (info.header === undefined && info.callees.length === 0 && info.callers.length === 0) {
      return [
        ...this.message(`${name} — not measured in the data release`),
        ...(tags.length > 0 ? [this.tagsSection(tags)] : []),
      ];
    }
    return this.routineNodes(store, info, tags);
  }

  private readTags(): TagLocation[] {
    try {
      return this.activeFile === undefined ? [] : parseTags(readFileSync(this.activeFile, 'utf8'));
    } catch {
      return [];
    }
  }

  private section(label: string, count: number, children: readonly Node[], expanded = false): Node {
    const item = new vscode.TreeItem(
      `${label} (${count})`,
      expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );
    return { item, children };
  }

  private tagsSection(tags: readonly TagLocation[]): Node {
    const children = tags.map((t) => {
      const item = new vscode.TreeItem(t.tag, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('symbol-function');
      item.description = `line ${t.line}`;
      if (this.activeFile !== undefined) {
        item.command = openAtLine(this.activeFile, t.line);
      }
      return leaf(item);
    });
    return this.section('Tags', tags.length, children);
  }

  private openRoutineCommand(store: Store, routine: string): vscode.Command | undefined {
    const hostRoot = this.getConfig().vistaMHostPath;
    if (hostRoot === '') {
      return undefined;
    }
    const source = routineSourcePath(store, routine);
    const hostPath = source === undefined ? undefined : resolveSourcePath(source, hostRoot);
    return hostPath === undefined ? undefined : openAtLine(hostPath, 1);
  }

  private routineNodes(store: Store, info: RoutineInfo, tags: readonly TagLocation[]): Node[] {
    const topN = this.getConfig().topN;
    const nodes: Node[] = [];

    if (info.header !== undefined) {
      const h = info.header;
      const badges = [
        h.rpcCount > 0 ? ` · RPC×${h.rpcCount}` : '',
        h.optionCount > 0 ? ` · OPT×${h.optionCount}` : '',
      ].join('');
      const item = new vscode.TreeItem(
        `${h.routineName}  [${h.package}]`,
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon('symbol-class');
      item.description = `${h.lineCount} lines · in=${h.inDegree} · out=${h.outDegree}${badges}`;
      nodes.push(leaf(item));
    }

    if (tags.length > 0) {
      nodes.push(this.tagsSection(tags));
    }

    if (info.callers.length > 0) {
      const children = info.callers.slice(0, topN).map((c) => {
        const item = new vscode.TreeItem(c.routine, vscode.TreeItemCollapsibleState.None);
        item.description = `${c.package}  ×${c.refCount}`;
        const command = this.openRoutineCommand(store, c.routine);
        if (command !== undefined) {
          item.command = command;
        }
        return leaf(item);
      });
      nodes.push(this.section('Callers', info.callers.length, children));
    }

    if (info.callees.length > 0) {
      const children = info.callees.slice(0, topN).map((c) => {
        const item = new vscode.TreeItem(c.label, vscode.TreeItemCollapsibleState.None);
        item.description = `${c.kind}  ×${c.refCount}`;
        const command = this.openRoutineCommand(store, c.routine);
        if (command !== undefined) {
          item.command = command;
        }
        return leaf(item);
      });
      nodes.push(this.section('Callees', info.callees.length, children));
    }

    if (info.globals.length > 0) {
      const children = info.globals.slice(0, topN).map((g) => {
        const item = new vscode.TreeItem(`^${g.name}`, vscode.TreeItemCollapsibleState.None);
        item.description = `×${g.refCount}`;
        return leaf(item);
      });
      nodes.push(this.section('Globals', info.globals.length, children));
    }

    const routineName = info.name;
    const rpcs = rpcsForRoutine(store, routineName);
    if (rpcs.length > 0) {
      const children = rpcs.slice(0, topN).map((rpc) => {
        const item = new vscode.TreeItem(rpc.name, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('remote');
        item.description = `${rpc.tag ?? ''}  ${rpc.returnType}`;
        return leaf(item);
      });
      nodes.push(this.section('RPCs', rpcs.length, children));
    }

    const options = optionsForRoutine(store, routineName);
    if (options.length > 0) {
      const children = options.slice(0, topN).map((option) => {
        const item = new vscode.TreeItem(option.name, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('menu');
        item.description = `${option.menuText}  ${option.type}`;
        return leaf(item);
      });
      nodes.push(this.section('Options', options.length, children));
    }

    const protocols = protocolsInvoking(store, routineName);
    if (protocols.length > 0) {
      const children = protocols.slice(0, topN).map((protocol) => {
        const item = new vscode.TreeItem(protocol.name, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('zap');
        item.description = `${protocol.actionKind} → ${protocol.label}  ×${protocol.refCount}`;
        return leaf(item);
      });
      nodes.push(this.section('Protocols', protocols.length, children));
    }

    if (info.xindex.length > 0) {
      const children = info.xindex.slice(0, topN).map((f) => {
        const item = new vscode.TreeItem(f.message, vscode.TreeItemCollapsibleState.None);
        item.iconPath = SEVERITY_ICON[f.severity];
        item.description = f.line === undefined ? f.tagOffset : `${f.tagOffset}   line ${f.line}`;
        if (f.line !== undefined && this.activeFile !== undefined) {
          item.command = openAtLine(this.activeFile, f.line);
        }
        return leaf(item);
      });
      // Auto-expanded so Fatals can't be missed (guide §2.1).
      nodes.push(this.section('XINDEX', info.xindex.length, children, true));
    }

    return nodes;
  }
}
