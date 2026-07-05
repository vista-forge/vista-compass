/**
 * Integrity checks for fetched release assets — sha256 + byte count
 * against the in-repo release records (proposal §3.1: fetch-and-verify,
 * never trust an unverified artifact).
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

export interface ExpectedFile {
  /** Hex-encoded sha256 digest, as recorded in the release record. */
  readonly sha256: string;
  /** Exact file size in bytes. */
  readonly bytes: number;
}

export type VerifyResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly path: string; readonly reason: string };

/** Stream a file through sha256 and return the hex digest. */
export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

/**
 * Verify a file against its release-record entry. Size is checked first
 * (cheap) so a truncated download is reported as such without hashing.
 * Returns a result object rather than throwing: a failed verification is
 * an expected outcome, not a programming error.
 */
export async function verifyFile(path: string, expected: ExpectedFile): Promise<VerifyResult> {
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return { ok: false, path, reason: `missing: ${path}` };
  }
  if (size !== expected.bytes) {
    return { ok: false, path, reason: `bytes mismatch: expected ${expected.bytes}, got ${size}` };
  }
  const digest = await sha256File(path);
  if (digest !== expected.sha256) {
    return {
      ok: false,
      path,
      reason: `sha256 mismatch: expected ${expected.sha256}, got ${digest}`,
    };
  }
  return { ok: true, path };
}
