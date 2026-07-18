---
status: accepted
---

# Vista Compass v2 — implementation tracker

Live status of the phased build. Governing design:
[`vista-atlas-and-compass-de-novo.md`](https://github.com/rafael5/vista-meta/blob/main/docs/proposals/vista-atlas-and-compass-de-novo.md)
(vista-meta `docs/proposals/`; sequencing §8). Archive this file per the
org Tier-D rule when the effort lands.

This tracker records what has **landed**; the forward roadmap (remaining
Compass work, recommended new features, and the wider tool family) lives
in the [planning guide](guides/planning-guide.md).

## Phases (proposal §8)

| Phase | Work | Status |
|---|---|---|
| P0 | Engine spike → `node:sqlite` decision | ✅ done 2026-07-05 (recorded in proposal §11) |
| P1 | `vista-store` shared lib + twin-link contract v1 | ✅ **Compass side done 2026-07-05** — see below |
| P2 | Atlas MVP (vdocs-web parity) | ✅ landed in vista-atlas (installed + working, 2026-07-06) |
| P3 | Compass v2 MVP (0.2.0 parity on meta.db) | ✅ **CLOSED 2026-07-05** — automated acceptance PASS + owner walkthrough PASS |
| P4 | Full-scope surfaces (Compass side) | ✅ **landed 2026-07-05** — smoke spot-check PASS; owner visual check pending (Atlas P4 blocked on P-vdocs 1) |
| P5 | Twin-link features (Compass side) | ✅ **landed 2026-07-06, v0.4.0** — smoke PASS against the real twin; owner click-through pending |

## P1 — vista-store (started inside this repo per proposal §6)

Done (all TDD'd, gates green, pushed to `main`):

- [x] `src/store/engine.ts` — read-only `node:sqlite` wrapper (P0 decision);
      plain-object rows; better-sqlite3 remains the documented swap-in.
- [x] `src/store/verify.ts` — streamed sha256 + byte-count verification.
- [x] `src/store/release.ts` + `contracts/releases/vista-meta-data-v1.json` —
      pinned release record (repo/tag/per-file sha256, copied from the
      producer's `data-v1-derived.json`).
- [x] `src/store/fetch.ts` — `ensureAsset`: fetch-and-verify from GitHub
      Releases, atomic install, idempotent skip when verified.
- [x] `src/store/contract.ts` — meta.db contract check: `meta` pins +
      full ai-manifest catalog (24 tables/columns) + the 6 join views.
      Integration test runs against the real local db, skips elsewhere.
- [x] `contracts/twin-link.v1.json` + `src/twinlink.ts` — **contract v1
      frozen** (§6.1): 10 commands, URI scheme, both citation formats,
      the 9 published bridge entity types.
- [x] **Acceptance (Compass side):** real fetch of the published data-v1
      derived assets (93 MB db, 6.5 s), sha-verified, opened, contract
      check OK, P0 spike queries reproduced (`ORWPT SELECT`,
      `global:^DPT` bridge row, symbol prefix scan).

Remaining P1 (not this repo / producer side):

- [ ] **Atlas-side consumption** — vista-atlas pins the vdocs data-v1
      release record and fetch-verify-opens index.db through this lib
      ("both real releases" in the §8 acceptance). Lands when vista-atlas
      starts; triggers the vista-store extraction to a sibling repo.
- [ ] **Track P (P-vista-meta): publish `ai-manifest.json` as a data-v1
      derived release asset.** It is not currently on the release (not
      standalone, not in either tarball) — Compass reads the producer
      checkout copy for now, and `checkMetaDb` takes the catalog as an
      input. Producer fix: add it to `make derived-publish` + the
      `data-v1-derived.json` sidecar, then pin it in
      `contracts/releases/vista-meta-data-v1.json` here.

## P3 — Compass v2 MVP (landed 2026-07-05)

All TDD'd; the three predecessor bug classes were encoded as tests
FIRST (bare-vs-caret, `global_root` normalization, XINDEX
line-number-as-text), and the smoke run caught + fixed two more
(numeric tags `430`/`433` missing from the token grammar; the CJS
bundle breaking on a top-level `import.meta.url`).

- [x] Pure model layer (`src/model/`): globalBase / parseTags /
      token classification (§7.1 rules incl. the `(`-forces-global
      refinement and numeric labels); `analyze()` cross-join;
      `globalCard()` files→PIKS join; lookups; markdown card renderers.
- [x] Extension harness: engines.vscode ^1.125.0, mumps language id,
      `vistaCompassRoutine` Explorer view, refresh/reloadData commands,
      dataPath/vistaMHostPath/topN settings, esbuild → dist/extension.cjs.
      Activation fetch-verifies the pinned release into globalStorage
      (or dataPath override), contract-checks, shows the vintage badge.
- [x] Sidebar (Header/Tags/Callers/Callees/Globals/XINDEX; zero-count
      sections hidden; XINDEX auto-expanded; click-to-open incl.
      caller/callee navigation via vistaMHostPath) + the Tier A hover
      set (routine card + tag badge, tag entry-point card, `^GLOBAL` →
      FileMan → PIKS card).
- [x] **Automated acceptance PASS** (`npm run test:vscode`): smoke suite
      inside the installed VSCode 1.125.1 against the real data-v1 db —
      activation + all three hover cards on the guide's PRCA45PT.
- [x] `npm run vsix` → installable `vista-compass-0.1.0.vsix`.
- [x] **Owner visual walkthrough — PASSED 2026-07-05**: vsix installed,
      PRCA45PT.m verified against the §2.1 wireframe. (Required
      uninstalling the superseded `rafael5.vista-compass@0.2.0` — v2
      keeps its identifiers by design, so they cannot coexist.)

## P4 — Compass full-scope surfaces (landed 2026-07-05, v0.3.0)

All model queries TDD'd; ext layer stays a thin adapter; smoke
extended and PASS in the installed VSCode against the real release.

- [x] RPCs / Options / Protocols sidebar sections on the active routine
      (`surfaces.ts`: per-routine queries; protocols keyed by
      callee_routine with TAG^RTN labels).
- [x] Workspace pickers: `vistaCompass.findRpc` / `findOption`
      (prefix queries, capped 200) → open the implementing routine.
- [x] Package dashboard webview (`vistaCompass.packageDashboard`):
      namespace/prefixes/app_code/vdl_id, manifest stats, PIKS mix,
      couplings both directions, routine leaderboard — pure escaped
      HTML builder, tested.
- [x] Language features: outline (DocumentSymbol from parseTags),
      workspace symbols (NOCASE-indexed `xindex_tags` prefix query),
      go-to-definition for TAG^RTN (tag line parsed from the target
      host file — xindex_tags carries no line numbers), find-references
      for a tag at column 0 (callers scanned, capped 50).
- [x] XINDEX diagnostics behind `vistaCompass.xindexAsDiagnostics`
      (default off per internals §7.3; numeric-line findings only).
- [x] Bridge affordances: hover cards carry "documented in N docs"
      (`mentionCount`; bridge global ids KEEP the caret — encoded as a
      test) + per-file cross-PIKS / sensitive-fields drill-down
      (`fieldPiksForFile`).
- [x] **Smoke spot-check PASS** (§8 acceptance, machine-answer ↔ human
      counterpart): bridge mentions (XPDUTL 107 / ^PRCA 15 + File 430),
      outline tags, workspace symbols, definition into XPDUTL.m at the
      BMES tag, P4 commands registered. v0.3.0 vsix installed.
- [ ] Owner visual spot-check: reload window; try the RPC/option
      pickers, the package dashboard on PRCA45PT, outline/Ctrl+T
      symbols, Ctrl+Click a TAG^RTN, and (optionally) flip on
      `vistaCompass.xindexAsDiagnostics`.

Deferred (not in this phase): signature help (gated on the bake
extracting formals — Track P-vista-meta 2); hard twin-link features
(P5, needs vista-atlas); CodeLens/completion/status bar (Tier D).

## P5 — twin-link features (Compass side, landed 2026-07-06, v0.4.0)

Atlas's live seam (verified read-only in its repo): `vistaAtlas.search
/ openDoc / openSection / pins` + URI handler, vendoring our
contract artifact. `vistaAtlas.openEntity` / `vista.openCitation` not
yet (its entity tier is P4-gated) — Compass degrades per §6.1.

- [x] Compass contract-v1 surface: `vistaCompass.lookup / openEntity /
      search / pins`, `vista.openCitation` (registered defensively —
      implementedBy both; first registration wins), vscode:// URI
      handler.
- [x] Cross-jumps: hover "documented in N docs → Atlas" command link —
      `vistaAtlas.openEntity` when the twin ships it, degrading to
      `vistaAtlas.search`; affordance hidden when the twin is absent.
      Hover markdown trust scoped to our two commands.
- [x] Seeded search handoff: `vistaCompass.search` combined picker
      (routines/tags/RPCs/options) with the one footer row into Atlas
      docs search; editor right-click "Find in Docs".
- [x] Citation routing: `vista.openCitation` parses both formats —
      vista-meta citations open the measured source (tsv→kind map),
      vdocs citations forward to `vistaAtlas.openSection`.
- [x] Gate-R mutual-pin handshake on activation: own meta pins and the
      twin's `vistaAtlas.pins` compared against the
      `entity-bridge.meta.json` pin pair (fetch-verified as a pinned
      release asset); warns on release-pair drift. Drift decision is the
      pure, unit-tested `releaseDriftProblems()`; empty Atlas pins (twin
      not yet panel-opened) are treated as not-loaded, not drift, so no
      spurious warning fires at activation (fixed dd9fdec, 2026-07-06).
- [x] Copy-citation on routine/global hover cards — the exact contract
      line, bridge row preferred (`citationFor`, TDD'd).
- [x] **Smoke PASS with the REAL Atlas twin** (scratch extensions dir
      symlinking only the twin): pins shape, cross-jump links,
      citation routing into XPDUTL.m. 186 unit tests, coverage ~99%.
- [ ] Owner click-through: hover a routine → "documented in N docs →
      Atlas" lands in Atlas doc search; "copy citation"; palette
      "Search Measured Model" footer row; right-click "Find in Docs".

Remaining for FULL §6.1 (Atlas-side work, their repo): Atlas registers
`vistaAtlas.openEntity` + `vista.openCitation` fallback + its own
seeded footer row into `vistaCompass.search`; then the Compass
cross-jump automatically upgrades from search to entity pages.
