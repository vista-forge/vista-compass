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

## 2026-07-05 — P3 formally closed: owner walkthrough PASS

vsix installed and verified against the guide §2.1 wireframe on the
real window. Two install-time findings: an already-open window needs a
reload to see a CLI-installed extension, and the superseded 0.2.0
predecessor had to be uninstalled — v2 keeps its view/command/settings
identifiers by design, so the two cannot coexist (recorded in memory).
Next: P4 surfaces.

## 2026-07-05 — P4: full-scope surfaces (v0.3.0)

**Done:** RPCs/Options/Protocols sidebar sections; findRpc/findOption
pickers; package dashboard webview (tested pure-HTML builder); outline
+ workspace symbols (NOCASE tag index) + go-to-definition (tag line
parsed from target source — xindex_tags has no line numbers) +
find-references (callers scanned, capped); XINDEX diagnostics
(setting-gated, default off); hover cards gained "documented in N
docs" from the entity bridge (global ids keep the caret — new
bare-vs-caret variant, TDD'd) and the field-PIKS drill-down. Smoke
extended: 8 end-to-end checks PASS in the installed VSCode against the
real release. Version 0.3.0 (predecessor froze at 0.2.0).

**Deferred:** signature help (needs bake formals, Track P-vm 2); P5
twin-link features (needs vista-atlas); Tier D (CodeLens, completion,
status bar).

## 2026-07-06 — toolchain bump: Biome 2.5, TypeScript 6, @types/node 26, c8 11

Landed directly on main (supersedes dependabot PR #4, which failed CI
on the Biome 2 config schema). Migration: `biome migrate --write`
(new schema, assist/organizeImports — one-time import-order sweep over
12 files) and an explicit tsconfig `types: [node, vscode]` (TS 6
stopped auto-including @types). Full gate + in-VSCode smoke green.

## 2026-07-06 — P5: twin-link features, Compass side (v0.4.0)

The seam is live against the real Atlas twin: Compass's contract-v1
command surface + URI handler; hover cross-jumps ("documented in N
docs → Atlas", degrading to Atlas search until its entity tier lands);
seeded search handoff (combined measured-model picker with the one
footer row into docs search + right-click "Find in Docs");
vista.openCitation routing both citation formats; the Gate-R pin
handshake against entity-bridge.meta.json; copy-citation everywhere
(bridge-row-preferred contract lines). Smoke now symlinks ONLY the
installed twin into a scratch extensions dir — full-real-extensions-dir
runs picked up foreign MUMPS extensions and broke assertions.
vista.openCitation is registered defensively (implementedBy both twins;
duplicate registration would crash whichever activates second).
