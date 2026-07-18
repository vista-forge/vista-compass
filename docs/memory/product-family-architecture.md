---
name: product-family-architecture
description: The three-tier VistA/M tool family Compass belongs to, and where the sibling-effort plans are captured
metadata:
  type: project
---

Compass is Tier 2 of a deliberately separated three-tier tool family
(confirmed in the 2026-07 marketplace-analysis session):

1. **Engine-neutral M language tool** — LSP + linter + formatter +
   test/coverage (+ deferred debugger). Pure M, YottaDB **and** IRIS, no
   VistA. Assets already exist (`m-cli` `m lint`/`m lsp`/`m test`/
   `m coverage`, `tree-sitter-m`, `tree-sitter-m-vscode`); needs
   promotion out of the winding-down `~/m-dev-tools/` into a new
   `vista-forge` non-waterline repo. Highest-value move: publish the
   already-built correctness-linter LSP (bundle `m-cli` in the VSIX).
2. **VistA navigators** — **VistA Compass** (this repo, code) + **VistA
   Atlas** (docs), over published static data, web-capable, no live
   engine.
3. **VistA developer helper** — planned separate plugin; FileMan/Kernel/
   RPC snippets + API-grounded hover, consuming Compass/Atlas data.

**Why:** the m/v waterline (`~/vista-forge/CLAUDE.md`) — the
engine-neutral M tool must never learn VistA specifics; all VistA
knowledge stays in tiers 2–3.

**Where the plans live:**
- **Tier 1 (engine-neutral M tool)** — full plan lives in **m-cli**:
  `m-cli/docs/proposals/engine-neutral-m-tooling-plan.md` (relocated
  2026-07-07 from Compass's planning guide, which now links to it). The
  VSCode extension it grows is still in the winding-down
  `~/m-dev-tools/tree-sitter-m-vscode` and is to be promoted into a new
  `vista-forge` non-waterline repo.
- **Tier 2 roadmap + tier overview** — this repo's
  [`docs/guides/planning-guide.md`](../guides/planning-guide.md).
- **Tier 3 (VistA helper)** — sketched in the planning guide; migrates to
  its own repo when stood up.

See also [[vista-store-gotchas]].
