import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { assetUrl, loadReleaseRecord, parseReleaseRecord } from './release.ts';

const VALID = {
  repo: 'rafael5/vista-meta',
  tag: 'data-v1',
  content_hash: 'abc123',
  files: {
    'vista-meta-data-v1.db': { bytes: 93822976, sha256: '4'.repeat(64) },
    'entity-bridge.meta.json': { bytes: 4043, sha256: '9'.repeat(64) },
  },
};

describe('parseReleaseRecord', () => {
  it('accepts a valid record', () => {
    const record = parseReleaseRecord(VALID);
    assert.equal(record.repo, 'rafael5/vista-meta');
    assert.equal(record.tag, 'data-v1');
    assert.equal(record.files['vista-meta-data-v1.db']?.bytes, 93822976);
  });

  const badCases: ReadonlyArray<{ readonly name: string; readonly input: unknown }> = [
    { name: 'null', input: null },
    { name: 'missing repo', input: { ...VALID, repo: undefined } },
    { name: 'missing tag', input: { ...VALID, tag: undefined } },
    { name: 'missing files', input: { ...VALID, files: undefined } },
    { name: 'empty files', input: { ...VALID, files: {} } },
    {
      name: 'file entry without sha256',
      input: { ...VALID, files: { 'a.db': { bytes: 1 } } },
    },
    {
      name: 'file entry with non-numeric bytes',
      input: { ...VALID, files: { 'a.db': { bytes: 'big', sha256: '4'.repeat(64) } } },
    },
    {
      name: 'file entry with malformed sha256',
      input: { ...VALID, files: { 'a.db': { bytes: 1, sha256: 'not-hex' } } },
    },
  ];

  for (const tc of badCases) {
    it(`rejects ${tc.name}`, () => {
      assert.throws(() => parseReleaseRecord(tc.input), /release record/);
    });
  }
});

describe('assetUrl', () => {
  const record = parseReleaseRecord(VALID);

  it('builds the GitHub release download URL', () => {
    assert.equal(
      assetUrl(record, 'vista-meta-data-v1.db'),
      'https://github.com/rafael5/vista-meta/releases/download/data-v1/vista-meta-data-v1.db',
    );
  });

  it('throws for an asset not pinned in the record', () => {
    assert.throws(() => assetUrl(record, 'rogue.db'), /not pinned/);
  });
});

describe('the committed vista-meta data-v1 record', () => {
  it('parses and pins the meta.db + bridge-spec assets', () => {
    const record = loadReleaseRecord(
      new URL('../../contracts/releases/vista-meta-data-v1.json', import.meta.url).pathname,
    );
    assert.equal(record.repo, 'rafael5/vista-meta');
    assert.equal(record.tag, 'data-v1');
    for (const name of ['vista-meta-data-v1.db', 'entity-bridge.meta.json']) {
      const entry = record.files[name];
      assert.ok(entry, `missing pinned asset: ${name}`);
      assert.match(entry.sha256, /^[0-9a-f]{64}$/);
      assert.ok(entry.bytes > 0);
    }
  });
});
