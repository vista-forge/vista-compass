/**
 * Fetch-and-verify of published release assets (proposal §3.1 / §6
 * "Distribution"): download from GitHub Releases into a destination
 * directory (the extension's globalStorage in production), verify
 * sha256 + size against the in-repo release record, install atomically.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { assetUrl, type ReleaseRecord } from './release.js';
import { verifyFile } from './verify.js';

export interface EnsureAssetOptions {
  readonly record: ReleaseRecord;
  /** Asset filename, as pinned in the record. */
  readonly name: string;
  /** Directory the verified asset is installed into. */
  readonly destDir: string;
  /** Injectable for tests; defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
}

export interface EnsureAssetResult {
  readonly path: string;
  readonly status: 'already-verified' | 'downloaded';
}

/**
 * Make sure a pinned asset exists, verified, at destDir/name.
 * Present + verified → no network. Missing or failing verification →
 * download to a .part file, verify, then atomically rename into place.
 * A download that fails verification is deleted and reported by throw.
 */
export async function ensureAsset(options: EnsureAssetOptions): Promise<EnsureAssetResult> {
  const { record, name, destDir } = options;
  const url = assetUrl(record, name); // throws for unpinned names
  const expected = record.files[name];
  if (expected === undefined) {
    throw new Error(`release record: asset not pinned: ${name}`);
  }
  const dest = join(destDir, name);

  const existing = await verifyFile(dest, expected);
  if (existing.ok) {
    return { path: dest, status: 'already-verified' };
  }

  await mkdir(destDir, { recursive: true });
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url);
  if (!response.ok || response.body === null) {
    throw new Error(`fetch ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  const part = `${dest}.part`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(part));
    const verified = await verifyFile(part, expected);
    if (!verified.ok) {
      throw new Error(`fetch ${url}: downloaded asset failed verification — ${verified.reason}`);
    }
    await rename(part, dest);
  } catch (err) {
    await rm(part, { force: true });
    throw err;
  }
  return { path: dest, status: 'downloaded' };
}
