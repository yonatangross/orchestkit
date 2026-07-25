// scripts/lib/registry-resolve.mjs — resolve "latest published version" from npm OR PyPI,
// and compare a declared floor against it.
//
// WHY THIS EXISTS
//
// check-labs-versions.mjs resolved versions with `npm view` and nothing else. Every package it
// watched was on npm, so nobody noticed that the resolver was structurally npm-only. The entire
// LangChain ecosystem (langgraph, langchain, langfuse, deepeval, ragas) lives on PyPI and was
// therefore invisible to the only currency gate this repo has — which is how a skill came to
// declare `@langchain/langgraph >=1.2.0` while upstream sat at 1.4.8, and how four snippets
// importing a symbol that has never existed shipped for months.
//
// WHAT THIS CANNOT DO — read before trusting it
//
// This module answers "is the pinned/declared VERSION current?". It cannot answer "does the
// SYMBOL this doc imports exist?". `LangfuseExporter` was never published at ANY version of
// @langfuse/otel, so no version comparison would ever have flagged it. That needs an
// import-symbol check against the published type declarations — a separate gate.
//
// Pure functions + one network call. No subprocess, no Python toolchain.

import { execFileSync } from 'node:child_process';

/**
 * Registry for each library name a skill can declare. Unknown => skipped LOUDLY, never silently.
 *
 * Value is either a registry string, or `{ registry, pkg }` when the name a skill declares differs
 * from the published package name (e.g. a skill says "next.js"; npm calls it "next"). Without the
 * alias the lookup 404s and the entry reports SKIP forever — a silent hole that looks like coverage.
 */
export const LIBRARY_REGISTRY = {
  // --- npm ---
  emulate: 'npm',
  portless: 'npm',
  'agent-browser': 'npm',
  '@json-render/core': 'npm',
  '@json-render/mcp': 'npm',
  '@wterm/dom': 'npm',
  '@wterm/react': 'npm',
  '@langchain/langgraph': 'npm',
  '@langfuse/otel': 'npm',
  '@langfuse/client': 'npm',
  '@langfuse/tracing': 'npm',
  '@langfuse/langchain': 'npm',
  '@langfuse/vercel-ai-sdk': 'npm',
  motion: 'npm',
  remotion: 'npm',
  'style-dictionary': 'npm',
  'react-i18next': 'npm',
  dayjs: 'npm',
  '@modelcontextprotocol/sdk': 'npm',
  'next.js': { registry: 'npm', pkg: 'next' },
  react: 'npm',
  storybook: 'npm',
  '@playwright/test': 'npm',
  '@pact-foundation/pact': 'npm',
  vitest: 'npm',
  vite: 'npm',
  zustand: 'npm',
  // testing-integration means the Node client; PyPI also publishes a `testcontainers`.
  testcontainers: 'npm',
  // The json-render family. Left unmapped, `@json-render/shadcn` sat in the skip bucket while its
  // docs imported `shadcnCatalog`, a symbol it does not export — coverage debt hiding a real defect.
  next: 'npm',
  zod: 'npm',
  '@json-render/react': 'npm',
  '@json-render/shadcn': 'npm',
  '@json-render/react-pdf': 'npm',
  '@json-render/react-email': 'npm',
  '@json-render/svelte': 'npm',
  '@json-render/vue': 'npm',
  '@json-render/solid': 'npm',
  '@json-render/ink': 'npm',
  '@json-render/yaml': 'npm',
  '@json-render/next': 'npm',
  '@langfuse/openai': 'npm',
  '@langfuse/core': 'npm',
  'react-aria': 'npm',
  'react-stately': 'npm',
  msw: 'npm',
  '@testing-library/react': 'npm',
  'jest-axe': 'npm',
  'lucide-react': 'npm',
  '@storybook/react': 'npm',
  '@tanstack/react-query': 'npm',

  // --- PyPI ---
  langgraph: 'pypi',
  langchain: 'pypi',
  'langchain-core': 'pypi',
  langfuse: 'pypi',
  deepeval: 'pypi',
  ragas: 'pypi',
  sqlalchemy: 'pypi',
  fastapi: 'pypi',
  locust: 'pypi',
  mcp: 'pypi',

  // Deliberately unmapped: `k6` ships as a Go binary from Grafana, not as a registry package.
  // Its npm entry is an unrelated stub, so mapping it would produce a confidently wrong answer —
  // worse than an honest SKIP.
};

/** Resolve a declared library name to `{ registry, pkg }`, or null when unmapped. */
export function resolveLibrary(name) {
  const entry = LIBRARY_REGISTRY[name];
  if (!entry) return null;
  return typeof entry === 'string' ? { registry: entry, pkg: name } : { ...entry };
}

/**
 * `npm view <pkg> version`. Returns null on any failure.
 *
 * execFileSync with an argv array, NOT execSync with an interpolated string: no shell is spawned,
 * so a package name can never be read as shell syntax. The names are repo-controlled today, but a
 * resolver that takes a package name as a parameter should not depend on that staying true.
 */
function fetchNpmLatest(pkg) {
  try {
    return execFileSync('npm', ['view', pkg, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * PyPI JSON API. Deliberately NOT `pip index` / `pip install --dry-run`: those need a Python
 * toolchain in a Node-only CI job, and pull the whole resolver in to answer one question.
 */
async function fetchPypiLatest(pkg, { fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.info?.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve latest for a declared library name, dispatching on its registry and honouring any
 * package-name alias. Returns null if unresolvable — never throws, so one dead registry cannot
 * take down the whole sweep.
 */
export async function fetchLatest(name, opts = {}) {
  const resolved = resolveLibrary(name);
  const registry = opts.registry ?? resolved?.registry;
  const pkg = resolved?.pkg ?? name;
  if (registry === 'pypi') return fetchPypiLatest(pkg, opts);
  if (registry === 'npm') return (opts.npmImpl ?? fetchNpmLatest)(pkg);
  return null;
}

/** "1.2.9" -> [1,2,9]. Tolerates a leading v and any prerelease/build suffix. */
export function parseSemver(v) {
  const m = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

/** Extract the numeric part of a floor expression like ">=1.2.0", "^4.0.0", "1.2". */
export function parseFloor(expr) {
  const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(expr ?? ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

/**
 * Compare a declared FLOOR against the latest published version.
 *
 * A FLOOR IS NOT A PIN. This is the distinction that decides whether the gate is one people act on
 * or one they mute. `langgraph >=1.2.0` against latest 1.2.9 is SATISFIED — the floor is doing its
 * job and there is nothing to do. Reporting that as "drift" would fire on every skill on every
 * patch release, and a gate that always cries wolf gets baselined into silence.
 *
 * Severities:
 *   ok           latest is inside the floor's minor line (>= floor, same major.minor)
 *   patch        (folded into ok — a patch bump never invalidates a floor)
 *   minor-behind upstream moved a minor or more; content MAY be missing features. Advisory.
 *   major-behind upstream moved a major; the skill may document a superseded major. Actionable.
 *   unsatisfiable latest is BELOW the floor. Always a defect: a typo, or a yanked release.
 */
export function compareFloor(floorExpr, latest) {
  const floor = parseFloor(floorExpr);
  const cur = parseSemver(latest);
  if (!floor || !cur) return { severity: 'unknown', floor: floorExpr, latest };

  if (cmp(cur, floor) < 0) return { severity: 'unsatisfiable', floor: floorExpr, latest };
  if (cur[0] > floor[0]) return { severity: 'major-behind', floor: floorExpr, latest };
  if (cur[1] > floor[1]) return { severity: 'minor-behind', floor: floorExpr, latest };
  return { severity: 'ok', floor: floorExpr, latest };
}

/**
 * Compare an `upstream-version-tested:` PIN against latest. A pin means "this is the release we
 * actually read", so ANY difference is real drift — but the severity tells a reviewer whether to
 * re-read the content or just accept the bump.
 */
export function comparePin(pinned, latest) {
  const p = parseSemver(pinned);
  const c = parseSemver(latest);
  if (!p || !c) return { severity: 'unknown', pinned, latest };
  const d = cmp(c, p);
  if (d === 0) return { severity: 'current', pinned, latest };
  if (d < 0) return { severity: 'ahead-of-upstream', pinned, latest };
  if (c[0] > p[0]) return { severity: 'major', pinned, latest };
  if (c[1] > p[1]) return { severity: 'minor', pinned, latest };
  return { severity: 'patch', pinned, latest };
}
