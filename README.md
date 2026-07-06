# Vista Compass

**X-ray vision for VistA code, inside VSCode.** Open any `.m` routine and
instantly see what the VistA system *measurably is* around it: who calls it,
what it calls, which globals it touches and which FileMan files those are,
whether patient data is involved, which RPCs and menu options enter through
it, and what the static analyzer thinks of it — all from a verified,
versioned measurement of a real VistA system, fully offline, with no VistA
instance required.

Compass answers in one hover what normally takes a FileMan data dictionary
session, an XINDEX run, and a lot of grepping:

> Hover `^DPT` → **File 2 PATIENT — PIKS P (Patient)** · 1,811 records ·
> referenced by 3,000+ routines · documented in 120 docs → *click through to
> the manuals*.

It is one half of a pair: Compass shows what the system **is** (the measured
code + data model); its twin [Vista Atlas](https://github.com/vista-forge/vista-atlas)
shows what the documentation **says** (the full VA manual corpus). The two
cross-link, so "show me the docs for this RPC" and "show me the code behind
this doc" are each one click.

## Why a VistA developer needs this

MUMPS gives you none of the safety rails modern languages take for granted —
no imports, no types, no module boundaries. A routine's dependencies, its
callers, and the meaning of the data it touches are simply **not visible in
the source you're editing**. In a 30,000-routine, 100+-package system that
runs patient care, working without that visibility isn't slower — it's how
regressions ship. Compass restores it:

- **You cannot see who calls the code you're changing.** There is no
  compiler to catch a broken caller; `TAG^ROUTINE` call sites hide behind
  indirection and 2–4-character names that make grep useless. Compass gives
  you the *measured* call graph: every caller, every callee, with reference
  counts — before you touch a line.
- **You cannot tell what a global is from its name.** `^DPT(`, `^PSRX(`,
  `^OR(` carry no hint of which FileMan file they are or whether a subscript
  away from patient data. Compass resolves every global to its file and
  **PIKS class** (Patient / Institution / Knowledge / System), down to
  field-level pointer flags and sensitive-field counts — so you know you're
  near patient data *before* you edit, not in the incident review.
- **The knowledge you'd normally ask for is walking out the door.** The
  developers who hold VistA's structure in their heads are retiring. The
  sidebar's cold-open briefing — package, size, fan-in/out, entry points,
  RPC/option exposure, lint findings — replaces the hallway question there's
  no longer anyone to ask.
- **Impact analysis is otherwise a running-system exercise.** XINDEX runs
  and FileMan data-dictionary sessions need a live VistA and roll-and-scroll
  terminals. Compass ships the same facts pre-measured, offline, in your
  editor — no instance, no Docker, no terminal emulator.
- **A routine's public API is invisible.** Nothing in the source marks that
  an RPC broker call or a menu option lands on this tag; changing it breaks
  CPRS clients you never knew existed. Compass lists every RPC, option, and
  protocol wired into the routine, and finds any of them by name.
- **Cross-package coupling is where VistA changes go wrong.** The package
  dashboard shows exactly which other packages call into yours and which you
  depend on — measured edge counts, not folklore — before you commit to a
  change that ripples.
- **Claims about VistA need receipts.** Every fact Compass shows is a row in
  a checksummed, versioned data release; one click copies the exact citation
  — the same format the vista-meta MCP servers and AI agents emit — so code
  reviews and design docs can cite the system instead of asserting about it.

## Features

### Routine sidebar (Explorer → VISTA ROUTINE)

Reacts to the active `.m` editor. Sections appear only when non-empty:

| Section | Shows |
|---|---|
| **Header** | Package, line count, in/out-degree, `RPC×N` / `OPT×N` badges |
| **Tags** | The routine's entry points with line numbers — click to jump |
| **Callers** | Who calls this routine (package, ref-count) — click to open |
| **Callees** | What it calls, as `TAG^RTN` with call kind and ref-count — click to open |
| **Globals** | Distinct globals touched, with ref-counts |
| **RPCs** | RPCs whose broker entry point is in this routine (tag, return type) |
| **Options** | Menu options entering through this routine (menu text, type) |
| **Protocols** | Protocols whose entry/exit actions invoke it |
| **XINDEX** | Static-analyzer findings with severity icons — auto-expanded so Fatals can't be missed; click to jump to the line |

The sidebar badge shows the exact data vintage (`data-v1 · 23d037f1`).

### Hover cards (comprehension without leaving the code)

| Cursor on | You get |
|---|---|
| A routine name (`RTN`, `^RTN`, `D RTN`) | Package, size, fan-in/out, top callers/callees/globals |
| `TAG^RTN` / `$$TAG^RTN` | The routine card **plus** a badge confirming the tag exists in the measured tag index |
| A tag at column 0 | External callers of that entry point with ref-counts — or "no external callers, likely private" |
| `^GLOBAL` | Who-references summary **plus** the FileMan join: file number/name, **PIKS class**, record count, cross-PIKS pointer fields, sensitive-field count |

Routine and global cards also carry **"documented in N docs → Atlas"**
(click to jump into the documentation twin) and **"copy citation"**.

### Code navigation & search

- **Outline / breadcrumbs / `Ctrl+Shift+O`** — the routine's tags as document
  symbols, including numeric tags.
- **`Ctrl+T` workspace symbols** — every measured tag in VistA (~292k) as
  `TAG^ROUTINE`, indexed for instant prefix search.
- **`Ctrl+Click` go-to-definition** — on any `TAG^RTN` call site, lands on
  the tag line in the target routine's source.
- **Find references** — on a tag at column 0, lists every call site across
  the measured call graph.
- **`VistA Compass: Search Measured Model`** — one picker across routines,
  tags, RPCs, and options, with a footer row that forwards your query into
  Vista Atlas doc search.
- **`VistA Compass: Find RPC` / `Find Option`** — name-prefix pickers over
  the full RPC/option registries; Enter opens the implementing routine.
- **Right-click → `Find in Docs`** — send the token under the cursor to the
  documentation twin.

### Package dashboard

`VistA Compass: Package Dashboard` (defaults to the active routine's
package): namespace, prefixes, `app_code`, VDL id, measured size, PIKS
distribution of its shipped files, top inbound/outbound package couplings,
and the routine leaderboard.

### Diagnostics (opt-in)

Set `vistaCompass.xindexAsDiagnostics: true` and XINDEX findings light up in
the Problems panel and the editor gutter (F → error, W → warning, rest →
info).

### Twin integration (Vista Atlas)

Fully optional — every feature degrades gracefully when Atlas is absent:

- **Cross-jumps** from hover cards into the documentation.
- **Citation routing** — `vista.openCitation` opens either citation format:
  `vista-meta data-v1 · code-model/rpcs.tsv · name=…` lands in the measured
  source; `vdocs://section/…` opens in Atlas.
- **Deep links** — `vscode://vista-forge.vista-compass/lookup?kind=rpc&key=…`
  works from terminals, markdown, and AI answers.
- **Release-pair handshake** — on startup Compass verifies its data release
  and the Atlas corpus release still form the published, cross-validated
  pair, and warns if they've drifted apart.

### Commands (palette)

| Command | Does |
|---|---|
| `VistA Compass: Search Measured Model` | Combined routine/tag/RPC/option search + docs handoff |
| `VistA Compass: Find RPC` | RPC picker → implementing routine |
| `VistA Compass: Find Option` | Option picker → implementing routine |
| `VistA Compass: Package Dashboard` | The per-package overview webview |
| `VistA Compass: Find in Docs (Vista Atlas)` | Current token → docs search |
| `VistA Compass: Refresh Routine Sidebar` | Re-read the active routine |
| `VistA Compass: Reload Data` | Re-verify and reopen the data release |

## Getting started

1. Install the extension (`code --install-extension vista-compass-<version>.vsix`).
2. Open any `.m` file. On first activation Compass downloads the published
   **vista-meta data release** (~90 MB SQLite database) into extension
   storage and **verifies it against pinned sha256 checksums** — after that
   it is fully offline.
3. Optional settings:

| Setting | Purpose |
|---|---|
| `vistaCompass.dataPath` | Use a local copy of `vista-meta-data-v1.db` instead of downloading |
| `vistaCompass.vistaMHostPath` | Directory holding the VistA-M source tree (e.g. a `Packages/…/Routines` checkout) — enables all click-to-open navigation, go-to-definition, references, and workspace symbols |
| `vistaCompass.topN` | Max entries per sidebar section (default 15) |
| `vistaCompass.xindexAsDiagnostics` | XINDEX findings in the Problems panel (default off) |

## The data

Everything Compass shows is a query over **meta.db**, the SQLite projection
of the [vista-meta](https://github.com/rafael5/vista-meta) data release: 24
typed tables measured from a running VistA (routines, call graph, globals,
RPCs, options, protocols, FileMan files, PIKS classifications, XINDEX
results) plus the vdocs↔vista-meta entity bridge. The release is pinned by
checksum in this repo and verified on every load — Compass never invents,
re-derives, or edits data, and it never touches a live VistA system.

## Development

House node template: `make install` · `make check` (lint + typecheck +
coverage + audit) · `npm run test:vscode` (end-to-end smoke inside the
installed VSCode) · `npm run vsix` (build the installable package). See
[`node-dev-guide.md`](node-dev-guide.md) and
[`docs/compass-v2-tracker.md`](docs/compass-v2-tracker.md).
