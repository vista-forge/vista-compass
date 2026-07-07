/**
 * Twin-link contract v1 (proposal §6.1) — the versioned seam between
 * VistA Atlas and VistA Compass. The contract lives as data in
 * contracts/twin-link.v1.json; this module loads it and gives both
 * twins the same payload validation, citation parsing, and
 * vscode:// deep-link building/parsing, so the two command surfaces
 * cannot drift apart.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type Target = 'atlas' | 'compass';

export interface ParamSpec {
  readonly type: 'string' | 'object';
  readonly required: boolean;
  readonly enum?: readonly string[];
  /** "entity_id" constrains the value to `<entityType>:<name>`. */
  readonly format?: string;
}

export interface CommandSpec {
  readonly implementedBy: Target | 'both';
  /** URI-handler path; commands without one are not deep-linkable. */
  readonly uriPath?: string;
  readonly params: Readonly<Record<string, ParamSpec>>;
  readonly returns?: Readonly<Record<string, string>>;
}

export interface TwinLinkContract {
  readonly contract: 'twin-link';
  readonly version: number;
  readonly extensions: Readonly<Record<Target, { extensionId: string; uriAuthority: string }>>;
  readonly entityTypes: readonly string[];
  readonly citations: Readonly<Record<'vdocs' | 'vista-meta', { pattern: string }>>;
  readonly commands: Readonly<Record<string, CommandSpec>>;
}

/**
 * Load the frozen v1 contract artifact shipped with the package.
 * Pass an explicit path in bundled (CJS) contexts where
 * import.meta.url is unavailable.
 */
export function loadTwinLinkContract(path?: string): TwinLinkContract {
  const artifactPath =
    path ?? fileURLToPath(new URL('../contracts/twin-link.v1.json', import.meta.url));
  return JSON.parse(readFileSync(artifactPath, 'utf8')) as TwinLinkContract;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly problems: readonly string[];
}

/** Validate a command payload against the contract's param specs. */
export function validatePayload(
  contract: TwinLinkContract,
  command: string,
  payload: unknown,
): ValidationResult {
  const spec = contract.commands[command];
  if (spec === undefined) {
    return { ok: false, problems: [`unknown command: ${command}`] };
  }
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, problems: ['payload must be an object'] };
  }
  const problems: string[] = [];
  const record = payload as Record<string, unknown>;

  for (const name of Object.keys(record)) {
    if (!(name in spec.params)) {
      problems.push(`unexpected param: ${name}`);
    }
  }
  for (const [name, param] of Object.entries(spec.params)) {
    const value = record[name];
    if (value === undefined) {
      if (param.required) {
        problems.push(`missing required param: ${name}`);
      }
      continue;
    }
    if (param.type === 'string' && typeof value !== 'string') {
      problems.push(`param ${name}: expected string`);
      continue;
    }
    if (param.type === 'object' && (typeof value !== 'object' || value === null)) {
      problems.push(`param ${name}: expected object`);
      continue;
    }
    if (param.enum && !param.enum.includes(value as string)) {
      problems.push(`param ${name}: not one of ${param.enum.join(', ')}`);
    }
    if (param.format === 'entity_id') {
      const type = String(value).split(':', 1)[0] ?? '';
      if (!String(value).includes(':') || !contract.entityTypes.includes(type)) {
        problems.push(`param ${name}: entity_id must be <type>:<name> with a published type`);
      }
    }
  }
  return { ok: problems.length === 0, problems };
}

/** The authoritative pin pair carried by the bridge meta asset. */
export interface BridgePins {
  readonly vdocs?: { readonly tag?: string; readonly corpus_content_hash?: string };
  readonly vista_meta?: { readonly tag?: string; readonly content_hash?: string };
}

/** Compass's own live data pins. */
export interface OwnPins {
  readonly tag: string;
  readonly contentHash: string;
}

/** Atlas's live data pins, as returned by the vistaAtlas.pins command. */
export interface AtlasPins {
  readonly tag?: string;
  readonly corpus_content_hash?: string;
}

/**
 * Gate-R release-pair drift check (proposal §6.1) as a pure function so it is
 * unit-testable without the extension host. The bridge meta's pin pair is the
 * authority; each live twin that disagrees produces a problem string. Empty =
 * in sync.
 *
 * Atlas populates its pins only once its navigator panel first opens, so
 * empty/absent Atlas pins mean "not loaded yet", not drift — the vdocs-side
 * comparison is skipped rather than reported as a mismatch.
 */
export function releaseDriftProblems(
  bridgePins: BridgePins,
  ownPins: OwnPins,
  atlasPins: AtlasPins | undefined,
): string[] {
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
  // Only compare the Atlas side once Atlas has actually loaded a corpus.
  if (atlasPins !== undefined && (atlasPins.tag || atlasPins.corpus_content_hash)) {
    const expectedDocs = bridgePins.vdocs;
    if (atlasPins.tag && expectedDocs?.tag !== undefined && atlasPins.tag !== expectedDocs.tag) {
      problems.push(`Atlas corpus ${atlasPins.tag} vs bridge pin ${expectedDocs.tag}`);
    }
    if (
      atlasPins.corpus_content_hash &&
      expectedDocs?.corpus_content_hash !== undefined &&
      atlasPins.corpus_content_hash !== expectedDocs.corpus_content_hash
    ) {
      problems.push('Atlas corpus_content_hash differs from the bridge pin');
    }
  }
  return problems;
}

export type Citation =
  | { readonly source: 'vdocs'; readonly section_id: string }
  | {
      readonly source: 'vista-meta';
      readonly release: string;
      readonly tsv: string;
      readonly key: string;
      readonly value: string;
    };

/**
 * Parse either published citation format (the same lines the MCP
 * servers and skills emit). Unrecognized text → undefined: routing a
 * non-citation is an expected outcome, not an error.
 */
export function parseCitation(contract: TwinLinkContract, text: string): Citation | undefined {
  const trimmed = text.trim();
  const vdocs = new RegExp(contract.citations.vdocs.pattern).exec(trimmed);
  if (vdocs?.[1] !== undefined) {
    return { source: 'vdocs', section_id: vdocs[1] };
  }
  const meta = new RegExp(contract.citations['vista-meta'].pattern).exec(trimmed);
  if (meta) {
    const [, release, tsv, key, value] = meta;
    if (release && tsv && key && value) {
      return { source: 'vista-meta', release, tsv: tsv.trim(), key: key.trim(), value };
    }
  }
  return undefined;
}

function resolveTarget(spec: CommandSpec, command: string, target?: Target): Target {
  if (spec.implementedBy === 'both') {
    if (target === undefined) {
      throw new Error(`deep link: ${command} is implemented by both twins — pass a target`);
    }
    return target;
  }
  return spec.implementedBy;
}

/** Build a vscode:// deep link for a command; validates the payload. */
export function buildDeepLink(
  contract: TwinLinkContract,
  command: string,
  payload: Record<string, unknown>,
  target?: Target,
): string {
  const spec = contract.commands[command];
  if (spec?.uriPath === undefined) {
    throw new Error(`deep link: command not deep-linkable: ${command}`);
  }
  const valid = validatePayload(contract, command, payload);
  if (!valid.ok) {
    throw new Error(`deep link ${command}: ${valid.problems.join('; ')}`);
  }
  const authority = contract.extensions[resolveTarget(spec, command, target)].uriAuthority;
  const query = Object.entries(payload)
    .map(([name, value]) => {
      const encoded = typeof value === 'string' ? value : JSON.stringify(value);
      return `${encodeURIComponent(name)}=${encodeURIComponent(encoded)}`;
    })
    .join('&');
  return `vscode://${authority}${spec.uriPath}${query ? `?${query}` : ''}`;
}

export interface ParsedDeepLink {
  readonly command: string;
  readonly target: Target;
  readonly payload: Record<string, unknown>;
}

/** Parse and validate a vscode:// deep link back into (command, payload). */
export function parseDeepLink(contract: TwinLinkContract, uri: string): ParsedDeepLink {
  const url = new URL(uri);
  if (url.protocol !== 'vscode:') {
    throw new Error(`deep link: unsupported scheme: ${url.protocol}`);
  }
  const target = (Object.entries(contract.extensions) as [Target, { uriAuthority: string }][]).find(
    ([, ext]) => ext.uriAuthority === url.host,
  )?.[0];
  if (target === undefined) {
    throw new Error(`deep link: unknown authority: ${url.host}`);
  }
  const entry = Object.entries(contract.commands).find(
    ([, spec]) =>
      spec.uriPath === url.pathname &&
      (spec.implementedBy === 'both' || spec.implementedBy === target),
  );
  if (entry === undefined) {
    throw new Error(`deep link: unknown path for ${url.host}: ${url.pathname}`);
  }
  const [command, spec] = entry;
  const payload: Record<string, unknown> = {};
  for (const [name, raw] of url.searchParams) {
    const param = spec.params[name];
    payload[name] = param?.type === 'object' ? JSON.parse(raw) : raw;
  }
  const valid = validatePayload(contract, command, payload);
  if (!valid.ok) {
    throw new Error(`deep link ${command}: ${valid.problems.join('; ')}`);
  }
  return { command, target, payload };
}
