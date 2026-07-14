#!/usr/bin/env node

/**
 * Hook Registry Closure Validation (#959 / #2886 bug class)
 *
 * A hook can be registered in the entries maps, tested, built, and released
 * without anything ever asserting it actually FIRES. That gap shipped:
 *   - #959:  3 telemetry streams dead for 4 months
 *   - #2886: team-size-gate released dead (guarded 'Task', matcher 'Agent')
 *   - 2026-07-15 audit: 48 silently-dead hooks, 10 dead telemetry writers
 *
 * This script computes the full REACHABILITY CLOSURE and fails CI on drift:
 *
 *   registered  = hook ids in src/entries TS registry maps
 *   direct      = ids dispatched by hooks.json (args OR legacy command form)
 *   fanout      = ids imported (transitively) by reachable dispatcher files
 *   agentScoped = ids referenced by src/agents markdown frontmatter hooks
 *   skillScoped = ids referenced by SKILL.md frontmatter hooks
 *   closure     = direct ∪ fanout ∪ agentScoped ∪ skillScoped
 *
 * FAIL conditions:
 *   1. GHOST:  closure references an id that is NOT registered (runtime failure)
 *   2. NEW DEAD: registered id outside the closure that is not grandfathered
 *      in known-dead-hooks.json (the ratchet baseline — shrink it, never grow it)
 *   3. STALE BASELINE: baseline entry that is no longer dead (revived/deleted)
 *      — must be removed so the baseline stays honest
 *   4. COUNT DRIFT: the "N global + N agent-scoped + N skill-scoped = N total"
 *      accounting in hooks.json's description no longer matches reality
 *   5. SELF-CHECK: hooks.json parses to zero dispatch ids (the failure mode
 *      that silently killed the previous version of this script)
 *
 * Usage: node scripts/validate-registry.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const hooksRoot = join(__dirname, '..');
const repoRoot = join(hooksRoot, '..', '..');
const BASELINE_PATH = join(__dirname, 'known-dead-hooks.json');

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/** Extract a hook id from one hooks.json hook object (args form or legacy string). */
function idFromHookObj(hook) {
  if (Array.isArray(hook.args)) {
    const i = hook.args.findIndex(a => typeof a === 'string' && a.includes('run-hook.mjs'));
    if (i !== -1 && typeof hook.args[i + 1] === 'string') return hook.args[i + 1].trim();
  }
  if (typeof hook.command === 'string') {
    const m = hook.command.match(/run-hook\.mjs\s+([\w/.-]+)/);
    if (m) return m[1].trim();
  }
  return null;
}

/** hooks.json → { ids:Set, commandCount:number } */
function parseHooksJson() {
  const data = JSON.parse(readFileSync(join(hooksRoot, 'hooks.json'), 'utf-8'));
  const ids = new Set();
  let commandCount = 0;
  for (const groups of Object.values(data.hooks)) {
    for (const group of groups) {
      for (const hook of group.hooks || []) {
        commandCount++;
        const id = idFromHookObj(hook);
        if (id) ids.add(id);
      }
    }
  }
  return { ids, commandCount, description: data.description || '' };
}

/** entries/*.ts registry maps → Set of registered hook ids */
function parseEntryFiles() {
  const entriesDir = join(hooksRoot, 'src', 'entries');
  const registered = new Set();
  for (const file of readdirSync(entriesDir).filter(f => f.endsWith('.ts'))) {
    const content = readFileSync(join(entriesDir, file), 'utf-8');
    const block = content.match(/export\s+const\s+hooks\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)\n\};/);
    if (!block) continue;
    const keyRegex = /['"]([\w/.-]+)['"]\s*:/g;
    let m;
    while ((m = keyRegex.exec(block[1])) !== null) registered.add(m[1]);
  }
  return registered;
}

/** run-hook.mjs references in agent/skill markdown frontmatter → Set of ids */
function parseMarkdownHookRefs(files) {
  const ids = new Set();
  let refCount = 0;
  const re = /run-hook\.mjs\s+([\w/.-]+)/g;
  for (const f of files) {
    const content = readFileSync(f, 'utf-8');
    let m;
    while ((m = re.exec(content)) !== null) {
      ids.add(m[1]);
      refCount++;
    }
  }
  return { ids, refCount };
}

function agentFiles() {
  const dir = join(repoRoot, 'src', 'agents');
  return readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .map(f => join(dir, f));
}

function skillFiles() {
  const dir = join(repoRoot, 'src', 'skills');
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const p = join(dir, d.name, 'SKILL.md');
    if (existsSync(p)) out.push(p);
  }
  return out;
}

/**
 * Transitive dispatcher fan-out. A reachable hook whose id contains
 * "dispatcher" runs sibling hooks in-process via relative imports —
 * those imports ARE dispatch edges.
 */
function dispatcherFanout(seeds, registered) {
  const reachable = new Set(seeds);
  const queue = [...seeds].filter(id => id.includes('dispatcher'));
  const seen = new Set();
  while (queue.length > 0) {
    const id = queue.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const file = join(hooksRoot, 'src', `${id}.ts`);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf-8');
    const importRe = /from\s+['"](\.\.?\/[\w/.-]+)\.js['"]/g;
    let m;
    while ((m = importRe.exec(content)) !== null) {
      const resolved = normalize(join(dirname(id), m[1])).split(sep).join('/');
      if (registered.has(resolved) && !reachable.has(resolved)) {
        reachable.add(resolved);
        if (resolved.includes('dispatcher')) queue.push(resolved);
      }
    }
  }
  return reachable;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { ids: directIds, commandCount, description } = parseHooksJson();
  const registered = parseEntryFiles();
  const agents = parseMarkdownHookRefs(agentFiles());
  const skills = parseMarkdownHookRefs(skillFiles());

  const failures = [];

  // 5. SELF-CHECK — the previous version of this script parsed the legacy
  // command format, saw 0 hooks.json ids, and PASSED for months. Never again.
  if (directIds.size === 0) {
    failures.push('SELF-CHECK: parsed 0 hook ids out of hooks.json — the parser no longer matches the hooks.json schema.');
  }
  if (registered.size === 0) {
    failures.push('SELF-CHECK: parsed 0 registered ids out of src/entries/*.ts — the parser no longer matches the entries format.');
  }

  // Closure
  const seeds = new Set([...directIds, ...agents.ids, ...skills.ids]);
  const closure = dispatcherFanout(seeds, registered);

  // 1. GHOSTS — referenced but not registered → fails at runtime
  const ghosts = [...seeds].filter(id => !registered.has(id)).sort();
  if (ghosts.length > 0) {
    failures.push(`GHOSTS (${ghosts.length}): referenced by hooks.json/frontmatter but NOT in any entries map — these FAIL AT RUNTIME:\n    ${ghosts.join('\n    ')}`);
  }

  // 2/3. DEAD vs ratchet baseline
  const dead = [...registered].filter(id => !closure.has(id)).sort();
  const baseline = existsSync(BASELINE_PATH)
    ? new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')).grandfathered)
    : new Set();
  const newDead = dead.filter(id => !baseline.has(id));
  const staleBaseline = [...baseline].filter(id => !dead.includes(id)).sort();

  if (newDead.length > 0) {
    failures.push(
      `NEW DEAD HOOKS (${newDead.length}): registered but unreachable from hooks.json ∪ agent/skill frontmatter ∪ dispatcher fan-out.\n` +
      `  Wire each into a dispatch path, or delete it. Do NOT add to the baseline — it only shrinks.\n    ${newDead.join('\n    ')}`,
    );
  }
  if (staleBaseline.length > 0) {
    failures.push(
      `STALE BASELINE (${staleBaseline.length}): no longer dead (revived or deleted) — remove from scripts/known-dead-hooks.json:\n    ${staleBaseline.join('\n    ')}`,
    );
  }

  // 4. COUNT DRIFT — hooks.json description declares the accounting
  const countMatch = description.match(/(\d+)\s+global\s*\+\s*(\d+)\s+agent-scoped\s*\+\s*(\d+)\s+skill-scoped\s*=\s*(\d+)\s+total/);
  if (countMatch) {
    const [declGlobal, declAgent, declSkill, declTotal] = countMatch.slice(1).map(Number);
    const actual = { global: commandCount, agent: agents.refCount, skill: skills.refCount };
    const actualTotal = actual.global + actual.agent + actual.skill;
    const drift = [];
    if (declGlobal !== actual.global) drift.push(`global ${declGlobal}→${actual.global}`);
    if (declAgent !== actual.agent) drift.push(`agent-scoped ${declAgent}→${actual.agent}`);
    if (declSkill !== actual.skill) drift.push(`skill-scoped ${declSkill}→${actual.skill}`);
    if (declTotal !== actualTotal) drift.push(`total ${declTotal}→${actualTotal}`);
    if (drift.length > 0) {
      failures.push(`COUNT DRIFT: hooks.json description says "${declGlobal} global + ${declAgent} agent-scoped + ${declSkill} skill-scoped = ${declTotal} total" but computed: ${drift.join(', ')}. Update the description (and CLAUDE.md per count-sync rule).`);
    }
  } else {
    failures.push('COUNT DRIFT: could not find "N global + N agent-scoped + N skill-scoped = N total" in hooks.json description — restore the accounting string.');
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  console.log('Hook Registry Closure Validation');
  console.log('================================');
  console.log(`registered (entries maps) : ${registered.size}`);
  console.log(`hooks.json dispatch cmds  : ${commandCount} (${directIds.size} unique ids)`);
  console.log(`agent-scoped refs         : ${agents.refCount} (${agents.ids.size} unique ids)`);
  console.log(`skill-scoped refs         : ${skills.refCount} (${skills.ids.size} unique ids)`);
  console.log(`reachable closure         : ${closure.size}`);
  console.log(`dead (grandfathered)      : ${dead.length - newDead.length} of baseline ${baseline.size}`);
  console.log('');

  if (failures.length > 0) {
    for (const f of failures) console.error(`✗ ${f}\n`);
    console.error(`Result: FAIL (${failures.length} failure class${failures.length > 1 ? 'es' : ''})`);
    process.exit(1);
  }
  console.log(`Result: PASS (${dead.length} grandfathered dead hooks remain — shrink the baseline as they are revived or buried)`);
  process.exit(0);
}

main();
