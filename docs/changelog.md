# Build log — vista-compass

Chronological narrative of *why* the project got to its current shape.
Complements `git log` (which captures *what* per-commit) with rationale,
trade-offs, things tried and reverted, and explicit deferrals.

Update this whenever you land something non-trivial, before pushing.
`make log MSG="..."` appends a dated stub. Keep entries small — one
per landed change beats a monthly retrospective.

## How to read this log

Format conventions:

- Newest entries at the **bottom**. The chronological top-to-bottom
  flow tells the story of the project.
- Each entry: a `## YYYY-MM-DD — short title` heading.
- Useful sub-sections per entry:
  - **Done** — what shipped
  - **Tried and reverted** — approaches abandoned, with the reason
  - **Deferred** — things known-needed but consciously skipped
  - **Smoke results** — coverage %, perf number, or whatever metric
    the project gates on

The log is for *humans reading the project later*, including you in
six months. Don't summarise diffs — the diff is the diff. Focus on
*reasoning that isn't obvious from reading the code*.

---

## 2026-XX-XX — initial scaffold from ~/claude/templates/node

**Done:**

- Bootstrapped from the Node template.
- Working `greet()` with table-driven tests in `src/index.test.ts`.
- CI green on Node 22 + Node 24.

**Deferred:**

- (replace this section with real deferrals as the project grows)

## 2026-07-05 — P1: vista-store lib + twin-link contract v1 (Compass side)

**Done:**

- The embryonic `vista-store` shared lib (proposal §6), all TDD'd:
  read-only `node:sqlite` engine wrapper (`src/store/engine.ts`),
  streamed sha256/bytes verification, release records with the pinned
  `contracts/releases/vista-meta-data-v1.json`, `ensureAsset`
  fetch-and-verify from GitHub Releases (atomic install, idempotent
  skip), and the meta.db contract check (meta pins + full ai-manifest
  catalog + 6 join views — catalog is producer data, no hardcoded
  schemas).
- **Twin-link contract v1 frozen** (`contracts/twin-link.v1.json` +
  `src/twinlink.ts`): 10 §6.1 commands, vscode:// deep links, both
  citation formats, the 9 published bridge entity types. Ships in the
  package (`files` += contracts).
- Public API re-exported from `src/index.ts` (template `greet()` gone).
- Acceptance: real fetch of the published data-v1 derived assets
  (93 MB, 6.5 s), verified, opened; contract check OK; P0 spike queries
  reproduced through the lib. 70 unit tests + 1 real-db integration
  test; coverage ~98%.

**Decisions:**

- node:sqlite returns null-prototype rows — the wrapper copies to plain
  objects so consumers and `deepEqual` behave.
- `checkMetaDb` takes the catalog as an *input*: ai-manifest.json turned
  out not to be a published release asset yet (Track-P gap, recorded in
  the tracker); until the producer publishes it, callers load it from
  the vista-meta checkout.

**Deferred:**

- Atlas-side release consumption (vdocs index.db) — lands when
  vista-atlas starts; that also triggers extracting vista-store to a
  sibling repo.
- The VSCode extension harness itself — that is P3, next.

## 2026-07-05 — P3: Compass v2 MVP (0.2.0 parity on meta.db)

**Done:**

- Pure model layer, all TDD'd with the predecessor's bug classes as
  tests first: token grammar + §7.1 classification (incl. numeric
  tags and the `(`-forces-global rule), `analyze()` cross-join,
  `globalCard()` with the globalBase files→PIKS join, lookups, and
  markdown card renderers (vscode layer only wraps strings).
- Extension harness: mumps language id, Explorer sidebar
  (Header/Tags/Callers/Callees/Globals/XINDEX, zero-count hidden,
  XINDEX auto-expanded), Tier A hover set, activation that
  fetch-verifies the pinned release into globalStorage via vista-store
  (dataPath override for dev), vintage badge, esbuild CJS bundle,
  `npm run vsix` packaging.
- **Automated acceptance PASS**: `npm run test:vscode` drives the real
  installed VSCode 1.125.1 (P0 spike pattern) against the real db —
  activation + routine/global/tag hovers on the guide's PRCA45PT.

**Tried and fixed via the smoke run (worth the harness):**

- Importing the package root pulled twinlink's top-level
  `import.meta.url` into the CJS bundle → "Invalid URL" at extension
  load. Ext code now imports specific modules; the contract loader
  takes an explicit path.
- Numeric tags (`430`) weren't tokens, so the wireframe's tag hover
  was empty. Labels now allow digits; bare numeric literals stay quiet.

**Deferred:**

- Owner visual walkthrough against the §2.1 wireframe (formal P3 close).
- P4 surfaces (RPCs/options/protocols, dashboard, symbols, diagnostics).
