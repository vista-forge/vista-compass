---
status: living
---

# VistA Compass — Planning Guide

The forward-looking companion to the
[implementation tracker](compass-v2-tracker.md) (which records what has
*landed*) and the [changelog](changelog.md) (which records *why* each
change happened). This guide records **where the work is going**:
Compass's own roadmap, the wider VistA tool family Compass belongs to,
and the feature/function/bugfix recommendations gathered in the
2026-07 marketplace-analysis session.

> **Scope note.** Compass is one of *several* tools in a deliberately
> separated family (see [The tool family](#1--the-tool-family)). This
> guide leads with **Compass's** roadmap. It also captures the plans for
> the sibling efforts — the engine-neutral **M language tool** and the
> **VistA developer helper** — so nothing from the strategy session is
> lost, but those are separate repos/products and their detail will
> migrate to their own `docs/proposals/` when those repos are stood up.
> The governing design for Compass itself remains
> [`vista-atlas-and-compass-de-novo.md`](https://github.com/rafael5/vista-meta/blob/main/docs/proposals/vista-atlas-and-compass-de-novo.md)
> in vista-meta.

---

## Contents

1. [The tool family](#1--the-tool-family)
2. [Compass: current state](#2--compass-current-state)
3. [Compass: roadmap](#3--compass-roadmap)
4. [Compass: recommended new features](#4--compass-recommended-new-features)
5. [Compass: known issues & bugfixes](#5--compass-known-issues--bugfixes)
6. [Sibling effort — the engine-neutral M language tool](#6--sibling-effort--the-engine-neutral-m-language-tool)
7. [Sibling effort — the VistA developer helper](#7--sibling-effort--the-vista-developer-helper)
8. [Prioritized next steps](#8--prioritized-next-steps)

---

## 1 · The tool family

The 2026-07 marketplace analysis confirmed a clean, non-overlapping
three-tier product architecture. Keeping these separate is the whole
point of the **m/v waterline** (`~/vista-forge/CLAUDE.md`): an
engine-neutral M tool must never learn VistA specifics, and all VistA
knowledge belongs in the VistA-specific tools.

| Tier | Tool(s) | Scope | Touches an engine? | Repo status |
|---|---|---|---|---|
| **1. Engine-neutral M language tool** | LSP + linter + formatter + test/coverage (+ deferred debugger) | Pure M / MUMPS. YottaDB **and** IRIS. No VistA. | LSP/linter: no. Test/coverage/debug: yes, via the driver seam. | Assets exist in `m-cli` + `tree-sitter-m` + `tree-sitter-m-vscode`; needs promotion into a `vista-forge` non-waterline repo. See [§6](#6--sibling-effort--the-engine-neutral-m-language-tool). |
| **2. VistA measured/documented navigators** | **VistA Compass** (code) + **VistA Atlas** (docs) | VistA-specific, over published static data (`meta.db` / vdocs). Web-capable, no live engine. | No. | **This repo** + `vista-atlas`. Both non-waterline. |
| **3. VistA developer helper** | Snippets + FileMan/Kernel/RPC-aware assistance | VistA-specific authoring aid; consumes Compass/Atlas data. | No. | Planned separate plugin. See [§7](#7--sibling-effort--the-vista-developer-helper). |

**Why this matters for Compass.** The marketplace has *no* competitor in
Tier 2. The one VistA-aware extension (MForge) stops at per-routine lint
and navigation and is a YottaDB-only IDE; nothing offers
package/architecture-level intelligence over a measured model, and
nothing is web-capable over published static data. That white space —
**measured call graph + PIKS + package topology + documentation bridge,
offline and verifiable** — is Compass's structural moat, and it is
uncontested. The job is to widen it, not to defend it.

---

## 2 · Compass: current state

**Shipping: v0.4.2.** Phases P1–P5 have all landed on the Compass side
(full detail in the [tracker](compass-v2-tracker.md)).

- **P1** — `vista-store` lib (read-only `node:sqlite`, fetch-verify,
  release pins, meta.db contract check) + twin-link contract v1 frozen.
- **P3** — v2 MVP at 0.2.0-predecessor parity: routine sidebar, Tier-A
  hover cards, token grammar with the predecessor's bug classes encoded
  as tests first.
- **P4** — full-scope surfaces: RPCs/options/protocols, Find RPC/Option
  pickers, package dashboard, outline + workspace symbols +
  go-to-definition + find-references, opt-in XINDEX diagnostics, bridge
  "documented in N docs" affordances.
- **P5** — twin-link features against the real Atlas: contract command
  surface + URI handler, hover cross-jumps, seeded search handoff,
  citation routing, the Gate-R release-pair handshake, copy-citation.

Quality baseline: ~186 unit tests, coverage ~99%, plus an in-VSCode
end-to-end smoke suite that runs against the real data release.

---

## 3 · Compass: roadmap

### 3.1 Immediate — close the open loops

- [ ] **Owner visual click-throughs still pending** (tracker P4/P5): the
      RPC/option pickers, package dashboard, outline/`Ctrl+T`, a
      `Ctrl+Click` into a `TAG^RTN`, the opt-in XINDEX diagnostics; and
      on the P5 side, the "documented in N docs → Atlas" jump, copy
      citation, the Search footer row, and right-click Find in Docs.
      These are the last acceptance gates before the phases are formally
      archived.
- [ ] **Publish to the Marketplace.** Compass is currently vsix-only.
      Publishing is the highest-reach move once the click-throughs pass
      (Tier 2 has no real competitor, so first-mover visibility is
      cheap).

### 3.2 Producer prerequisites (Track-P, vista-meta side — not this repo)

These block specific Compass features and must be done by the data
producer:

- [ ] **Publish `ai-manifest.json` as a data-v1 release asset.** It is
      not currently on the release (not standalone, not in either
      tarball); Compass reads the producer-checkout copy and
      `checkMetaDb` takes the catalog as an input. Fix in the producer's
      `make derived-publish` + `data-v1-derived.json` sidecar, then pin
      it in `contracts/releases/vista-meta-data-v1.json`.
- [ ] **Bake routine formals** into the model, to unblock **signature
      help** in Compass (Track P-vista-meta 2).

### 3.3 Deferred Compass features (were consciously skipped)

- [ ] **Signature help** on `$$TAG^RTN` calls — gated on the formals
      bake above.
- [ ] **Tier D language features** — CodeLens (e.g. inline caller counts
      / "N callers" on a tag), completion (tags/routines/RPCs), a status
      bar item for the loaded data vintage.
- [ ] **Extract `vista-store` to a sibling repo.** It was built inside
      this repo per proposal §6; the extraction triggers when vista-atlas
      begins consuming it (Atlas-side P1). Until then it stays vendored
      here.

---

## 4 · Compass: recommended new features

New ideas surfaced by the competitive analysis. These exploit the two
axes no competitor touches — **static/web-capable** operation and
**architecture-level** intelligence.

- **Web/`vscode.dev` mode.** Compass is already static-data + `node:sqlite`;
  a web build (or WASM SQLite fallback for the web extension host) would
  make it the **only** VistA code-intelligence tool that runs in the
  browser editor. No competitor — native or IRIS — can follow there.
  High differentiation, moderate effort (the store interface already
  abstracts the engine).
- **Package-graph visualization.** The dashboard already computes inbound
  /outbound couplings with edge counts; render them as an actual graph
  (a webview force-directed or dependency diagram). Nobody in the field
  offers package-topology visualization for VistA.
- **Impact-analysis view.** Given the routine you're editing, a
  transitive "what could this break" panel over the measured call graph
  (callers-of-callers to depth N), highlighting any that cross into
  patient-data PIKS. This is the "impact analysis without a running
  system" promise made concrete.
- **PIKS-aware editor decorations.** Inline gutter/hover markers when the
  cursor is near a Patient-class global — turning the "know you're near
  patient data *before* you edit" pitch into an always-on signal, not a
  hover-on-demand one.
- **Richer hover/signature grounded in real API metadata** (once formals
  bake): FileMan/Kernel/RPC call signatures in the hover card, not just
  the routine card.

---

## 5 · Compass: known issues & bugfixes

- **Fixed in v0.4.2** — the Gate-R handshake fired a spurious
  "release-pair drift" warning when Atlas was installed but had not yet
  opened its panel (empty pins read as drift). The drift decision is now
  the pure, unit-tested `releaseDriftProblems()`, which treats empty
  Atlas pins as *not loaded*. Regression covered by smoke §13.
- **Fixed in v0.4.1** — a callee click without `vistaMHostPath` was a
  silent dead-click and opened line 1 rather than the tag; it now routes
  through `vistaCompass.openRoutine` (lazy resolve) and shows a helpful
  message when the source path is unset or missing.
- **Watch item — full §6.1 twin-link** depends on Atlas-side work (its
  repo): Atlas registering `vistaAtlas.openEntity` + the
  `vista.openCitation` fallback + its own seeded footer row into
  `vistaCompass.search`. When that lands, Compass's cross-jump
  automatically upgrades from doc *search* to entity *pages* — no Compass
  change required.
- **Watch item — predecessor coexistence.** v2 deliberately reuses the
  0.2.0 identifiers, so the two cannot be installed together; this is
  documented in the user guide but should be called out prominently in
  the Marketplace listing to avoid confused first installs.

---

## 6 · Sibling effort — the engine-neutral M language tool

*Tier 1 of the family — a separate, engine-neutral product (no VistA).
Its full plan now lives with the engine it concerns, in **m-cli**:*

> **[m-cli · Engine-neutral M developer tooling — the superset plan](https://github.com/vista-forge/m-cli/blob/main/docs/proposals/engine-neutral-m-tooling-plan.md)**

In one paragraph: make the most feature-rich M **linter + LSP +
(deferred) debugger** on the Marketplace, built on assets that already
exist (`m lint` / `m lsp` / `m test` / `m coverage`, `tree-sitter-m`, the
`tree-sitter-m-vscode` extension). The native-M tier is thin and stale;
every rich feature elsewhere is IRIS-engine-locked. The three moats:
**parser-accuracy**, **engine-neutrality** (YottaDB *and* IRIS via the
driver seam — the "the VA runs on IRIS" problem solved architecturally),
and a **native Test Explorer + coverage** no competitor has. Highest-value
move: publish the already-built correctness-linter LSP. Debugger deferred.
Full phasing, the asset inventory, and placement are in the linked
proposal.

---

## 7 · Sibling effort — the VistA developer helper

*Separate plugin, planned. Sits on top of the engine-neutral M tool
(§6) and consumes Compass/Atlas data.*

The role: everything **VistA-specific** that must stay out of the
engine-neutral M tool per the waterline — FileMan/Kernel/RPC-aware
snippets, routine-header and patch-change templates (the one thing
MForge does that's genuinely useful), and hover/completion grounded in
the actual VistA API catalog (FileMan/Kernel/Broker signatures). Because
Compass already resolves globals→FileMan→PIKS and lists RPC/option/
protocol bindings, the helper can lean on the same measured model rather
than hard-coding VistA knowledge. This keeps all three tiers clean: the
M tool stays engine-neutral, Compass/Atlas stay read-only navigators,
and VistA authoring assistance lives in its own plugin.

---

## 8 · Prioritized next steps

Ordered by value-per-effort, across the family:

1. **Compass — finish the P4/P5 owner click-throughs**, then archive the
   phases per the Tier-D rule. (Closes the current effort cleanly.)
2. **Compass — publish to the Marketplace.** Uncontested Tier-2 space;
   first-mover visibility is cheap.
3. **M tool — the §6.5 highest-value move**: de-drift + bundle + publish
   the correctness-linter LSP. Ships the deepest M linter on the
   Marketplace with no new engineering.
4. **Producer (Track-P) — publish `ai-manifest.json`** as a release
   asset and **bake formals**; both unblock Compass features (contract
   simplification; signature help).
5. **M tool — Phase 1** (full LSP surface) then **Phase 3** (Test
   Explorer), the two most marketable additions.
6. **Compass — web/`vscode.dev` mode** and the **package-graph
   visualization**, the two highest-differentiation new features.
7. **Stand up the M-tool repo** (§6.6 placement) and **the VistA helper
   plugin** (§7) as their scopes firm up.

The cross-cutting principle: **surface what already exists before
building what doesn't.** Compass's phases are largely done; the M tool's
hardest assets (parser, linter, seam, test stack) are already built. The
leading position is mostly a *publishing and surfacing* problem, with the
debugger as the one genuinely large deferred build.
