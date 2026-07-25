#!/usr/bin/env node
// ============================================================================
// registry-resolve unit tests (offline, fixture-driven)
// ============================================================================
// WHAT THIS GUARDS
//
//   scripts/lib/registry-resolve.mjs decides whether a version claim is stale. Two ways it can
//   fail, and BOTH are silent:
//
//   1. Under-fire — the PyPI path returns null and every LangChain-ecosystem package reports
//      SKIP forever. That is the bug this module was written to fix, so a regression to it would
//      restore the original blind spot while the gate still exits 0.
//
//   2. Over-fire — a floor is compared by string equality, so `>=1.2.0` vs latest `1.2.9` reports
//      drift. Fires on every skill on every patch release, the gate becomes noise, and someone
//      baselines it away. A muted gate and a missing gate are the same gate.
//
//   Both cases are asserted explicitly below with the REAL version pairs from 2026-07-25.
//
// WHY OFFLINE
//
//   Fixtures, not live network. A PR gate that depends on pypi.org is a PR gate that goes red
//   when pypi.org has a bad afternoon, and flaky gates get ignored. Live probing belongs in the
//   nightly labs-version-watch workflow, not here.
// ============================================================================

import { parseSemver, parseFloor, compareFloor, comparePin, resolveLibrary, fetchLatest } from '../../scripts/lib/registry-resolve.mjs';

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failures.push(`${name}\n      expected ${e}\n      actual   ${a}`);
  }
}

console.log('==========================================');
console.log('  registry-resolve');
console.log('==========================================\n');

// --- parsing -----------------------------------------------------------------
check('parseSemver 1.2.9', parseSemver('1.2.9'), [1, 2, 9]);
check('parseSemver v4.14.1', parseSemver('v4.14.1'), [4, 14, 1]);
check('parseSemver 1.2 (no patch)', parseSemver('1.2'), [1, 2, 0]);
check('parseSemver prerelease', parseSemver('1.2.0a6'), [1, 2, 0]);
check('parseSemver garbage', parseSemver('not-a-version'), null);
check('parseFloor >=1.2.0', parseFloor('>=1.2.0'), [1, 2, 0]);
check('parseFloor ^4.0.0', parseFloor('^4.0.0'), [4, 0, 0]);

// --- floor semantics: THE anti-noise contract --------------------------------
// The real pair from 2026-07-25. langgraph declares >=1.2.0; PyPI latest is 1.2.9.
// The floor is SATISFIED. If this ever reports anything but ok, the gate has become a
// patch-release siren and will be muted.
check(
  'floor >=1.2.0 vs 1.2.9 is SATISFIED (must stay quiet)',
  compareFloor('>=1.2.0', '1.2.9').severity,
  'ok'
);

// The @langchain/langgraph pair that went unnoticed: floor 1.2.0, npm latest 1.4.8.
check(
  'floor >=1.2.0 vs 1.4.8 is minor-behind (must fire)',
  compareFloor('>=1.2.0', '1.4.8').severity,
  'minor-behind'
);

check('floor >=1.2.0 vs 2.0.1 is major-behind', compareFloor('>=1.2.0', '2.0.1').severity, 'major-behind');
check('floor >=4.0.0 vs 4.0.9 stays quiet', compareFloor('>=4.0.0', '4.0.9').severity, 'ok');
check('floor >=9.0.0 vs 1.2.9 is unsatisfiable', compareFloor('>=9.0.0', '1.2.9').severity, 'unsatisfiable');
check('floor with unparseable latest', compareFloor('>=1.2.0', 'nightly').severity, 'unknown');

// --- pin semantics -----------------------------------------------------------
check('pin 1.2.9 vs 1.2.9 is current', comparePin('1.2.9', '1.2.9').severity, 'current');
check('pin 1.2.8 vs 1.2.9 is patch', comparePin('1.2.8', '1.2.9').severity, 'patch');
check('pin 1.2.9 vs 1.3.0 is minor', comparePin('1.2.9', '1.3.0').severity, 'minor');
check('pin 1.2.9 vs 2.0.0 is major', comparePin('1.2.9', '2.0.0').severity, 'major');
check('pin ahead of upstream is flagged', comparePin('9.9.9', '1.2.9').severity, 'ahead-of-upstream');

// --- registry routing: the original blind spot -------------------------------
// Every one of these was invisible to the old npm-only resolver.
for (const pkg of ['langgraph', 'langchain', 'langchain-core', 'langfuse', 'deepeval', 'ragas', 'sqlalchemy', 'fastapi', 'locust', 'mcp']) {
  check(`${pkg} routes to pypi`, resolveLibrary(pkg)?.registry, 'pypi');
}
for (const pkg of ['agent-browser', '@json-render/core', '@langchain/langgraph', '@langfuse/otel', 'vitest', 'zustand', 'storybook']) {
  check(`${pkg} routes to npm`, resolveLibrary(pkg)?.registry, 'npm');
}

// Alias: the name a skill DECLARES is not always the name the registry PUBLISHES. Without the
// alias, "next.js" 404s on npm and reports SKIP forever — a hole that reads as coverage.
check('next.js aliases to the npm package "next"', resolveLibrary('next.js'), { registry: 'npm', pkg: 'next' });
check('unaliased name resolves to itself', resolveLibrary('langfuse'), { registry: 'pypi', pkg: 'langfuse' });
check('unmapped library resolves to null', resolveLibrary('k6'), null);

// --- resolver dispatch, with injected fakes (no network) ---------------------
const pypiFixture = { info: { version: '4.14.1' } };
const fakeFetch = async (url) => {
  if (!String(url).startsWith('https://pypi.org/pypi/')) throw new Error(`unexpected url ${url}`);
  return { ok: true, json: async () => pypiFixture };
};
check('pypi dispatch reads info.version', await fetchLatest('langfuse', { fetchImpl: fakeFetch }), '4.14.1');
check(
  'npm dispatch uses the npm impl, not fetch',
  await fetchLatest('agent-browser', { npmImpl: () => '0.29.1', fetchImpl: fakeFetch }),
  '0.29.1'
);
check(
  'pypi 404 resolves to null, never throws',
  await fetchLatest('langfuse', { fetchImpl: async () => ({ ok: false, json: async () => ({}) }) }),
  null
);
check(
  'network error resolves to null, never throws',
  await fetchLatest('langfuse', { fetchImpl: async () => { throw new Error('ENOTFOUND'); } }),
  null
);
check('unknown library resolves to null', await fetchLatest('definitely-not-a-real-pkg'), null);

// --- report ------------------------------------------------------------------
console.log(`  passed: ${passed}`);
console.log(`  failed: ${failures.length}\n`);
if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log('registry-resolve: all assertions passed');
