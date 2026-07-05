# Vista Compass

**A VSCode extension over the vista-meta data release — what the VistA system
measurably *is*.** The de-novo successor (v2) of vista-meta's in-repo
`vscode-extension/` (VistA Compass 0.2.0; and, with its twin, of the deleted vista-info-hub), twinned with
[vista-atlas](https://github.com/vista-forge/vista-atlas) (what the documentation
*says*); the two cross-link through the vdocs↔vista-meta entity bridge.

> **Status: P1 done, Compass side (2026-07-05).** The governing design is the proposal
> [`vista-atlas-and-compass-de-novo.md`](https://github.com/rafael5/vista-meta/blob/main/docs/proposals/vista-atlas-and-compass-de-novo.md)
> (in vista-meta's docs). P0 (engine spike): **`node:sqlite`** in the
> extension host (VSCode ≥ 1.125, Node 24), zero native dependencies. P1: the
> embryonic **vista-store** lib (engine wrapper, release fetch/verify, meta.db
> contract check) + the frozen **twin-link contract v1**
> (`contracts/twin-link.v1.json`) live here — see
> [`docs/compass-v2-tracker.md`](docs/compass-v2-tracker.md). Next: P3
> Compass-v2 MVP at 0.2.0 parity.

## What it will do

Everything 0.2.0 does (routine sidebar, callers/callees/globals/XINDEX, the
`^GLOBAL` → FileMan file → PIKS hover) **plus the full published scope**:

- **RPCs / options / protocols** as first-class surfaces.
- **Package dashboard** — namespace, PIKS distribution, cross-package coupling.
- **Language features** — workspace symbols, go-to-definition/references from
  the measured call graph, XINDEX diagnostics.
- **"Documented in N docs"** — bridge-powered jumps into `vista-atlas`.

## Data

Consumes the **vista-meta `data-vN` release** via **meta.db** (the generated
SQLite projection: 24 typed TSV tables + entity bridge + join views), which is
itself a **published release asset** (sha-recorded in vista-meta's
`docs/releases/data-v1-derived.json`) — fetched and verified, never re-derived
here. `ai-manifest.json` is the self-describing catalog and the release
manifest the provenance pin. The TSVs remain the model of record.

## Place in the org

Non-waterline repo: a read-only navigator over published releases — it never
touches an M engine, so it declares no `m`/`v` layer and sits outside the
waterline gates (like `clikit`). Producer: [vista-meta](https://github.com/rafael5/vista-meta).

## Dev

House node template: `make install` · `make check` (lint + typecheck +
coverage + audit) · see [`node-dev-guide.md`](node-dev-guide.md).
