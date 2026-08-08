#!/usr/bin/env node
/**
 * Derive the CC hook-output key contract from the shipped binary.
 *
 * WHY
 *
 * The 2026-08-08 audit found one defect thirty-four times: OrchestKit writes to
 * CC contracts nobody verified against the binary. The guard meant to prevent
 * that held hand-typed allow-lists which had themselves drifted — it stripped
 * additionalContext from Stop, SubagentStop and PostToolBatch, all three of
 * which CC documents as consumers, silently deleting output from six live
 * hooks.
 *
 * This script closes that loop. CC ships its own hooks reference as string
 * literals inside the binary, so the contract is derivable rather than
 * remembered.
 *
 * MODES
 *
 *   node scripts/derive-cc-output-keys.mjs           print what the binary says
 *   node scripts/derive-cc-output-keys.mjs --check   fail if the generated
 *                                                    module contradicts it
 *
 * WHERE IT RUNS
 *
 * Locally and on workflow_dispatch, NEVER in ci.yml — ci.yml does not install
 * the CC binary. CI verifies the committed generated module against the spec;
 * only this script talks to the binary. A gate that cannot find the binary
 * reports CANNOT-OBSERVE and exits 2. It never reports a pass it did not earn.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const GENERATED = join(REPO, 'src/hooks/bin/cc-output-keys.generated.mjs');

const EXIT_OK = 0;
const EXIT_DRIFT = 1;
const EXIT_CANNOT_OBSERVE = 2;

/** Resolve the real binary, not the shim. `command -v claude` may be a wrapper. */
function findBinary() {
  const versions = join(homedir(), '.local/share/claude/versions');
  if (!existsSync(versions)) return null;
  const candidates = readdirSync(versions)
    .filter((n) => /^\d+\.\d+\.\d+$/.test(n))
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  if (candidates.length === 0) return null;
  const newest = join(versions, candidates[candidates.length - 1]);
  return statSync(newest).isFile() ? { path: newest, version: candidates[candidates.length - 1] } : null;
}

/**
 * Pull the documentation lines CC embeds about additionalContext consumers.
 * Returns the set of events the binary NAMES as reading additionalContext.
 */
function additionalContextEventsFrom(strings) {
  const found = new Set();

  // CC documents per-event consumers in prose, e.g.
  //   "Hook-specific output for the Stop event. additionalContext is non-error
  //    feedback delivered to the model..."
  const prose = /Hook-specific output for the (\w+) event\.\s*additionalContext/g;
  for (const m of strings.matchAll(prose)) found.add(m[1]);

  // And in imperative form for batched events:
  //   "Return additionalContext via hookSpecificOutput to inject context once
  //    for the whole batch."
  if (/Return additionalContext via hookSpecificOutput[\s\S]{0,80}whole batch/.test(strings)) {
    found.add('PostToolBatch');
  }
  return found;
}

async function main() {
  const check = process.argv.includes('--check');

  const bin = findBinary();
  if (!bin) {
    console.error('CANNOT OBSERVE: no CC binary under ~/.local/share/claude/versions');
    console.error('  This script must run where CC is installed. CI does not install it;');
    console.error('  CI verifies the committed generated module instead.');
    process.exit(EXIT_CANNOT_OBSERVE);
  }

  let strings;
  try {
    strings = execFileSync('strings', ['-a', '-n', '6', bin.path], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (err) {
    console.error(`CANNOT OBSERVE: strings failed on ${bin.path} — ${err.message}`);
    process.exit(EXIT_CANNOT_OBSERVE);
  }

  // Self-check: a run that finds nothing must not report a pass. This is the
  // same discipline as tests/unit/test-no-llm-in-ci.sh:40-45.
  if (!strings.includes('hookSpecificOutput')) {
    console.error('CANNOT OBSERVE: binary yielded no "hookSpecificOutput" literal.');
    console.error('  Either the extraction broke or CC stopped embedding its reference.');
    console.error('  Refusing to report a contract derived from nothing.');
    process.exit(EXIT_CANNOT_OBSERVE);
  }

  const binaryEvents = additionalContextEventsFrom(strings);
  console.log(`CC ${bin.version} — events the binary NAMES as additionalContext consumers:`);
  for (const e of [...binaryEvents].sort()) console.log(`  ${e}`);

  if (!check) {
    console.log('\n(run with --check to compare against the generated module)');
    process.exit(EXIT_OK);
  }

  // Import the module and read the ACTUAL Set. An earlier version of this check
  // grepped the file text for `'Stop'`, which matched inside a comment and
  // inside KEY_EVENTS — so it reported OK against a deliberately broken
  // allow-list. A gate that cannot fail is not a gate.
  let generated;
  try {
    generated = await import(pathToFileURL(GENERATED).href + `?t=${process.hrtime.bigint()}`);
  } catch (err) {
    console.error(`CANNOT OBSERVE: failed to import ${GENERATED} — ${err.message}`);
    process.exit(EXIT_CANNOT_OBSERVE);
  }

  const allowed = generated.EVENTS_WITH_ADDITIONAL_CONTEXT;
  if (!(allowed instanceof Set) || allowed.size === 0) {
    console.error('CANNOT OBSERVE: EVENTS_WITH_ADDITIONAL_CONTEXT is not a non-empty Set.');
    process.exit(EXIT_CANNOT_OBSERVE);
  }

  const missing = [...binaryEvents].filter((e) => !allowed.has(e));

  if (missing.length > 0) {
    console.error('\nDRIFT: the binary documents these as additionalContext consumers,');
    console.error('but they are absent from the generated allow-list:');
    for (const e of missing) console.error(`  ${e}`);
    console.error('\nThe guard would STRIP valid output on those events.');
    console.error('Update spec/cc-output-keys.spec.yml and regenerate.');
    process.exit(EXIT_DRIFT);
  }

  console.log('\nOK: every event the binary names is present in the generated allow-list.');
  process.exit(EXIT_OK);
}

main();
