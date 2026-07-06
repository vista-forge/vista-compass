import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ensureAsset } from './fetch.ts';
import { parseReleaseRecord } from './release.ts';

const BODY = 'the published asset body\n';

function record() {
  return parseReleaseRecord({
    repo: 'rafael5/vista-meta',
    tag: 'data-v1',
    files: {
      'asset.bin': {
        bytes: BODY.length,
        sha256: createHash('sha256').update(BODY).digest('hex'),
      },
    },
  });
}

/** Fake fetch that records calls and serves canned bodies per URL. */
function fakeFetch(status: number, body: string) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(status === 200 ? body : 'nope', {
      status,
      statusText: status === 200 ? 'OK' : 'Not Found',
    });
  }) as typeof fetch;
  return { calls, impl };
}

describe('ensureAsset', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vista-fetch-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('downloads, verifies, and installs a missing asset', async () => {
    const { calls, impl } = fakeFetch(200, BODY);
    const result = await ensureAsset({
      record: record(),
      name: 'asset.bin',
      destDir: join(dir, 'store'),
      fetchImpl: impl,
    });
    assert.equal(result.status, 'downloaded');
    assert.equal(readFileSync(result.path, 'utf8'), BODY);
    assert.deepEqual(calls, [
      'https://github.com/rafael5/vista-meta/releases/download/data-v1/asset.bin',
    ]);
  });

  it('skips the download when the asset is already present and verified', async () => {
    const { calls, impl } = fakeFetch(200, BODY);
    const destDir = join(dir, 'store');
    await ensureAsset({ record: record(), name: 'asset.bin', destDir, fetchImpl: impl });
    const again = await ensureAsset({
      record: record(),
      name: 'asset.bin',
      destDir,
      fetchImpl: impl,
    });
    assert.equal(again.status, 'already-verified');
    assert.equal(calls.length, 1);
  });

  it('re-downloads over a corrupted local copy', async () => {
    const { impl } = fakeFetch(200, BODY);
    const destDir = join(dir, 'store');
    const first = await ensureAsset({
      record: record(),
      name: 'asset.bin',
      destDir,
      fetchImpl: impl,
    });
    writeFileSync(first.path, 'corrupted');
    const repaired = await ensureAsset({
      record: record(),
      name: 'asset.bin',
      destDir,
      fetchImpl: impl,
    });
    assert.equal(repaired.status, 'downloaded');
    assert.equal(readFileSync(repaired.path, 'utf8'), BODY);
  });

  it('throws on a non-200 response and installs nothing', async () => {
    const { impl } = fakeFetch(404, '');
    const destDir = join(dir, 'store');
    await assert.rejects(
      ensureAsset({ record: record(), name: 'asset.bin', destDir, fetchImpl: impl }),
      /404/,
    );
    assert.ok(!existsSync(join(destDir, 'asset.bin')));
  });

  it('throws when the downloaded bytes fail verification, leaving no partial file', async () => {
    const { impl } = fakeFetch(200, 'tampered body of the same-ish size');
    const destDir = join(dir, 'store');
    await assert.rejects(
      ensureAsset({ record: record(), name: 'asset.bin', destDir, fetchImpl: impl }),
      /mismatch/,
    );
    assert.deepEqual(readdirSync(destDir), []);
  });

  it('rejects an asset name that is not pinned in the record', async () => {
    const { impl } = fakeFetch(200, BODY);
    await assert.rejects(
      ensureAsset({ record: record(), name: 'rogue.bin', destDir: dir, fetchImpl: impl }),
      /not pinned/,
    );
  });
});
