import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { classifyToken, globalBase, parseTags, tokenAt } from './mumps.ts';

// ── Bug class (predecessor, re-encoded per the clean-room rule) ──
// files.tsv global_root is a storage root (`^DPT(`, `^DD("IX",`);
// routine-globals/global cards use the bare name. globalBase is the
// join key between the two models — subscripts and caret stripped.
describe('globalBase', () => {
  const cases: ReadonlyArray<{ readonly root: string; readonly base: string }> = [
    { root: '^DPT(', base: 'DPT' },
    { root: '^DD("IX",', base: 'DD' },
    { root: '^DPT', base: 'DPT' },
    { root: 'DPT', base: 'DPT' },
    { root: '^%ZOSF(', base: '%ZOSF' },
    { root: '^DIC(9.4,', base: 'DIC' },
    { root: '', base: '' },
  ];
  for (const tc of cases) {
    it(`${JSON.stringify(tc.root)} → ${JSON.stringify(tc.base)}`, () => {
      assert.equal(globalBase(tc.root), tc.base);
    });
  }
});

describe('parseTags', () => {
  it('finds column-0 labels with their lines, skipping comments and indented code', () => {
    const source = [
      'PRCA45PT ;SF-ISC/YGT-AR GECS UPDATE ;4/21/94', // line 1: tag
      ' ;;4.5;Accounts Receivable;;Mar 20, 1995', // indented comment
      'V ;', // line 3: tag V
      ' quit', // indented
      'EN(X,Y) ; entry with formals', // line 5: tag EN
      '430 ; numeric tag', // line 6: numeric tag
      '\tset x=1', // tab-indented
      ';comment at col 0 is not a tag', // ; at col 0
      '%XX ; percent tag', // line 9
    ].join('\n');
    assert.deepEqual(parseTags(source), [
      { tag: 'PRCA45PT', line: 1 },
      { tag: 'V', line: 3 },
      { tag: 'EN', line: 5 },
      { tag: '430', line: 6 },
      { tag: '%XX', line: 9 },
    ]);
  });

  it('returns empty for empty source', () => {
    assert.deepEqual(parseTags(''), []);
  });
});

describe('tokenAt', () => {
  const line = ' D BMES^XPDUTL($$GET1^DIQ(2,DFN,.01)) S X=$G(^DPT(DFN,0))';

  const cases: ReadonlyArray<{
    readonly name: string;
    readonly col: number;
    readonly expected: ReturnType<typeof tokenAt>;
  }> = [
    {
      name: 'TAG^RTN call site',
      col: 4, // inside BMES
      expected: { raw: 'BMES^XPDUTL', tag: 'BMES', routine: 'XPDUTL', dollar: false, caret: true },
    },
    {
      name: '$$TAG^RTN function call',
      col: 18, // inside GET1
      expected: { raw: '$$GET1^DIQ', tag: 'GET1', routine: 'DIQ', dollar: true, caret: true },
    },
    {
      name: 'global reference ^DPT',
      col: 46, // inside DPT after ^
      expected: { raw: '^DPT', tag: undefined, routine: 'DPT', dollar: false, caret: true },
    },
    { name: 'no token at whitespace', col: 0, expected: undefined },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      assert.deepEqual(tokenAt(line, tc.col), tc.expected);
    });
  }

  it('bare identifier', () => {
    assert.deepEqual(tokenAt(' D HOME', 3), {
      raw: 'HOME',
      tag: undefined,
      routine: 'HOME',
      dollar: false,
      caret: false,
    });
  });
});

// Classification rules from the 0.2.0 behavioral spec (internals §7.1):
//  - TAG^RTN / $$TAG^RTN → routine card + tag badge
//  - ^X → routine if X is a known routine AND not followed by '(',
//    else global (the '(' refinement wins even over a known routine)
//  - bare ident at column 0 → tag in this routine
//  - bare ident after a call verb (D/DO/G/GOTO/J/JOB) or a known
//    routine name → routine
//  - anything else → none (noise control: local variables stay quiet)
describe('classifyToken', () => {
  const isRoutine = (name: string) => ['XPDUTL', 'DIQ', 'DGRP', 'HOME'].includes(name);

  const cases: ReadonlyArray<{
    readonly name: string;
    readonly line: string;
    readonly col: number;
    readonly kind: string | undefined;
  }> = [
    { name: 'TAG^RTN is a routine call', line: ' D BMES^XPDUTL', col: 4, kind: 'routine-call' },
    {
      name: '$$TAG^RTN is a routine call',
      line: ' S X=$$GET1^DIQ(2)',
      col: 8,
      kind: 'routine-call',
    },
    // The bare-vs-caret bug class: ^DPT is a global (DPT not a routine)
    { name: '^GLOBAL is a global', line: ' S X=$G(^DPT(0))', col: 10, kind: 'global' },
    // ^DGRP names a known routine → routine
    { name: '^RTN known routine', line: ' D ^DGRP', col: 5, kind: 'routine-call' },
    // ...but '(' immediately after forces the global reading anyway
    { name: '^RTN( forces global', line: ' S X=^DGRP(1)', col: 7, kind: 'global' },
    { name: 'tag at column 0', line: 'EN(X) ; entry', col: 1, kind: 'tag-def' },
    { name: 'bare ident after D verb', line: ' D HOME', col: 4, kind: 'routine-call' },
    { name: 'bare ident after GOTO', line: ' GOTO HOME', col: 7, kind: 'routine-call' },
    { name: 'known routine bare', line: ' I $G(X) W XPDUTL', col: 12, kind: 'routine-call' },
    { name: 'local variable stays quiet', line: ' S FOO=1', col: 3, kind: undefined },
    { name: 'whitespace stays quiet', line: '   ', col: 1, kind: undefined },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      const result = classifyToken(tc.line, tc.col, isRoutine);
      assert.equal(result?.kind, tc.kind, JSON.stringify(result));
    });
  }

  // Numeric tags (the wireframe's 430/433) are real M labels: hoverable
  // at column 0 and in TAG^RTN calls — but a bare number elsewhere is a
  // literal, never a token (noise control).
  const numericCases: ReadonlyArray<{
    readonly name: string;
    readonly line: string;
    readonly col: number;
    readonly kind: string | undefined;
  }> = [
    { name: 'numeric tag at column 0', line: '430 ; numeric tag', col: 1, kind: 'tag-def' },
    { name: 'numeric TAG^RTN call', line: ' D 430^PRCA45PT', col: 4, kind: 'routine-call' },
    { name: 'bare numeric literal stays quiet', line: ' S X=430', col: 6, kind: undefined },
    { name: 'numeric after call verb stays quiet', line: ' D 430', col: 4, kind: undefined },
  ];
  for (const tc of numericCases) {
    it(tc.name, () => {
      const result = classifyToken(tc.line, tc.col, isRoutine);
      assert.equal(result?.kind, tc.kind, JSON.stringify(result));
    });
  }

  it('global classification exposes the bare name for the joins', () => {
    const result = classifyToken(' S X=$G(^DPT(0))', 10, () => false);
    assert.equal(result?.kind, 'global');
    assert.equal(result?.name, 'DPT', 'joins use the BARE name (bare-vs-caret bug class)');
  });
});
