---
name: dev-loop-gotchas
description: pre-push hook needs direnv's Node 24 (glob test:cov fails on system Node 18); run `direnv exec . git push`
metadata:
  type: project
---

The `simple-git-hooks` **pre-push** hook runs `npm run test:cov`, whose script is
`c8 … node --import tsx --test 'src/**/*.test.ts'`. Git hooks do **not** load
direnv, so a bare `git push` runs the hook under the machine-default **Node 18**,
where `node --test` cannot expand the `src/**/*.test.ts` glob — it dies with
`Could not find '…/src/**/*.test.ts'` and blocks the push, even though every test
passes. Node's `--test` glob support needs Node 21+; this repo pins **Node 24** via
`.node-version`/direnv.

**How to apply:** push with direnv's PATH so the hook uses the pinned Node —
`direnv exec . git push`. (Same trap for any vista-forge Node repo whose pre-push
hook uses glob-based `node --test`.) The local `npm run check` gate is unaffected
because it's invoked through direnv. A durable fix would make the hook
version-independent (e.g. a `use nvm`-aware wrapper) rather than relying on the
caller's shell.
