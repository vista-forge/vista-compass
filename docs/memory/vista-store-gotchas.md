---
name: vista-store-gotchas
description: Durable gotchas from building the vista-store lib (P1) — node:sqlite rows, ts/js import split, catalog-as-input
metadata:
  type: project
---

Durable lessons from the P1 vista-store build (2026-07-05):

- **`node:sqlite` rows are null-prototype objects.** `assert.deepEqual`
  against object literals fails on the prototype, and consumers get
  surprising objects. The engine wrapper (`src/store/engine.ts`) copies
  every row to a plain object — keep that invariant if the wrapper is
  ever reworked or swapped to better-sqlite3.
- **Import-extension split in this template:** non-test sources must use
  `.js` specifiers (`from './release.js'`) because tsc has no
  `allowImportingTsExtensions`; test files may use `.ts` only because
  tsconfig *excludes* `**/*.test.ts` from typecheck (tsx resolves both
  at runtime). Type-ONLY `.ts` imports also pass (erased). A standalone
  script outside the repo needs an `.mts` extension for tsx to treat it
  as ESM.

**Why:** both bit during P1 (red gates / failed acceptance run).
**How to apply:** don't "fix" the row-copy in engine.ts as an
optimization without re-running the deepEqual tests; when adding a new
src module, write `.js` specifiers even though sibling test files say
`.ts`.

Design invariant worth keeping: `checkMetaDb` takes the ai-manifest
catalog as an **input** — never hardcode the schema in this repo
(proposal §3.2); the catalog's acquisition path changes when the
producer publishes ai-manifest.json as a release asset (tracked in
[[../compass-v2-tracker.md]] → actually see `docs/compass-v2-tracker.md`).
