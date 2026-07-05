import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import * as api from './index.ts';

describe('public API surface (vista-store)', () => {
  // The embryonic vista-store lib (proposal §6): everything a consumer
  // (this extension, later vista-atlas) needs is re-exported from the
  // package root. A name disappearing from here is a breaking change.
  const exported: readonly string[] = [
    // engine
    'openStore',
    // verify
    'sha256File',
    'verifyFile',
    // release records
    'parseReleaseRecord',
    'loadReleaseRecord',
    'assetUrl',
    // fetch
    'ensureAsset',
    // meta.db contract
    'checkMetaDb',
    'tsvTableName',
    'META_DB_VIEWS',
    // twin-link contract v1
    'loadTwinLinkContract',
    'validatePayload',
    'parseCitation',
    'buildDeepLink',
    'parseDeepLink',
  ];

  for (const name of exported) {
    it(`exports ${name}`, () => {
      assert.ok(name in api, `missing export: ${name}`);
    });
  }
});
