import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildDeepLink,
  loadTwinLinkContract,
  parseCitation,
  parseDeepLink,
  releaseDriftProblems,
  validatePayload,
} from './twinlink.ts';

const contract = loadTwinLinkContract();

describe('loadTwinLinkContract', () => {
  it('loads the frozen v1 artifact', () => {
    assert.equal(contract.contract, 'twin-link');
    assert.equal(contract.version, 1);
    assert.equal(contract.extensions.atlas.extensionId, 'vista-forge.vista-atlas');
    assert.equal(contract.extensions.compass.extensionId, 'vista-forge.vista-compass');
  });

  it('carries the nine published bridge entity types', () => {
    assert.deepEqual(contract.entityTypes, [
      'build',
      'fileman_file',
      'global',
      'hl7_segment',
      'mail_group',
      'option',
      'package_namespace',
      'routine',
      'rpc',
    ]);
  });

  it('declares the §6.1 command surface', () => {
    assert.deepEqual(Object.keys(contract.commands).sort(), [
      'vista.openCitation',
      'vistaAtlas.openDoc',
      'vistaAtlas.openEntity',
      'vistaAtlas.openSection',
      'vistaAtlas.pins',
      'vistaAtlas.search',
      'vistaCompass.lookup',
      'vistaCompass.openEntity',
      'vistaCompass.pins',
      'vistaCompass.search',
    ]);
  });
});

describe('validatePayload', () => {
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly command: string;
    readonly payload: unknown;
    readonly ok: boolean;
    readonly problem?: RegExp;
  }> = [
    {
      name: 'valid compass lookup',
      command: 'vistaCompass.lookup',
      payload: { kind: 'rpc', key: 'ORWPT SELECT' },
      ok: true,
    },
    {
      name: 'lookup with unknown kind',
      command: 'vistaCompass.lookup',
      payload: { kind: 'martian', key: 'X' },
      ok: false,
      problem: /kind/,
    },
    {
      name: 'lookup missing required key',
      command: 'vistaCompass.lookup',
      payload: { kind: 'rpc' },
      ok: false,
      problem: /key/,
    },
    {
      name: 'valid openEntity with a bridge entity_id',
      command: 'vistaCompass.openEntity',
      payload: { entity_id: 'rpc:ORWPT SELECT' },
      ok: true,
    },
    {
      name: 'openEntity with an unknown entity type prefix',
      command: 'vistaAtlas.openEntity',
      payload: { entity_id: 'martian:THING' },
      ok: false,
      problem: /entity_id/,
    },
    {
      name: 'pins takes no payload',
      command: 'vistaCompass.pins',
      payload: {},
      ok: true,
    },
    {
      name: 'atlas search with optional filters object',
      command: 'vistaAtlas.search',
      payload: { query: 'kernel install', filters: { app: 'XU' } },
      ok: true,
    },
    {
      name: 'atlas search with non-object filters',
      command: 'vistaAtlas.search',
      payload: { query: 'kernel', filters: 'XU' },
      ok: false,
      problem: /filters/,
    },
    {
      name: 'non-string value for a string param',
      command: 'vistaAtlas.openDoc',
      payload: { doc_key: 42 },
      ok: false,
      problem: /doc_key/,
    },
    {
      name: 'unknown command',
      command: 'vistaCompass.teleport',
      payload: {},
      ok: false,
      problem: /unknown command/,
    },
    {
      name: 'unexpected extra param',
      command: 'vistaCompass.search',
      payload: { query: 'DPT', turbo: true },
      ok: false,
      problem: /turbo/,
    },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      const result = validatePayload(contract, tc.command, tc.payload);
      assert.equal(result.ok, tc.ok, JSON.stringify(result));
      if (tc.problem) {
        assert.ok(
          result.problems.some((p) => tc.problem?.test(p)),
          `no problem matching ${tc.problem}: ${JSON.stringify(result.problems)}`,
        );
      }
    });
  }
});

describe('parseCitation', () => {
  it('parses a vdocs section citation', () => {
    assert.deepEqual(parseCitation(contract, 'vdocs://section/xu-8-0-install-42'), {
      source: 'vdocs',
      section_id: 'xu-8-0-install-42',
    });
  });

  it('parses a vista-meta citation with spaces in the value', () => {
    assert.deepEqual(
      parseCitation(contract, 'vista-meta data-v1 · code-model/rpcs.tsv · name=ORWPT SELECT'),
      {
        source: 'vista-meta',
        release: 'data-v1',
        tsv: 'code-model/rpcs.tsv',
        key: 'name',
        value: 'ORWPT SELECT',
      },
    );
  });

  it('tolerates surrounding whitespace', () => {
    const parsed = parseCitation(contract, '  vdocs://section/abc  ');
    assert.deepEqual(parsed, { source: 'vdocs', section_id: 'abc' });
  });

  it('returns undefined for a non-citation', () => {
    assert.equal(parseCitation(contract, 'hello world'), undefined);
  });
});

describe('deep links', () => {
  it('builds and parses a compass lookup link', () => {
    const uri = buildDeepLink(contract, 'vistaCompass.lookup', {
      kind: 'rpc',
      key: 'ORWPT SELECT',
    });
    assert.equal(uri, 'vscode://vista-forge.vista-compass/lookup?kind=rpc&key=ORWPT%20SELECT');
    assert.deepEqual(parseDeepLink(contract, uri), {
      command: 'vistaCompass.lookup',
      target: 'compass',
      payload: { kind: 'rpc', key: 'ORWPT SELECT' },
    });
  });

  it('builds and parses an atlas section link', () => {
    const uri = buildDeepLink(contract, 'vistaAtlas.openSection', { section_id: 's-1' });
    assert.equal(uri, 'vscode://vista-forge.vista-atlas/openSection?section_id=s-1');
    assert.deepEqual(parseDeepLink(contract, uri), {
      command: 'vistaAtlas.openSection',
      target: 'atlas',
      payload: { section_id: 's-1' },
    });
  });

  it('openCitation needs an explicit target and works on both authorities', () => {
    assert.throws(
      () => buildDeepLink(contract, 'vista.openCitation', { text: 'vdocs://section/a' }),
      /target/,
    );
    for (const target of ['atlas', 'compass'] as const) {
      const uri = buildDeepLink(contract, 'vista.openCitation', { text: 'x' }, target);
      const parsed = parseDeepLink(contract, uri);
      assert.deepEqual(parsed, { command: 'vista.openCitation', target, payload: { text: 'x' } });
    }
  });

  it('round-trips an object param through JSON encoding', () => {
    const uri = buildDeepLink(contract, 'vistaAtlas.search', {
      query: 'kernel',
      filters: { app: 'XU' },
    });
    assert.deepEqual(parseDeepLink(contract, uri), {
      command: 'vistaAtlas.search',
      target: 'atlas',
      payload: { query: 'kernel', filters: { app: 'XU' } },
    });
  });

  it('rejects building a link with an invalid payload', () => {
    assert.throws(() => buildDeepLink(contract, 'vistaCompass.lookup', { kind: 'rpc' }), /key/);
  });

  it('rejects foreign schemes, authorities, and paths', () => {
    assert.throws(() => parseDeepLink(contract, 'https://example.com/lookup?kind=rpc'), /scheme/);
    assert.throws(
      () => parseDeepLink(contract, 'vscode://ms-python.python/lookup?kind=rpc'),
      /authority/,
    );
    assert.throws(
      () => parseDeepLink(contract, 'vscode://vista-forge.vista-compass/teleport?x=1'),
      /path/,
    );
  });
});

describe('releaseDriftProblems', () => {
  const inSync = {
    vdocs: { tag: 'data-v1', corpus_content_hash: 'a'.repeat(64) },
    vista_meta: { tag: 'data-v1', content_hash: 'b'.repeat(64) },
  };
  const own = { tag: 'data-v1', contentHash: 'b'.repeat(64) };
  const atlasLoaded = { tag: 'data-v1', corpus_content_hash: 'a'.repeat(64) };

  it('reports nothing when both twins match the bridge pin', () => {
    assert.deepEqual(releaseDriftProblems(inSync, own, atlasLoaded), []);
  });

  it('treats empty Atlas pins as not-yet-loaded, not drift', () => {
    // Atlas populates its pins only once its navigator panel opens; before
    // that vistaAtlas.pins returns empty strings — must not warn (the bug).
    assert.deepEqual(releaseDriftProblems(inSync, own, { tag: '', corpus_content_hash: '' }), []);
  });

  it('treats an absent Atlas pin response as not-yet-loaded', () => {
    assert.deepEqual(releaseDriftProblems(inSync, own, undefined), []);
  });

  it('flags a genuine Atlas tag mismatch with the real tag', () => {
    const problems = releaseDriftProblems(inSync, own, {
      tag: 'data-v0',
      corpus_content_hash: 'a'.repeat(64),
    });
    assert.deepEqual(problems, ['Atlas corpus data-v0 vs bridge pin data-v1']);
  });

  it('flags a genuine Atlas content-hash mismatch', () => {
    const problems = releaseDriftProblems(inSync, own, {
      tag: 'data-v1',
      corpus_content_hash: 'c'.repeat(64),
    });
    assert.deepEqual(problems, ['Atlas corpus_content_hash differs from the bridge pin']);
  });

  it('flags own-side drift independent of Atlas', () => {
    const problems = releaseDriftProblems(
      inSync,
      { tag: 'data-v0', contentHash: 'z'.repeat(64) },
      atlasLoaded,
    );
    assert.deepEqual(problems, [
      'own data data-v0 vs bridge pin data-v1',
      'own content_hash differs from the bridge pin',
    ]);
  });

  it('checks nothing when the bridge spec carries no pins', () => {
    assert.deepEqual(releaseDriftProblems({}, own, atlasLoaded), []);
  });
});
