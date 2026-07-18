# VistA Compass — User Guide

A task-oriented guide to using **VistA Compass v0.4.2**: installation,
first run, every feature, the VistA Atlas integration, and
troubleshooting. For the one-page overview and the argument for *why* a
VistA developer needs this, see the [README](../../README.md). For the
roadmap and the wider tool family, see the
[planning guide](planning-guide.md).

---

## Contents

- [What Compass is](#what-compass-is)
- [Requirements](#requirements)
- [Installation](#installation)
- [First run: the data release](#first-run-the-data-release)
- [Configuration](#configuration)
- [The routine sidebar](#the-routine-sidebar)
- [Hover cards](#hover-cards)
- [Code navigation & search](#code-navigation--search)
- [The package dashboard](#the-package-dashboard)
- [XINDEX diagnostics (opt-in)](#xindex-diagnostics-opt-in)
- [Working with VistA Atlas (the documentation twin)](#working-with-vista-atlas-the-documentation-twin)
- [Citations](#citations)
- [Deep-link URIs (power users & tooling)](#deep-link-uris-power-users--tooling)
- [Troubleshooting](#troubleshooting)
- [Where the data comes from](#where-the-data-comes-from)

---

## What Compass is

VistA Compass is a VSCode extension that shows what the VistA system
**measurably is**. Open any `.m` routine and it answers, without a live
VistA instance, questions that normally require an XINDEX run, a FileMan
data-dictionary session, and a lot of grepping: who calls this routine,
what it calls, which globals it touches and which FileMan files those
are, whether patient data is involved, which RPCs and menu options enter
through it, and what the static analyzer flagged.

Everything is a query over a **verified, versioned measurement** of a
real VistA system (the `meta.db` SQLite release). Compass never invents,
re-derives, or edits data, and it never connects to a live VistA.

Compass is the *code* half of a two-extension pair. Its sibling,
[**VistA Atlas**](https://github.com/vista-forge/vista-atlas), puts the
VA documentation library in the editor — what the documentation *says* —
and the two cross-link. Atlas is optional; every twin feature degrades
gracefully when it is absent.

---

## Requirements

- **VSCode 1.125 or later.** Compass uses the built-in `node:sqlite`
  module, which requires the Node 24 runtime that ships with VSCode
  1.125+. Earlier VSCode versions will not activate it.
- **~90 MB of free space** in extension storage for the data release
  (downloaded once, on first activation).
- **Optional:** a local VistA-M source checkout, to enable
  click-to-open navigation (see [`vistaCompass.vistaMHostPath`](#configuration)).
- **Optional:** the VistA Atlas extension, for documentation cross-links.

---

## Installation

Until Compass is on the Marketplace, install the packaged `.vsix`:

```bash
code --install-extension vista-compass-0.4.2.vsix
```

Or in VSCode: **Extensions** view (`Ctrl+Shift+X`) → `⋯` menu →
**Install from VSIX…** → pick `vista-compass-0.4.2.vsix`.

> **If a VSCode window is already open**, reload it (`Ctrl+Shift+P` →
> *Developer: Reload Window*) after a CLI install — an already-running
> window does not pick up a newly installed extension until reload.

> **Predecessor conflict.** The frozen 0.2.0 predecessor
> (`rafael5.vista-compass`) shares Compass v2's view, command, and
> settings identifiers by design, so the two **cannot coexist**.
> Uninstall the 0.2.0 extension first.

---

## First run: the data release

The first time you open a `.m` file after installing:

1. Compass downloads the published **vista-meta data release**
   (`meta.db`, ~90 MB) from GitHub Releases into its private extension
   storage.
2. It **verifies the download against pinned sha256 checksums** before
   using it. A tampered or truncated file is rejected.
3. After that, Compass is **fully offline** — no network, no VistA, no
   Docker.

The download is idempotent: if a verified copy is already present,
activation skips straight to opening it. To skip the download entirely
and use a local database, point [`vistaCompass.dataPath`](#configuration)
at a copy of `vista-meta-data-v1.db`.

**The vintage badge.** The routine sidebar header shows the exact data
vintage you are looking at, e.g. `data-v1 · 23d037f1` — the release tag
and content hash. Every fact Compass shows traces back to that pinned
release.

---

## Configuration

All settings live under **Settings → Extensions → VistA Compass**, or
edit `settings.json` directly:

| Setting | Default | Purpose |
|---|---|---|
| `vistaCompass.dataPath` | `""` | Path to a local `meta.db`. Empty = fetch-verify the published release into global storage. Set this to avoid the download or to use a dev database. |
| `vistaCompass.vistaMHostPath` | `""` | Directory holding the VistA-M source tree (e.g. a host mirror of `/opt/VistA-M`, or `~/projects/vista-meta/vista/vista-m-host`). **Enables all click-to-open navigation** — callers/callees, go-to-definition, references, and the source behind workspace symbols. Without it, those actions show a helpful "set vistaMHostPath" message instead of opening a file. |
| `vistaCompass.topN` | `15` | Maximum entries shown per sidebar section (callers, callees, globals, etc.). Raise it to see more per section. |
| `vistaCompass.xindexAsDiagnostics` | `false` | When true, XINDEX findings appear in the Problems panel and the editor gutter. Off by default (findings are always visible in the sidebar). |

---

## The routine sidebar

The **VISTA ROUTINE** view (Explorer sidebar, compass icon) reacts to
the active `.m` editor. Switch editors and it re-reads the new routine.
Sections with zero rows are hidden, so what you see is only what exists
for this routine.

| Section | Shows | Click behavior |
|---|---|---|
| **Header** | Package, line count, in-degree/out-degree, `RPC×N` / `OPT×N` exposure badges, and the data vintage | — |
| **Tags** | The routine's entry points (labels) with line numbers | Jumps to the tag line in the current file |
| **Callers** | Routines that call this one, with package and reference count | Opens the calling routine (top of file) |
| **Callees** | What this routine calls, as `TAG^RTN` with call kind and ref-count | Opens the target routine **at its `TAG` entry point** (e.g. `BMES^XPDUTL` lands on the `BMES` line in `XPDUTL.m`) |
| **Globals** | Distinct globals the routine touches, with ref-counts | — |
| **RPCs** | RPC broker entry points located in this routine (tag, return type) | — |
| **Options** | Menu options that enter through this routine (menu text, type) | — |
| **Protocols** | Protocols whose entry/exit actions invoke this routine | — |
| **XINDEX** | Static-analyzer findings with severity icons — **auto-expanded** so Fatals can't be missed | Jumps to the flagged line |

Click-to-open on Callers/Callees requires
[`vistaCompass.vistaMHostPath`](#configuration) to be set; the callee
resolves lazily on click (no file I/O while the sidebar renders).

Use the **refresh** button in the view title bar (or **VistA Compass:
Refresh Routine Sidebar**) to force a re-read of the active routine.

---

## Hover cards

Hover the mouse (or use `Ctrl+K Ctrl+I`) over M source to get a
comprehension card without leaving the code:

| Cursor on | Card shows |
|---|---|
| A routine name — `RTN`, `^RTN`, `D RTN` | Package, size, fan-in/out, top callers, callees, and globals |
| `TAG^RTN` / `$$TAG^RTN` | The routine card **plus** a badge confirming the tag exists in the measured tag index |
| A tag at column 0 | External callers of that entry point with ref-counts — or "no external callers, likely private" |
| `^GLOBAL` | Who-references summary **plus** the FileMan join: file number/name, **PIKS class** (Patient / Institution / Knowledge / System), record count, cross-PIKS pointer fields, and sensitive-field count |

Routine and global cards also carry two action links:

- **"documented in N docs → Atlas"** — jump into the documentation twin
  (see [below](#working-with-vista-atlas-the-documentation-twin)).
- **"copy citation"** — copy the exact, checksummed citation line for the
  fact you're looking at (see [Citations](#citations)).

---

## Code navigation & search

| Feature | How | Notes |
|---|---|---|
| **Outline / breadcrumbs** | `Ctrl+Shift+O`, or the Outline view | The routine's tags as document symbols, including numeric tags |
| **Workspace symbols** | `Ctrl+T`, then type a tag | Every measured tag in VistA (~292k) as `TAG^ROUTINE`, prefix-indexed for instant search |
| **Go to definition** | `Ctrl+Click` (or `F12`) on a `TAG^RTN` call site | Lands on the tag line in the target routine's source (requires `vistaMHostPath`) |
| **Find references** | `Shift+F12` on a tag at column 0 | Lists every call site across the measured call graph (capped for responsiveness) |
| **Search Measured Model** | **VistA Compass: Search Measured Model** | One picker across routines, tags, RPCs, and options; a footer row forwards your query into Atlas doc search |
| **Find RPC** | **VistA Compass: Find RPC** | Name-prefix picker over the full RPC registry; Enter opens the implementing routine |
| **Find Option** | **VistA Compass: Find Option** | Name-prefix picker over the full option registry; Enter opens the implementing routine |
| **Find in Docs** | Right-click a `.m` editor → **Find in Docs (VistA Atlas)** | Sends the token under the cursor to the documentation twin |

---

## The package dashboard

Run **VistA Compass: Package Dashboard** (it defaults to the active
routine's package) for a per-package overview webview:

- Namespace, prefixes, `app_code`, and VDL id
- Measured size and the PIKS distribution of the package's shipped files
- Top **inbound** and **outbound** package couplings, with measured edge
  counts — which other packages call into yours, and which yours depends
  on
- The routine leaderboard for the package

This is the "who couples to whom" view you consult *before* committing
to a change that might ripple across packages.

---

## XINDEX diagnostics (opt-in)

XINDEX findings are always visible in the sidebar's **XINDEX** section.
If you additionally want them in VSCode's Problems panel and the editor
gutter, set:

```jsonc
"vistaCompass.xindexAsDiagnostics": true
```

Severity maps as: **F → Error**, **W → Warning**, everything else →
Info. It is off by default because the sidebar already surfaces the
findings and some developers prefer an uncluttered Problems panel.

---

## Working with VistA Atlas (the documentation twin)

Install [VistA Atlas](https://github.com/vista-forge/vista-atlas)
alongside Compass to light up the documentation cross-links. Compass
works fully without it — these features simply appear when the twin is
present.

- **Cross-jumps.** The "documented in N docs → Atlas" link on a routine
  or global hover card opens the relevant documentation. When Atlas has
  shipped its entity tier, this lands on the exact entity page; until
  then it degrades to an Atlas documentation *search* for that token.
- **Find in Docs.** Right-click any token in a `.m` file → **Find in
  Docs** to search the documentation for it.
- **Search handoff.** The **Search Measured Model** picker's footer row
  forwards your current query into Atlas doc search.
- **Release-pair handshake.** On startup Compass checks that its data
  release and the Atlas corpus release still form the published,
  cross-validated pair (via the `entity-bridge.meta.json` pin). If they
  have genuinely drifted apart, it warns you. An Atlas that hasn't opened
  its panel yet (empty pins) is treated as *not loaded*, not as drift —
  so no spurious warning fires at activation.

---

## Citations

Every fact Compass shows is a row in a checksummed, versioned data
release, so any claim you make from it can carry a receipt.

- **Copy citation** on a routine or global hover card copies the exact
  citation line — the same format the vista-meta MCP servers and AI
  agents emit — e.g.
  `vista-meta data-v1 · code-model/rpcs.tsv · name=…`. When a bridge row
  exists for the entity, that form is preferred.
- Paste it into a code review, design doc, or commit message to cite the
  measured system instead of asserting about it.

Compass understands **both** citation formats when opening one (see
`vista.openCitation` below): a `vista-meta …` citation lands in the
measured source; a `vdocs://section/…` citation opens in Atlas.

---

## Deep-link URIs (power users & tooling)

Other tools — including VistA Atlas — can land Compass on an exact
target via `vscode://` URIs:

```
vscode://vista-forge.vista-compass/lookup?kind=rpc&key=ORWPT+LIST
vscode://vista-forge.vista-compass/openEntity?entity_id=…
vscode://vista-forge.vista-compass/search?query=…
```

The same operations are available as VSCode commands for programmatic
use (e.g. from another extension or a task):

| Command | Purpose |
|---|---|
| `vistaCompass.lookup` | Open a specific entity by kind + key |
| `vistaCompass.openEntity` | Open a bridge entity by id |
| `vistaCompass.search` | Open the combined search picker (optionally seeded) |
| `vistaCompass.pins` | Report the installed release tag and content hash |
| `vista.openCitation` | Open either citation format (measured source or docs) |

`vista.openCitation` is registered defensively — both twins implement
it, and the first to register wins — so installing both extensions never
causes a duplicate-registration crash.

---

## Troubleshooting

**A newly installed extension isn't showing up.**
Reload the window (`Ctrl+Shift+P` → *Developer: Reload Window*). A CLI
install does not affect an already-open window until reload.

**Compass won't activate.**
Confirm VSCode is **1.125 or later** (`Help → About`). Compass depends
on the `node:sqlite` runtime in that build; earlier VSCode cannot load
it.

**Two Compass extensions conflict / commands are doubled.**
Uninstall the 0.2.0 predecessor (`rafael5.vista-compass`). v2 keeps the
same identifiers by design and the two cannot run together.

**Clicking a caller/callee does nothing, or opens the wrong line.**
Set [`vistaCompass.vistaMHostPath`](#configuration) to your VistA-M
source directory. Without it, Compass has the call graph but no source
files to open. (Before v0.4.1 a callee click without this setting was a
silent dead-click; it now shows a message telling you what to set.)

**A "release-pair drift" warning appears.**
Compass's data release and the Atlas corpus release are pinned as a
cross-validated pair. A genuine warning means the two installed releases
no longer match that pair — update whichever is stale. (An Atlas that
simply hasn't been opened yet does *not* trigger this.)

**The download is slow or failed.**
The release is ~90 MB from GitHub. If your environment blocks the
download, fetch `vista-meta-data-v1.db` separately and point
`vistaCompass.dataPath` at it; Compass will verify and use it offline.

**Reset the data.**
Run **VistA Compass: Reload Data (re-verify release)** to re-verify and
reopen the release without restarting VSCode.

---

## Where the data comes from

Everything Compass shows is a query over **meta.db**, the SQLite
projection of the
[vista-meta](https://github.com/rafael5/vista-meta) data release: typed
tables measured from a running VistA (routines, call graph, globals,
RPCs, options, protocols, FileMan files, PIKS classifications, XINDEX
results) plus the vdocs↔vista-meta entity bridge that powers the
documentation cross-links. TSVs remain the model of record; `meta.db` is
a published, checksummed projection of them.

The release is pinned by sha256 in this repo
(`contracts/releases/vista-meta-data-v1.json`) and verified on every
load. Compass is a **read-only consumer**: it never re-derives
summaries or indexes, never edits the data, and never contacts a live
VistA system.
