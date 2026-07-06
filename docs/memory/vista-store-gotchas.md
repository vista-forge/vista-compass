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

- **CJS bundle vs `import.meta.url`:** the extension bundles to
  CommonJS (`dist/extension.cjs` — the extension host requires CJS,
  and `"type": "module"` makes plain `.js` ESM). Any module-top-level
  `import.meta.url` becomes `undefined` in that bundle and crashes at
  LOAD time ("Invalid URL") — keep such code lazy and path-injectable,
  and have ext code import specific modules, never the package root.
- **The in-VSCode smoke is the real gate for ext code:**
  `npm run test:vscode` (installed-binary @vscode/test-electron, no
  download) caught both the bundle crash and the numeric-tag grammar
  gap that 148 unit tests could not.

- **v2 cannot coexist with the 0.2.0 predecessor:** it deliberately
  keeps the same view id (`vistaCompassRoutine`), command ids, and
  settings keys (with different `dataPath` semantics: dir vs meta.db
  file) — duplicate registration breaks whichever activates second.
  `rafael5.vista-compass@0.2.0` was uninstalled 2026-07-05; never
  reinstall it alongside v2. Also: a CLI `--install-extension` is
  invisible to an already-open window until Reload Window.

- **Toolchain majors need config migration (Biome 2 / TS 6):** a
  dependabot bump alone red-gates. Biome 2 drops `noConsoleLog` etc. —
  run `npx biome migrate --write` (also enables assist/organizeImports;
  expect a one-time import-order sweep). TypeScript 6 no longer
  auto-includes `@types/*` — add `"types": ["node", "vscode"]` to
  tsconfig `compilerOptions`. Same medicine applies to vista-atlas
  (same template).

- **Twin-seam runtime rules:** a command `implementedBy: both` in the
  contract (vista.openCitation) must be registered defensively
  (getCommands check + try/catch) — VSCode crashes the second
  registrant. Smoke with the twin: symlink ONLY the twin into a
  scratch `--extensions-dir`; pointing at the real extensions dir
  loads foreign MUMPS extensions that clash (duplicate commands,
  competing definition providers).

- **All routine-source navigation needs `vistaCompass.vistaMHostPath`:**
  meta.db carries only container-side `source_path`s
  (`/opt/VistA-M/…`), so *nothing* can open a routine's source without
  the host mirror configured — callee/caller sidebar clicks,
  go-to-definition, find-references, workspace symbols, and the
  find-RPC/option pickers all resolve through
  `resolveSourcePath` → host root. When it's unset the right UX is a
  one-time "set vistaMHostPath" hint, never a silent dead-click (the
  bug fixed 2026-07-06, v0.4.1). Tree-item nav commands resolve
  **lazily** via the registered `vistaCompass.openRoutine` (args carry
  `{routine, tag}`) — do NOT read target files eagerly per sidebar
  render. Callee rows pass their `tag` so the jump lands on the
  `TAG^RTN` entry point, like a Tags-row jump.

**Why:** all of these bit during P1/P3 (red gates / failed runs).
**How to apply:** don't "fix" the row-copy in engine.ts as an
optimization without re-running the deepEqual tests; when adding a new
src module, write `.js` specifiers even though sibling test files say
`.ts`.

Design invariant worth keeping: `checkMetaDb` takes the ai-manifest
catalog as an **input** — never hardcode the schema in this repo
(proposal §3.2); the catalog's acquisition path changes when the
producer publishes ai-manifest.json as a release asset (tracked in
[[../compass-v2-tracker.md]] → actually see `docs/compass-v2-tracker.md`).
