/**
 * Pure M-source and contract helpers — no vscode imports, fully
 * node-testable (the predecessor's model.ts discipline, re-specified
 * clean-room from its docs). Encodes the known bug classes:
 * bare-vs-caret global names and global_root normalization.
 */

/**
 * Join key between the two models: files.tsv `global_root` is a
 * storage root (`^DPT(`, `^DD("IX",`); routine_globals and hover
 * tokens carry the bare name (`DPT`). Strip the caret and everything
 * from the first `(`.
 */
export function globalBase(globalRoot: string): string {
  const withoutCaret = globalRoot.startsWith('^') ? globalRoot.slice(1) : globalRoot;
  const paren = withoutCaret.indexOf('(');
  return paren === -1 ? withoutCaret : withoutCaret.slice(0, paren);
}

export interface TagLocation {
  readonly tag: string;
  /** 1-based line number in the source file. */
  readonly line: number;
}

const TAG_RE = /^([%A-Za-z][A-Za-z0-9]*|\d+)/;

/** Column-0 labels (tags) with their 1-based lines — the file's TOC. */
export function parseTags(source: string): TagLocation[] {
  const tags: TagLocation[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (!text || text[0] === ' ' || text[0] === '\t' || text[0] === ';') {
      continue;
    }
    const match = TAG_RE.exec(text);
    if (match?.[1] !== undefined) {
      tags.push({ tag: match[1], line: i + 1 });
    }
  }
  return tags;
}

export interface Token {
  /** The exact matched text, e.g. `$$GET1^DIQ`. */
  readonly raw: string;
  /** Tag part of TAG^RTN, when present. */
  readonly tag: string | undefined;
  /** Routine (or bare global) name — the part after the caret, or the bare identifier. */
  readonly routine: string;
  readonly dollar: boolean;
  readonly caret: boolean;
}

const IDENT = '[%A-Za-z][A-Za-z0-9]*';
// Longest alternative first: TAG^RTN (optionally $$-prefixed), ^NAME, bare NAME.
const TOKEN_RE = new RegExp(`(\\$\\$)?(${IDENT})\\^(${IDENT})|\\^(${IDENT})|(${IDENT})`, 'g');

interface TokenMatch extends Token {
  readonly start: number;
  readonly end: number;
}

function tokenMatchAt(line: string, col: number): TokenMatch | undefined {
  TOKEN_RE.lastIndex = 0;
  for (const match of line.matchAll(TOKEN_RE)) {
    const start = match.index;
    const end = start + match[0].length;
    if (col < start || col >= end) {
      continue;
    }
    const [, dollar, tag, routineAfterTag, caretName, bare] = match;
    if (routineAfterTag !== undefined && tag !== undefined) {
      return {
        raw: match[0],
        tag,
        routine: routineAfterTag,
        dollar: dollar !== undefined,
        caret: true,
        start,
        end,
      };
    }
    if (caretName !== undefined) {
      return {
        raw: match[0],
        tag: undefined,
        routine: caretName,
        dollar: false,
        caret: true,
        start,
        end,
      };
    }
    if (bare !== undefined) {
      return {
        raw: match[0],
        tag: undefined,
        routine: bare,
        dollar: false,
        caret: false,
        start,
        end,
      };
    }
  }
  return undefined;
}

/** The token spanning a column of a source line, or undefined. */
export function tokenAt(line: string, col: number): Token | undefined {
  const match = tokenMatchAt(line, col);
  if (match === undefined) {
    return undefined;
  }
  const { start: _s, end: _e, ...token } = match;
  return token;
}

export type TokenKind = 'routine-call' | 'global' | 'tag-def';

export interface ClassifiedToken {
  readonly kind: TokenKind;
  /** Routine name, BARE global name, or tag — the join key for lookups. */
  readonly name: string;
  readonly token: Token;
}

const CALL_VERB_RE = /(?:^|\s)(?:D|DO|G|GOTO|J|JOB)\s+$/i;

/**
 * The 0.2.0 classification rules (internals guide §7.1):
 * TAG^RTN → routine call; ^X → global if followed by `(` (wins even
 * over a known routine), else routine when known, else global; bare
 * ident at column 0 → tag definition; bare ident after a call verb or
 * naming a known routine → routine; anything else → undefined so
 * local variables stay quiet.
 */
export function classifyToken(
  line: string,
  col: number,
  isRoutine: (name: string) => boolean,
): ClassifiedToken | undefined {
  const match = tokenMatchAt(line, col);
  if (match === undefined) {
    return undefined;
  }
  const { start, end, ...token } = match;

  if (token.caret && token.tag !== undefined) {
    return { kind: 'routine-call', name: token.routine, token };
  }
  if (token.caret) {
    const followedByParen = line[end] === '(';
    if (!followedByParen && isRoutine(token.routine)) {
      return { kind: 'routine-call', name: token.routine, token };
    }
    return { kind: 'global', name: token.routine, token };
  }
  if (start === 0) {
    return { kind: 'tag-def', name: token.routine, token };
  }
  if (CALL_VERB_RE.test(line.slice(0, start)) || isRoutine(token.routine)) {
    return { kind: 'routine-call', name: token.routine, token };
  }
  return undefined;
}
