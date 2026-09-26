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
 *   node scripts/derive-cc-output-keys.mjs            print what the binary says
 *   node scripts/derive-cc-output-keys.mjs --check    fail if the generated
 *                                                     module contradicts it
 *
 * The check-mode gate is BIDIRECTIONAL (#3418). It used to be missing-only:
 *
 *   binaryEvents.filter(e => !allowed.has(e))
 *
 * which fails when the binary names an event the allow-list LACKS, but is
 * structurally silent when the allow-list asserts an event the binary does
 * not name. 6 of the 9 EVENTS_WITH_ADDITIONAL_CONTEXT entries were exactly
 * that, uncorroborated in either direction, and one of them (PostCompact) had
 * independent evidence of being wrong. The gate now also fails on THAT
 * direction, with one escape hatch: an allow-list entry can be listed in
 * ADDITIONAL_CONTEXT_REVIEWED_EXCEPTIONS (cc-output-keys.generated.mjs) if it
 * was settled by trace-and-observe evidence instead of binary prose. See
 * that Set's doc comment and spec/cc-output-keys.spec.yml's
 * additionalContext.reviewed_exceptions for the bar an exception must clear.
 * An uncorroborated entry with no reviewed exception fails check mode; this is
 * deliberate, not a bug to route around by adding more exceptions.
 *
 * The same bidirectional arbitration applies to EVENTS_WITH_HOOK_EVENT_NAME
 * (#4291). Truth is the hookEventName:R("Event") literals in the binary's
 * output-schema union (22 variants on CC 2.1.278). Escape hatch:
 * HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS, for entries settled without a matching
 * R("...") literal (PostCompact: input schema only, no output variant).
 *
 * WHERE IT RUNS
 *
 * Locally and on workflow_dispatch, NEVER in ci.yml — ci.yml does not install
 * the CC binary. CI verifies the committed generated module against the spec;
 * only this script talks to the binary. A gate that cannot find the binary
 * reports CANNOT-OBSERVE and exits 2. It never reports a pass it did not earn.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const GENERATED = join(REPO, 'src/hooks/bin/cc-output-keys.generated.mjs');
const SPEC = join(REPO, 'spec/cc-output-keys.spec.yml');

const EXIT_OK = 0;
const EXIT_DRIFT = 1;
const EXIT_CANNOT_OBSERVE = 2;
const EXIT_UNREVIEWED = 3;
const MAX_SCHEMA_SCAN_CHARS = 64 * 1024;
const MAX_SCHEMA_CANDIDATES = 128;

/**
 * Resolve the real binary, not the shim. TWO layouts ship it and only one of
 * them was ever checked (#3409):
 *
 *   native installer   ~/.local/share/claude/versions/<x.y.z>
 *   npm install -g     <prefix>/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
 *
 * The npm layout is what a GitHub runner has, and there NONE of the
 * ~/.local/share/claude paths exist at all. Measured on run 31402464119, where
 * this gate printed `/home/runner/.local/share/claude/versions: ABSENT` and
 * exited 2, so the nightly contract probe could never observe anything. The
 * package's own `install.cjs` writes its payload to
 * `join(__dirname, 'bin', 'claude.exe')` inside the package directory, delivered
 * through per-platform optionalDependencies, and it is the SAME artifact: 2.1.226
 * measures 279,661,952 bytes in both layouts.
 *
 * The shim risk the previous version of this comment named is real, and is
 * handled by the CALLER rather than here: it requires a `hookSpecificOutput`
 * literal in the extracted strings and reports CANNOT-OBSERVE when it is absent.
 * A wrapper script therefore cannot produce a vacuous pass, which matters
 * because the drift check is missing-only and an empty event set has an empty
 * difference. Do not remove that check on the assumption this function only ever
 * returns real binaries.
 */
function findBinary() {
  return binaryFromVersionsDir() ?? binaryFromPath();
}

/** Use a specific observed artifact when reproducing an evidence record. */
function binaryFromOverride(requested) {
  try {
    const path = realpathSync(requested);
    if (!statSync(path).isFile()) return null;
    return { path, version: versionNear(path) ?? 'unknown' };
  } catch {
    return null;
  }
}

/** The native installer's layout: a versioned file per release. */
function binaryFromVersionsDir() {
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
 * Walk PATH for `claude` and follow symlinks to whatever it really is.
 *
 * PATH is scanned directly rather than shelling out, because `command -v` is a
 * shell builtin and not an executable, and `which` is not guaranteed present on
 * a minimal image. Directories and unreadable entries are skipped rather than
 * returned, so a `claude/` directory on PATH cannot masquerade as the binary.
 */
function binaryFromPath() {
  for (const dir of (process.env.PATH || '').split(delimiter).filter(Boolean)) {
    const candidate = join(dir, 'claude');
    if (!existsSync(candidate)) continue;
    try {
      const real = realpathSync(candidate);
      if (!statSync(real).isFile()) continue;
      return { path: real, version: versionNear(real) ?? 'unknown' };
    } catch {
      continue; // broken symlink or permission denied: keep looking
    }
  }
  return null;
}

/** Best-effort version for a resolved binary, by layout. */
function versionNear(binPath) {
  const native = binPath.match(/\/versions\/(\d+\.\d+\.\d+)$/);
  if (native) return native[1];

  // npm: <pkg>/bin/claude.exe sits two levels under <pkg>/package.json
  const pkgJson = join(dirname(dirname(binPath)), 'package.json');
  if (existsSync(pkgJson)) {
    try {
      const version = JSON.parse(readFileSync(pkgJson, 'utf8')).version;
      if (typeof version === 'string' && version) return version;
    } catch {
      // fall through to unknown: a version we cannot read is not fatal here,
      // the contract comes from the binary's strings, not from its version
    }
  }
  return null;
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

/**
 * Events whose hookSpecificOutput schema declares hookEventName:R("X").
 * Measured on CC 2.1.278: 22 variants. This is the closed set the guard's
 * EVENTS_WITH_HOOK_EVENT_NAME must track (#4291). Presence proves the parser
 * ACCEPTS the envelope; it does not prove runtime delivery of every key.
 */
function hookEventNameEventsFrom(strings) {
  const found = new Set();
  const re = /hookEventName:R\("([A-Za-z]+)"\)/g;
  for (const m of strings.matchAll(re)) found.add(m[1]);
  return found;
}

/**
 * Events whose output-schema variant accepts additionalContext.
 *
 * Find the event's enclosing object without relying on a minifier constructor
 * name. additionalContext must be a direct field of that object, so a key on a
 * neighbouring or nested object cannot satisfy the evidence gate.
 */
function additionalContextSchemaEventsFrom(strings) {
  const found = new Set();
  const event = /hookEventName:R\("([A-Za-z]+)"\)/g;
  for (const m of strings.matchAll(event)) {
    const schemaObject = enclosingEventObject(strings, m.index);
    if (
      schemaObject &&
      (hasDirectProperty(schemaObject.source, 'additionalContext') ||
        hasAdditionalContextExtension(strings, schemaObject.end, 'additionalContext'))
    ) {
      found.add(m[1]);
    }
  }
  return found;
}

function enclosingEventObject(strings, eventIndex) {
  const minimumStart = Math.max(0, eventIndex - MAX_SCHEMA_SCAN_CHARS);
  const maximumEnd = Math.min(strings.length, eventIndex + MAX_SCHEMA_SCAN_CHARS);
  let start = strings.lastIndexOf('{', eventIndex);
  let candidates = 0;
  while (start >= minimumStart && candidates < MAX_SCHEMA_CANDIDATES) {
    const end = matchingBrace(strings, start, maximumEnd);
    if (end >= eventIndex && braceDepthAt(strings, start, eventIndex) === 1) {
      return { source: strings.slice(start, end + 1), end };
    }
    start = strings.lastIndexOf('{', start - 1);
    candidates += 1;
  }
  return null;
}

function matchingBrace(strings, start, maximumEnd = strings.length) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < maximumEnd; i += 1) {
    const ch = strings[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * A schema generator may add a field with `u({...}).extend({...})`. The
 * extension is part of the same schema expression, so accept only a direct
 * property in the immediately chained extension object. Dynamic spreads stay
 * unproven because this extractor cannot safely resolve their source.
 */
function hasAdditionalContextExtension(strings, schemaEnd, property) {
  const suffixEnd = Math.min(strings.length, schemaEnd + MAX_SCHEMA_SCAN_CHARS);
  const suffix = strings.slice(schemaEnd + 1, suffixEnd);
  const extension = /^\s*\)\s*\.extend\s*\(\s*\{/.exec(suffix);
  if (!extension) return false;

  const extensionStart = schemaEnd + 1 + extension[0].lastIndexOf('{');
  const extensionEnd = matchingBrace(
    strings,
    extensionStart,
    Math.min(strings.length, extensionStart + MAX_SCHEMA_SCAN_CHARS),
  );
  return (
    extensionEnd >= 0 &&
    hasDirectProperty(strings.slice(extensionStart, extensionEnd + 1), property)
  );
}

function braceDepthAt(strings, start, index) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < index; i += 1) {
    const ch = strings[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
    }
  }
  return depth;
}

function hasDirectProperty(schemaObject, property) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < schemaObject.length; i += 1) {
    const ch = schemaObject[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      continue;
    }
    if (depth !== 1 || !schemaObject.startsWith(property, i)) continue;
    const before = schemaObject[i - 1] ?? '';
    const after = schemaObject[i + property.length] ?? '';
    if (/[$\w]/.test(before) || /[$\w]/.test(after)) continue;
    let cursor = i + property.length;
    while (/\s/.test(schemaObject[cursor] ?? '')) cursor += 1;
    if (schemaObject[cursor] === ':') return true;
  }
  return false;
}

/**
 * The generated module is hand-mirrored from the spec (its header says so),
 * so a --check that never opens the spec can report OK with the spec emptied
 * or deleted. Measured 2026-09-06 (tests/ci/fault-arms/verify-cc-keys.sh):
 * control 0, spec emptied 0, spec missing 0. Same class as the 37 gates in
 * #3938 that passed on absent input. Refuse to judge without the declared
 * source of truth; a comment-only file counts as absent.
 */
function requireSpec() {
  if (!existsSync(SPEC)) {
    console.error(`CANNOT OBSERVE: ${SPEC} is missing.`);
    console.error('  The generated module is mirrored from that spec; without it there is');
    console.error('  no source of truth to check against. Refusing to report a pass.');
    process.exit(EXIT_CANNOT_OBSERVE);
  }
  const live = readFileSync(SPEC, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));
  if (live.length === 0) {
    console.error(`CANNOT OBSERVE: ${SPEC} has no content beyond comments and blank lines.`);
    console.error('  An empty spec asserts nothing, so nothing here could be checked against it.');
    process.exit(EXIT_CANNOT_OBSERVE);
  }
}

async function main() {
  const check = process.argv.includes('--check');
  if (check) requireSpec();

  const requestedBinary = process.env.CC_OUTPUT_KEYS_BINARY;
  const bin = requestedBinary ? binaryFromOverride(requestedBinary) : findBinary();
  if (!bin) {
    if (requestedBinary) {
      console.error(`CANNOT OBSERVE: CC_OUTPUT_KEYS_BINARY is not a usable file: ${requestedBinary}`);
      console.error('  The explicit binary pin is authoritative, so no fallback binary was used.');
      process.exit(EXIT_CANNOT_OBSERVE);
    }
    console.error('CANNOT OBSERVE: no CC binary found. Looked in both known layouts:');
    console.error(`    native: ${join(homedir(), '.local/share/claude/versions')}/<x.y.z>`);
    console.error('    npm:    `claude` on PATH, symlinks followed');
    console.error('  This script must run where CC is installed. ci.yml does not install it;');
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

  const binaryAdditionalContext = additionalContextEventsFrom(strings);
  const binaryHookEventName = hookEventNameEventsFrom(strings);
  const binaryAdditionalContextSchema = additionalContextSchemaEventsFrom(strings);

  // Same vacuous-pass bar for the hookEventName schema extract (#4291): an
  // empty set has an empty difference against any allow-list subset.
  if (check && binaryHookEventName.size === 0) {
    console.error('CANNOT OBSERVE: binary yielded no hookEventName:R("...") literals.');
    console.error('  Refusing to report EVENTS_WITH_HOOK_EVENT_NAME arbitration from nothing.');
    process.exit(EXIT_CANNOT_OBSERVE);
  }

  console.log(`CC ${bin.version} - events the binary NAMES as additionalContext consumers:`);
  for (const e of [...binaryAdditionalContext].sort()) console.log(`  ${e}`);
  console.log(`CC ${bin.version} - events with hookEventName:R("...") in the output schema:`);
  for (const e of [...binaryHookEventName].sort()) console.log(`  ${e}`);
  console.log(`CC ${bin.version} - output-schema variants that accept additionalContext:`);
  for (const e of [...binaryAdditionalContextSchema].sort()) console.log(`  ${e}`);

  if (!check) {
    console.log('\n(run with check mode to compare against the generated module)');
    process.exit(EXIT_OK);
  }

  // Import the module and read the ACTUAL Set. An earlier version of this check
  // grepped the file text for `'Stop'`, which matched inside a comment and
  // inside KEY_EVENTS, so it reported OK against a deliberately broken
  // allow-list. A gate that cannot fail is not a gate.
  let generated;
  try {
    generated = await import(pathToFileURL(GENERATED).href + `?t=${process.hrtime.bigint()}`);
  } catch (err) {
    console.error(`CANNOT OBSERVE: failed to import ${GENERATED} - ${err.message}`);
    process.exit(EXIT_CANNOT_OBSERVE);
  }

  const reviewedAdditionalContext =
    generated.ADDITIONAL_CONTEXT_REVIEWED_EXCEPTIONS instanceof Set
      ? generated.ADDITIONAL_CONTEXT_REVIEWED_EXCEPTIONS
      : new Set();
  const schemaAcceptedAdditionalContext =
    generated.ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED instanceof Set
      ? generated.ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED
      : new Set();
  const acSchemaEvidence = inspectAdditionalContextSchemaEvidence({
    schemaAccepted: schemaAcceptedAdditionalContext,
    reviewedExceptions: reviewedAdditionalContext,
    schemaEvents: binaryAdditionalContextSchema,
    corroboratedEvents: binaryAdditionalContext,
  });
  printSchemaEvidence(schemaAcceptedAdditionalContext, binaryAdditionalContextSchema);

  const acDrift = arbitrateSet({
    label: 'EVENTS_WITH_ADDITIONAL_CONTEXT',
    key: 'additionalContext',
    allowed: generated.EVENTS_WITH_ADDITIONAL_CONTEXT,
    binaryEvents: binaryAdditionalContext,
    reviewedExceptions: reviewedAdditionalContext,
    schemaAccepted: schemaAcceptedAdditionalContext,
    missingHint: 'The guard would STRIP valid output on those events.',
    unreviewedHint:
      'Either settle by trace-and-observe and add to ADDITIONAL_CONTEXT_REVIEWED_EXCEPTIONS,\n' +
      'or (schema shape only) add to ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED, or remove the\n' +
      'entry from EVENTS_WITH_ADDITIONAL_CONTEXT if it is not actually supported.',
    reviewedLogHint:
      'CONFIRMED by trace-and-observe, not binary prose (reviewed exception,\n' +
      'see spec/cc-output-keys.spec.yml additionalContext.reviewed_exceptions):',
    schemaAcceptedLogHint:
      'ACCEPTED BY SCHEMA (binary output schema declares additionalContext;\n' +
      'runtime delivery unproven; see additionalContext.schema_accepted):',
  });

  const henDrift = arbitrateSet({
    label: 'EVENTS_WITH_HOOK_EVENT_NAME',
    key: 'hookEventName',
    allowed: generated.EVENTS_WITH_HOOK_EVENT_NAME,
    binaryEvents: binaryHookEventName,
    reviewedExceptions:
      generated.HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS instanceof Set
        ? generated.HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS
        : new Set(),
    missingHint:
      'The guard would DROP the whole hookSpecificOutput envelope on those events.',
    unreviewedHint:
      'Either settle the event (binary R("...") miss with independent evidence) and\n' +
      'add it to HOOK_EVENT_NAME_REVIEWED_EXCEPTIONS (mirroring\n' +
      'spec/cc-output-keys.spec.yml events_with_hook_specific_output reviewed_exceptions),\n' +
      'or remove the entry from EVENTS_WITH_HOOK_EVENT_NAME if it is not supported.',
    reviewedLogHint:
      'CONFIRMED without a matching hookEventName:R("...") literal (reviewed exception,\n' +
      'see spec/cc-output-keys.spec.yml events_with_hook_specific_output.reviewed_exceptions):',
  });

  if (acDrift.cannotObserve || henDrift.cannotObserve) {
    process.exit(EXIT_CANNOT_OBSERVE);
  }
  if (acDrift.missing || henDrift.missing) {
    process.exit(EXIT_DRIFT);
  }
  if (acDrift.unreviewed || henDrift.unreviewed || acSchemaEvidence.invalid) {
    process.exit(EXIT_UNREVIEWED);
  }

  console.log('\nOK: EVENTS_WITH_ADDITIONAL_CONTEXT and EVENTS_WITH_HOOK_EVENT_NAME both');
  console.log('match the binary (every binary event present; every uncorroborated entry reviewed).');
  process.exit(EXIT_OK);
}

/**
 * Validate the distinct evidence classes for additionalContext exemptions.
 * Schema acceptance proves parser shape only. Reviewed exceptions require
 * trace-and-observe evidence, so membership in both classes is contradictory.
 */
function inspectAdditionalContextSchemaEvidence({
  schemaAccepted,
  reviewedExceptions,
  schemaEvents,
  corroboratedEvents,
}) {
  const overlap = [...schemaAccepted].filter((e) => reviewedExceptions.has(e)).sort();
  if (overlap.length > 0) {
    console.error(
      '\nDRIFT [ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED]: entries also appear in ADDITIONAL_CONTEXT_REVIEWED_EXCEPTIONS:',
    );
    for (const e of overlap) console.error(`  ${e}`);
  }

  const missingSchema = [...schemaAccepted].filter((e) => !schemaEvents.has(e)).sort();
  if (missingSchema.length > 0) {
    console.error(
      '\nDRIFT [ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED]: no output-schema additionalContext variant for:',
    );
    for (const e of missingSchema) console.error(`  ${e}`);
  }

  const staleSchema = [...schemaAccepted].filter((e) => corroboratedEvents.has(e)).sort();
  if (staleSchema.length > 0) {
    console.log(
      '\nSTALE [ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED]: schema-accepted entry is now corroborated by binary prose; remove it from the schema-accepted set:',
    );
    for (const e of staleSchema) console.log(`  ${e}`);
  }

  return { invalid: overlap.length > 0 || missingSchema.length > 0 };
}

function printSchemaEvidence(schemaAccepted, schemaEvents) {
  console.log('\nSCHEMA EVIDENCE [ADDITIONAL_CONTEXT_SCHEMA_ACCEPTED]:');
  for (const event of [...schemaAccepted].sort()) {
    const verdict = schemaEvents.has(event)
      ? 'resolved in this binary output-schema variant'
      : 'MISSING from this binary output-schema variant';
    console.log(`  ${event}: ${verdict}`);
  }
}

/**
 * Bidirectional arbitration of one generated Set against binary-derived events.
 * Prints DRIFT lines naming each drifting event and the key under arbitration.
 * Returns flags; caller exits with the highest-severity code across sets.
 *
 * Escape hatches (disjoint by convention):
 *   reviewedExceptions  — trace-and-observe (or equivalent) proof
 *   schemaAccepted      — binary output schema declares the key; NOT traced
 */
function arbitrateSet({
  label,
  key,
  allowed,
  binaryEvents,
  reviewedExceptions,
  schemaAccepted = new Set(),
  missingHint,
  unreviewedHint,
  reviewedLogHint,
  schemaAcceptedLogHint,
}) {
  if (!(allowed instanceof Set) || allowed.size === 0) {
    console.error(`CANNOT OBSERVE: ${label} is not a non-empty Set.`);
    return { cannotObserve: true };
  }

  const missing = [...binaryEvents].filter((e) => !allowed.has(e)).sort();
  if (missing.length > 0) {
    console.error(`\nDRIFT [${label} / key=${key}]: binary has these events, generated set does not:`);
    for (const e of missing) console.error(`  ${e}`);
    console.error(`\n${missingHint}`);
    console.error('Update spec/cc-output-keys.spec.yml and regenerate.');
  }

  const uncorroborated = [...allowed].filter((e) => !binaryEvents.has(e)).sort();
  const reviewed = uncorroborated.filter((e) => reviewedExceptions.has(e));
  const schemaOk = uncorroborated.filter(
    (e) => !reviewedExceptions.has(e) && schemaAccepted.has(e),
  );
  const unreviewed = uncorroborated.filter(
    (e) => !reviewedExceptions.has(e) && !schemaAccepted.has(e),
  );

  console.log(
    `\n${label}: ${allowed.size} asserted / ${allowed.size - uncorroborated.length} corroborated by the binary / ${reviewed.length} reviewed exception / ${schemaOk.length} schema-accepted / ${unreviewed.length} unreviewed`,
  );

  if (reviewed.length > 0) {
    console.log(`\n${reviewedLogHint}`);
    for (const e of reviewed) console.log(`  ${e}`);
  }

  if (schemaOk.length > 0 && schemaAcceptedLogHint) {
    console.log(`\n${schemaAcceptedLogHint}`);
    for (const e of schemaOk) console.log(`  ${e}`);
  }

  // Stale escape hatch: listed as exception but the binary now corroborates it.
  const staleReviewed = [...reviewedExceptions]
    .filter((e) => binaryEvents.has(e))
    .sort();
  if (staleReviewed.length > 0) {
    console.log(
      `\nSTALE [${label} / key=${key}]: reviewed exception now corroborated by the binary; remove from the exception set:`,
    );
    for (const e of staleReviewed) console.log(`  ${e}`);
  }

  if (unreviewed.length > 0) {
    console.error(
      `\nDRIFT [${label} / key=${key}]: generated set has these events, binary does not,` +
        ' and they carry no reviewed exception or schema-accepted entry:',
    );
    for (const e of unreviewed) console.error(`  ${e}`);
    console.error(`\n${unreviewedHint}`);
  }

  return {
    missing: missing.length > 0,
    unreviewed: unreviewed.length > 0,
  };
}

main();
