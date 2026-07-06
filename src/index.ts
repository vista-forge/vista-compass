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
  type ContractExpectation,
  type ContractReport,
  checkMetaDb,
  META_DB_VIEWS,
  type MetaDbCatalog,
  tsvTableName,
} from './store/contract.js';
export { openStore, type SqlRow, type SqlValue, type Store } from './store/engine.js';
export {
  type EnsureAssetOptions,
  type EnsureAssetResult,
  ensureAsset,
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
  type VerifyResult,
  verifyFile,
} from './store/verify.js';
export {
  buildDeepLink,
  type Citation,
  type CommandSpec,
  loadTwinLinkContract,
  type ParamSpec,
  type ParsedDeepLink,
  parseCitation,
  parseDeepLink,
  type Target,
  type TwinLinkContract,
  type ValidationResult,
  validatePayload,
} from './twinlink.js';
