import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { sha256File, verifyFile } from './verify.ts';

const CONTENT = 'measured, not remembered\n';
const CONTENT_SHA = createHash('sha256').update(CONTENT).digest('hex');

describe('sha256File', () => {
  let dir: string;
  let filePath: string;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'vista-verify-'));
    filePath = join(dir, 'asset.txt');
    writeFileSync(filePath, CONTENT);
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('computes the hex digest of a file', async () => {
    assert.equal(await sha256File(filePath), CONTENT_SHA);
  });

  it('rejects for a missing file', async () => {
    await assert.rejects(sha256File(join(dir, 'absent.txt')));
  });
});

describe('verifyFile', () => {
  let dir: string;
  let filePath: string;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'vista-verify-'));
    filePath = join(dir, 'asset.txt');
    writeFileSync(filePath, CONTENT);
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const expected = { sha256: CONTENT_SHA, bytes: CONTENT.length };

  it('passes when sha256 and bytes both match', async () => {
    const result = await verifyFile(filePath, expected);
    assert.deepEqual(result, { ok: true, path: filePath });
  });

  it('fails on byte-count mismatch without hashing lying about the reason', async () => {
    const result = await verifyFile(filePath, { ...expected, bytes: 1 });
    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.reason, /bytes/);
  });

  it('fails on sha mismatch', async () => {
    const result = await verifyFile(filePath, { ...expected, sha256: '0'.repeat(64) });
    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.reason, /sha256/);
  });

  it('fails (not throws) when the file is missing', async () => {
    const result = await verifyFile(join(dir, 'absent.txt'), expected);
    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.reason, /missing/);
  });
});
