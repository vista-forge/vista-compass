# Claude Project Context

## What this project is
**Vista Compass v2** — a VSCode extension over the **vista-meta data release**
(what the VistA system measurably *is*): routine sidebar + hovers (0.2.0
parity), then RPCs/options/protocols first-class, package dashboard, workspace
symbols/definition/references from the measured call graph, XINDEX
diagnostics, and bridge-powered "documented in N docs" jumps into its twin
`~/vista-forge/vista-atlas`. **Governing design:**
`~/projects/vista-meta/docs/proposals/vista-atlas-and-compass-de-novo.md`
(read it before any structural work — sequencing P1→P5, Track-P producer
prerequisites, deep-link contract). Engine decision (P0, recorded there §11):
**`node:sqlite`** — extension host ≥ VSCode 1.125 (Node 24), FTS5 in-box, no
native deps; wrap it behind the store interface. Data = **meta.db** (85 MB
generated SQLite projection; `make meta-db` in vista-meta, release asset at
the next data tag) + `ai-manifest.json` as the self-describing catalog; TSVs
stay the model of record. Predecessor: `vista-meta/vscode-extension/` (0.2.0,
frozen at parity per the proposal). **Org note:** non-waterline repo (no
`m`/`v` layer artifact — it never touches an engine); per-repo memory lives in
`docs/memory/` per `~/vista-forge/CLAUDE.md`, and the org increment protocol
applies.

## Dev workflow
```bash
make install     # npm install + install simple-git-hooks pre-commit/pre-push
make test        # node --test (built-in runner) — fast inner loop
make test-watch  # TDD mode: re-runs tests on file save
make test-cov    # coverage with c8 (lcov + summary)
make lint        # biome check (linter)
make format      # biome format --write (auto-format)
make fix         # biome check --write (lint + format + safe fixes)
make typecheck   # tsc --noEmit (no JS emitted, types only)
make audit       # npm audit (high+ severity blocks)
make check       # lint + typecheck + test-cov + audit (full gate, same as CI)
make build       # tsc → dist/
make run         # node --import tsx src/index.ts (dev run, no build)
make log MSG="…" # append a dated entry to docs/changelog.md
make push        # check + git push origin main
make pull        # git pull origin main
```

## Environment
- **Node.js ≥ 22** (pinned in `.node-version`; matches the `engines.node` field in `package.json`)
- **TypeScript** for source. `tsx` (dev-dep) runs `.ts` directly under Node so the test runner doesn't need a build step.
- **Biome** is the single tool for linting AND formatting (no ESLint, no Prettier — one Rust-based tool, one config file).
- **`node:test`** (Node's built-in test runner) is the test framework. No Vitest, no Jest. Tests live next to source: `src/foo.ts` ↔ `src/foo.test.ts`.
- **`c8`** for coverage (one binary that wraps the runner; no instrumentation step).
- **`simple-git-hooks`** for pre-commit / pre-push. Zero deps, defined inline in `package.json`.

## Adding a dependency
```bash
# Runtime dep
npm install --save some-package
# Dev dep
npm install --save-dev some-package
# Both package.json AND package-lock.json must be committed together.
```

## Project structure
```
src/
  index.ts           # public API entry — `export` what consumers should see
  index.test.ts      # tests next to code (Node convention with built-in runner)
  <module>.ts        # sibling modules; one concern per file
  <module>.test.ts
docs/
  changelog.md       # chronological per-feature notes (see "Build log" below)
dist/                # tsc output (gitignored)
```

For CLI projects, add `src/cli.ts` with a `#!/usr/bin/env node` shebang, declare `"bin"` in `package.json`, and call into the library from `src/index.ts`. Don't put logic in the CLI file.

## Testing conventions
- Write the test first (TDD)
- Tests live next to the code they test (`foo.ts` ↔ `foo.test.ts`)
- Use **table-driven** tests with `describe` + `for (const tc of cases) it(...)` — see `src/index.test.ts` for the canonical idiom
- Use `node:test`'s `describe`/`it` (not `test()` directly — `describe` groups related cases)
- `assert.equal` / `assert.deepEqual` / `assert.throws` from `node:assert/strict`
- `t.mock.method()` for mocking — built-in, no library needed. Prefer fakes over mocks (small interfaces, hand-rolled stubs)
- Async tests just `return` a promise or take `async` — `node:test` handles both
- Coverage minimum: 80% (enforced via `c8`'s `check-coverage` flag in `package.json` if you want it strict; `make check` reports without failing)

## Code style
- Format + lint: `biome` only. Pre-commit hook runs `biome check`.
- Indent: 2 spaces. Single quotes. Trailing commas everywhere. Always semicolons.
- Line length: 100. No bikeshed.
- Imports: `node:` protocol prefix for builtins (`import { strict as assert } from 'node:assert'`). Biome enforces this.
- ESM only (`"type": "module"`). No CommonJS in new code. Use `.ts` import paths in tests (`import { greet } from './index.ts'`); Biome's `verbatimModuleSyntax` keeps the runtime semantics correct.
- `noUncheckedIndexedAccess` is on — you'll see `T | undefined` for array/object subscript access. Live with it; it catches real bugs.
- No `any`. Use `unknown` if you genuinely don't know the type.
- No `console.log` in library code — Biome warns. For CLI/scripts, use `process.stdout.write` or a logger (pino is a good lightweight choice when one is needed).

## Git conventions
- Main branch: `main`
- **Pre-commit hook**: `biome check` + `tsc --noEmit`. Push fails if the hook fails.
- **Pre-push hook**: `npm run test:cov`. Push fails on test failure or coverage drop.
- **`make push`** runs the full `check` gate (lint + typecheck + test-cov + audit) before pushing.
- Commit messages: short imperative ("add retry logic", "fix timeout bug")
- Always commit `package-lock.json` alongside `package.json` changes.

## Incremental git pushes
- Push **after every green check**, not after a session's worth of work.
- A "green check" is `make check` returning rc=0.
- Each commit should be a self-contained logical step that compiles, lints, types, tests, and (when possible) leaves the project demonstrably better.
- Small commits + `make push` after each one means CI catches regressions in minutes, not hours, and rebases / cherry-picks stay easy.

## Build log
The project keeps a chronological narrative at `docs/changelog.md` —
per-feature notes, decisions made during implementation, and any drift
from the spec or roadmap. Update it whenever you land something
non-trivial, before pushing. Cheap entries beat lost context.

```bash
make log MSG="add greet() with TDD-driven tests; baseline coverage 91%"
git add docs/changelog.md
git commit -m "docs: log greet() landing"
```

The log is for *humans reading the project later* — including you in
six months. Each entry: what changed, what you tried/reverted, what's
deferred. Don't summarise diffs; the diff is the diff.

## Debugging
```bash
node --import tsx --test --test-name-pattern='regex' 'src/foo.test.ts'  # one test
node --import tsx --inspect-brk src/index.ts                            # debugger via chrome://inspect
```
For ad-hoc tracing, use `console.error` (goes to stderr, doesn't pollute stdout) or `process.stderr.write`. Production logging should go through `pino` or `slog`-equivalent — never `console.log`.

## Claude guidelines
- Prefer editing existing files over creating new ones.
- Keep functions small and independently testable.
- No mocks of types you don't own — define small interfaces at the consumer.
- This is a small hobbyist project — keep solutions simple and direct.
- See `node-dev-guide.md` for the full set of practices this template implements.
