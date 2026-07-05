/**
 * In-repo release records — the pinned (repo, tag, per-file sha256)
 * descriptions of the published data releases Compass consumes
 * (proposal §3.1). Records live under contracts/releases/ and are the
 * only authority the fetcher trusts.
 */

import { readFileSync } from 'node:fs';
import type { ExpectedFile } from './verify.ts';

export interface ReleaseRecord {
  /** GitHub owner/name, e.g. "rafael5/vista-meta". */
  readonly repo: string;
  /** Release tag the assets are published under, e.g. "data-v1". */
  readonly tag: string;
  /** Producer content hash of the release, when the record carries one. */
  readonly content_hash?: string;
  /** Pinned assets by exact asset filename. */
  readonly files: Readonly<Record<string, ExpectedFile>>;
}

function fail(detail: string): never {
  throw new Error(`release record: ${detail}`);
}

/** Validate an untrusted value into a ReleaseRecord, or throw. */
export function parseReleaseRecord(input: unknown): ReleaseRecord {
  if (typeof input !== 'object' || input === null) {
    fail('not an object');
  }
  const record = input as Record<string, unknown>;
  if (typeof record.repo !== 'string' || record.repo.length === 0) {
    fail('missing repo');
  }
  if (typeof record.tag !== 'string' || record.tag.length === 0) {
    fail('missing tag');
  }
  if (typeof record.files !== 'object' || record.files === null) {
    fail('missing files');
  }
  const files: Record<string, ExpectedFile> = {};
  for (const [name, entry] of Object.entries(record.files)) {
    if (typeof entry !== 'object' || entry === null) {
      fail(`file ${name}: not an object`);
    }
    const { bytes, sha256 } = entry as Record<string, unknown>;
    if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes < 0) {
      fail(`file ${name}: bytes must be a non-negative integer`);
    }
    if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
      fail(`file ${name}: sha256 must be 64 lowercase hex chars`);
    }
    files[name] = { bytes, sha256 };
  }
  if (Object.keys(files).length === 0) {
    fail('files is empty');
  }
  const contentHash = record.content_hash;
  return {
    repo: record.repo,
    tag: record.tag,
    ...(typeof contentHash === 'string' ? { content_hash: contentHash } : {}),
    files,
  };
}

/** Read and validate a release record file. */
export function loadReleaseRecord(path: string): ReleaseRecord {
  return parseReleaseRecord(JSON.parse(readFileSync(path, 'utf8')));
}

/** GitHub release download URL for a pinned asset. */
export function assetUrl(record: ReleaseRecord, name: string): string {
  if (!(name in record.files)) {
    throw new Error(`release record: asset not pinned: ${name}`);
  }
  return `https://github.com/${record.repo}/releases/download/${record.tag}/${encodeURIComponent(name)}`;
}
