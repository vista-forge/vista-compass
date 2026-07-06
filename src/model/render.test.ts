import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { renderGlobalCard, renderRoutineCard, renderTagCard } from './render.ts';
import type { GlobalCard, RoutineInfo } from './routine.ts';

const INFO: RoutineInfo = {
  name: 'PRCA45PT',
  header: {
    routineName: 'PRCA45PT',
    package: 'Accounts Receivable',
    sourcePath: '/opt/VistA-M/Packages/AR/Routines/PRCA45PT.m',
    lineCount: 74,
    rpcCount: 0,
    optionCount: 0,
    inDegree: 0,
    outDegree: 5,
  },
  callers: [],
  callees: [
    { label: 'BMES^XPDUTL', tag: 'BMES', routine: 'XPDUTL', kind: 'do', refCount: 7 },
    { label: '^DIK', tag: undefined, routine: 'DIK', kind: 'do', refCount: 1 },
  ],
  globals: [{ name: 'PRCA', refCount: 18 }],
  xindex: [],
};

describe('renderRoutineCard', () => {
  it('shows name, package, and the stats line', () => {
    const md = renderRoutineCard(INFO, {});
    assert.match(md, /\*\*PRCA45PT\*\*/);
    assert.match(md, /Accounts Receivable/);
    assert.match(md, /74 lines · in=0 · out=5/);
  });

  it('omits RPC/OPT badges when zero and shows them when nonzero', () => {
    assert.doesNotMatch(renderRoutineCard(INFO, {}), /RPC×/);
    const withBadges: RoutineInfo = {
      ...INFO,
      header:
        INFO.header === undefined ? undefined : { ...INFO.header, rpcCount: 2, optionCount: 1 },
    };
    const md = renderRoutineCard(withBadges, {});
    assert.match(md, /RPC×2/);
    assert.match(md, /OPT×1/);
  });

  it('lists top callees and globals with display carets', () => {
    const md = renderRoutineCard(INFO, {});
    assert.match(md, /BMES\^XPDUTL ×7/);
    assert.match(md, /\^PRCA ×18/, 'globals display with a caret (stored bare)');
  });

  it('caps the lists at topN', () => {
    const md = renderRoutineCard(INFO, { topN: 1 });
    assert.match(md, /BMES\^XPDUTL/);
    assert.doesNotMatch(md, /\^DIK/);
  });

  it('shows a tag badge when given (found and not-found)', () => {
    assert.match(
      renderRoutineCard(INFO, { tagBadge: { tag: 'EN', exists: true } }),
      /`EN` — found in measured tags/,
    );
    assert.match(
      renderRoutineCard(INFO, { tagBadge: { tag: 'ZZ', exists: false } }),
      /`ZZ` — not found in measured tags/,
    );
  });

  it('adds the documented-in-N-docs line when mentions are given', () => {
    assert.match(renderRoutineCard(INFO, { mentions: 42 }), /documented in 42 docs/);
    assert.doesNotMatch(renderRoutineCard(INFO, { mentions: 0 }), /documented in/);
  });

  it('linkifies the mentions line and adds copy-citation when links are given', () => {
    const md = renderRoutineCard(INFO, {
      mentions: 42,
      links: { atlas: 'command:x?%5B%5D', copyCitation: 'command:y?%5B%5D' },
    });
    assert.match(md, /\[documented in 42 docs → Atlas\]\(command:x\?%5B%5D\)/);
    assert.match(md, /\[copy citation\]\(command:y\?%5B%5D\)/);
  });

  it('copy-citation link renders even with zero mentions', () => {
    const md = renderRoutineCard(INFO, { mentions: 0, links: { copyCitation: 'command:y' } });
    assert.doesNotMatch(md, /documented in/);
    assert.match(md, /\[copy citation\]\(command:y\)/);
  });

  it('renders a not-measured card when there is no header', () => {
    const md = renderRoutineCard({ ...INFO, header: undefined }, {});
    assert.match(md, /PRCA45PT/);
    assert.match(md, /not measured/);
  });
});

describe('renderGlobalCard', () => {
  const card: GlobalCard = {
    name: 'DPT',
    routineCount: 2,
    totalRefs: 42,
    topConsumers: [
      { routine: 'DGRP', refCount: 40 },
      { routine: 'XPDUTL', refCount: 2 },
    ],
    files: [
      {
        fileNumber: '2',
        fileName: 'PATIENT',
        recordCount: 1811,
        piks: { cls: 'P', method: 'H-01', confidence: 'certain' },
      },
      { fileNumber: '99', fileName: 'NOPIKS', recordCount: undefined, piks: undefined },
    ],
    moreFiles: 3,
  };

  it('shows the caret-display name, reference summary, and consumers', () => {
    const md = renderGlobalCard(card);
    assert.match(md, /\*\*\^DPT\*\*/);
    assert.match(md, /2 routines · 42 refs/);
    assert.match(md, /DGRP ×40/);
  });

  it('renders the FileMan → PIKS join with record counts and the overflow line', () => {
    const md = renderGlobalCard(card);
    assert.match(md, /File \*\*2\*\* PATIENT — PIKS \*\*P\*\* \(H-01, certain\)/);
    assert.match(md, /1,811 records/);
    assert.match(md, /File \*\*99\*\* NOPIKS(?!.*PIKS \*\*)/);
    assert.match(md, /… 3 more/);
  });

  it('omits the FileMan block when no files match', () => {
    const md = renderGlobalCard({ ...card, files: [], moreFiles: 0 });
    assert.doesNotMatch(md, /File \*\*/);
    assert.doesNotMatch(md, /… \d+ more/);
  });

  it('adds the documented-in-N-docs line when mentions are given', () => {
    assert.match(renderGlobalCard(card, { mentions: 120 }), /documented in 120 docs/);
  });

  it('linkifies the global mentions line when links are given', () => {
    const md = renderGlobalCard(card, {
      mentions: 120,
      links: { atlas: 'command:a', copyCitation: 'command:c' },
    });
    assert.match(md, /\[documented in 120 docs → Atlas\]\(command:a\)/);
    assert.match(md, /\[copy citation\]\(command:c\)/);
  });

  it('renders the field-PIKS drill-down per file when provided', () => {
    const md = renderGlobalCard(card, {
      fieldPiks: {
        '2': [
          {
            fieldNumber: '.104',
            fieldName: 'PROVIDER',
            dataType: 'POINTER',
            pointerTarget: '200',
            refPiks: 'S',
            crossPiks: 'P->S',
            sensitive: false,
          },
          {
            fieldNumber: '.01',
            fieldName: 'NAME',
            dataType: 'FREE TEXT',
            pointerTarget: undefined,
            refPiks: undefined,
            crossPiks: undefined,
            sensitive: true,
          },
        ],
      },
    });
    assert.match(md, /cross-PIKS fields: \.104 PROVIDER → #200 \(P->S\)/);
    assert.match(md, /sensitive fields: 1/);
  });
});

describe('renderTagCard', () => {
  it('lists external callers with ref-counts', () => {
    const md = renderTagCard('XPDUTL', 'BMES', [
      { routine: 'PRCA45PT', package: 'Accounts Receivable', refCount: 7 },
    ]);
    assert.match(md, /\*\*BMES\^XPDUTL\*\*/);
    assert.match(md, /PRCA45PT ×7/);
  });

  it('says likely-private when nobody calls the tag', () => {
    const md = renderTagCard('XPDUTL', 'PRIVATE', []);
    assert.match(md, /no external callers — likely private/);
  });
});
