/**
 * Smoke launcher: runs dist/smoke-suite.cjs inside the INSTALLED
 * VSCode (the P0 spike pattern — no download), against a generated
 * one-off workspace whose settings point at the local vista-meta
 * checkout. Invoke with `npm run test:vscode`; not part of `make
 * check` (needs a display + installed VSCode 1.125+).
 */

import { mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTests } from '@vscode/test-electron';

const VSCODE_BIN = process.env.COMPASS_SMOKE_VSCODE ?? '/usr/share/code/code';
const VISTA_META = process.env.VISTA_META_HOME ?? join(homedir(), 'projects/vista-meta');

const repoRoot = new URL('../..', import.meta.url).pathname;
const smokeFile = join(
  VISTA_META,
  'vista/vista-m-host/Packages/Accounts Receivable/Routines/PRCA45PT.m',
);

const workspace = mkdtempSync(join(tmpdir(), 'compass-smoke-'));
writeFileSync(join(workspace, 'settings.json'), ''); // placeholder; real settings below
const settingsDir = join(workspace, '.vscode');
await import('node:fs/promises').then((fs) => fs.mkdir(settingsDir, { recursive: true }));
writeFileSync(
  join(settingsDir, 'settings.json'),
  JSON.stringify({
    'vistaCompass.dataPath': join(VISTA_META, 'dist/vista-meta-data-v1.db'),
    'vistaCompass.vistaMHostPath': join(VISTA_META, 'vista/vista-m-host'),
  }),
);

// A scratch extensions dir holding ONLY the Atlas twin (symlinked from
// the real install), so the twin-link seam is exercised without noise
// from unrelated installed extensions.
const extensionsDir = join(workspace, 'extensions');
mkdirSync(extensionsDir, { recursive: true });
const realExtensions = join(homedir(), '.vscode/extensions');
for (const entry of readdirSync(realExtensions)) {
  if (entry.startsWith('vista-forge.vista-atlas-')) {
    symlinkSync(join(realExtensions, entry), join(extensionsDir, entry));
  }
}

await runTests({
  vscodeExecutablePath: VSCODE_BIN,
  extensionDevelopmentPath: repoRoot,
  extensionTestsPath: join(repoRoot, 'dist/smoke-suite.cjs'),
  launchArgs: [workspace, '--extensions-dir', extensionsDir, '--disable-gpu'],
  extensionTestsEnv: { COMPASS_SMOKE_FILE: smokeFile },
});
