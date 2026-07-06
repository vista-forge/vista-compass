import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { renderPackageDashboardHtml } from './dashboard.ts';
import type { PackageView } from './package.ts';

const VIEW: PackageView = {
  package: 'Accounts Receivable',
  namespace: {
    packageName: 'ACCOUNTS RECEIVABLE',
    namespace: 'PRCA',
    prefixes: 'PRCA,PRY,RC',
    appCode: 'PRCA',
    vdlId: 29,
  },
  manifest: {
    routineCount: 431,
    totalLines: 90000,
    filesShipped: 40,
    rpcRoutines: 3,
    optionRoutines: 55,
    distinctGlobals: 60,
    outboundEdges: 900,
    outboundCrossPkg: 300,
  },
  piks: { p: 4, i: 6, k: 2, s: 28, unclassified: 0, total: 40 },
  outbound: [{ otherPackage: 'Kernel', callEdges: 500, callerRoutines: 200, calleeRoutines: 40 }],
  inbound: [
    { otherPackage: 'Integrated Billing', callEdges: 250, callerRoutines: 90, calleeRoutines: 30 },
  ],
  topRoutines: [{ routineName: 'PRCABIG', lineCount: 900, inDegree: 40, outDegree: 12 }],
};

describe('renderPackageDashboardHtml', () => {
  const html = renderPackageDashboardHtml(VIEW);

  it('shows the identity block (namespace, prefixes, app_code, vdl_id)', () => {
    assert.match(html, /Accounts Receivable/);
    assert.match(html, /PRCA,PRY,RC/);
    assert.match(html, /app_code/);
    assert.match(html, /29/);
  });

  it('shows manifest stats and the PIKS mix', () => {
    assert.match(html, /431/);
    assert.match(html, /90,000/);
    assert.match(html, /P: 4/);
    assert.match(html, /S: 28/);
  });

  it('shows couplings both directions and the routine leaderboard', () => {
    assert.match(html, /Kernel/);
    assert.match(html, /Integrated Billing/);
    assert.match(html, /PRCABIG/);
  });

  it('escapes HTML in data values', () => {
    const evil: PackageView = { ...VIEW, package: 'A<script>alert(1)</script>' };
    const out = renderPackageDashboardHtml(evil);
    assert.doesNotMatch(out, /<script>alert/);
    assert.match(out, /&lt;script&gt;/);
  });

  it('renders gracefully with only partial data', () => {
    const sparse: PackageView = {
      package: 'Mystery',
      namespace: undefined,
      manifest: undefined,
      piks: undefined,
      outbound: [],
      inbound: [],
      topRoutines: [],
    };
    const out = renderPackageDashboardHtml(sparse);
    assert.match(out, /Mystery/);
    assert.doesNotMatch(out, /undefined/);
  });
});
