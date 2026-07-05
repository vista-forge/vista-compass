# Vista Compass v2 — implementation tracker

Live status of the phased build. Governing design:
[`vista-atlas-and-compass-de-novo.md`](https://github.com/rafael5/vista-meta/blob/main/docs/proposals/vista-atlas-and-compass-de-novo.md)
(vista-meta `docs/proposals/`; sequencing §8). Archive this file per the
org Tier-D rule when the effort lands.

## Phases (proposal §8)

| Phase | Work | Status |
|---|---|---|
| P0 | Engine spike → `node:sqlite` decision | ✅ done 2026-07-05 (recorded in proposal §11) |
| P1 | `vista-store` shared lib + twin-link contract v1 | ✅ **Compass side done 2026-07-05** — see below |
| P2 | Atlas MVP (vdocs-web parity) | not started (vista-atlas repo) |
| P3 | Compass v2 MVP (0.2.0 parity on meta.db) | next up in this repo |
| P4 | Full-scope surfaces | blocked on P3 (+ P-vdocs 1 for Atlas) |
| P5 | Twin-link features | blocked on P2+P3 |

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

## P3 — next steps in this repo

1. VSCode extension harness (esbuild bundle, `@vscode/test-electron`,
   `engines.vscode ^1.125.0`) on top of the house node template.
2. Re-encode the predecessor's bug classes as failing tests FIRST
   (clean-room rule): bare-vs-caret global names, `global_root`
   normalization (`^DD("IX",` → `DD`), XINDEX `line_text` holding line
   numbers as text.
3. Activation: fetch-verify data via vista-store into `globalStorage`;
   routine sidebar (tags/callers/callees/globals/XINDEX) + hover set
   incl. `^GLOBAL` → file → PIKS card.
4. Acceptance: the 0.2.0 guide walkthrough
   (`vista-meta/docs/guides/vista-vscode-guide.md`) passes on v2.
