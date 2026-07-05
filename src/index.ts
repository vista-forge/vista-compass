/**
 * vista-compass — VSCode extension over the vista-meta data release
 * (meta.db): what the VistA system measurably IS.
 *
 * This package root currently exports the embryonic **vista-store**
 * shared library (proposal §6): the node:sqlite engine wrapper, release
 * fetch/verify, the meta.db contract check, and the twin-link contract
 * v1 seam. It extracts to a sibling repo when vista-atlas consumes it.
 */

export {
  checkMetaDb,
  type ContractExpectation,
  type ContractReport,
  META_DB_VIEWS,
  type MetaDbCatalog,
  tsvTableName,
} from './store/contract.js';
export { openStore, type SqlRow, type SqlValue, type Store } from './store/engine.js';
export {
  ensureAsset,
  type EnsureAssetOptions,
  type EnsureAssetResult,
} from './store/fetch.js';
export {
  assetUrl,
  loadReleaseRecord,
  parseReleaseRecord,
  type ReleaseRecord,
} from './store/release.js';
export {
  type ExpectedFile,
  sha256File,
  verifyFile,
  type VerifyResult,
} from './store/verify.js';
export {
  buildDeepLink,
  type Citation,
  type CommandSpec,
  loadTwinLinkContract,
  type ParamSpec,
  parseCitation,
  parseDeepLink,
  type ParsedDeepLink,
  type Target,
  type TwinLinkContract,
  validatePayload,
  type ValidationResult,
} from './twinlink.js';
