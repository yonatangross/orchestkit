#!/usr/bin/env node
// ============================================================================
// Build-result schema: a blocked commit can never read as success (#4703, #4628)
// ============================================================================
// A builder agent whose commit was refused by a hook used to return
// committed_sha: "" and the caller's schema ({ committed_sha: string }) accepted
// it, so the workflow chained on as if the build had landed.
//
// shared/build-result.schema.json is the caller schema for build results. This
// gate validates it against good and bad results and fails if:
//   - an empty, short, uppercase or placeholder sha validates
//   - DONE validates with a null sha, or BLOCKED with a real sha
//   - BLOCKED validates without a blocked_reason
//   - the status protocol or the builder agents lose the "blocked commit is
//     BLOCKED, never an empty sha" wording
//
// The repo ships no JSON Schema library, so this file carries a small validator
// for exactly the keywords the schema uses. An unknown keyword fails the test
// instead of being ignored, so the validator cannot silently under-check.
//
// Usage: node tests/agents/test-build-result-schema.mjs
// Exit:  0 = all checks pass, 1 = a check failed
// ============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.CLAUDE_PROJECT_DIR
  || join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const SCHEMA_PATHS = [
  'src/shared/build-result.schema.json',
  'plugins/ork/shared/build-result.schema.json',
];

const KNOWN = new Set([
  '$schema', '$id', 'title', 'description',
  'type', 'enum', 'const', 'pattern', 'minLength', 'minItems',
  'properties', 'required', 'items', 'allOf', 'if', 'then',
]);

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

// Returns a list of error strings; empty means valid.
function validate(schema, value, path = '$') {
  const errors = [];
  for (const key of Object.keys(schema)) {
    if (!KNOWN.has(key)) errors.push(`${path}: validator does not know keyword "${key}"`);
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.includes(typeOf(value))) {
      errors.push(`${path}: type ${typeOf(value)} not in ${types.join('|')}`);
      return errors;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} not in enum`);
  if ('const' in schema && schema.const !== value) errors.push(`${path}: not const ${JSON.stringify(schema.const)}`);
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: ${JSON.stringify(value)} fails pattern`);
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
  }
  if (typeOf(value) === 'object') {
    for (const req of schema.required || []) {
      if (!(req in value)) errors.push(`${path}: missing required "${req}"`);
    }
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (k in value) errors.push(...validate(sub, value[k], `${path}.${k}`));
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: fewer than ${schema.minItems} items`);
    }
    if (schema.items) {
      value.forEach((item, i) => errors.push(...validate(schema.items, item, `${path}[${i}]`)));
    }
  }
  for (const sub of schema.allOf || []) errors.push(...validate(sub, value, path));
  if (schema.if) {
    const matches = validate(schema.if, value, path).length === 0;
    if (matches && schema.then) errors.push(...validate(schema.then, value, path));
  }
  return errors;
}

const SHA = 'a'.repeat(32) + '0123abcd'; // 40-hex (SHA-1)
const SHA256 = 'b'.repeat(64); // 64-hex (SHA-256 object format)
const SHA39 = 'c'.repeat(39);
const VALID = {
  'DONE with a full sha': { status: 'DONE', committed_sha: SHA, blocked_reason: null },
  'DONE with a 64-hex sha (#5010)': { status: 'DONE', committed_sha: SHA256, blocked_reason: null },
  'DONE_WITH_CONCERNS with a full sha (#5010)': {
    status: 'DONE_WITH_CONCERNS', committed_sha: SHA, blocked_reason: null,
    concerns: ['lint warning left as-is on an unrelated file'],
  },
  'DONE_WITH_CONCERNS with a 64-hex sha (#5010)': {
    status: 'DONE_WITH_CONCERNS', committed_sha: SHA256, blocked_reason: null,
    concerns: ['SHA-256 repo; verify downstream callers accept 64-hex'],
  },
  'BLOCKED with null sha and a reason': {
    status: 'BLOCKED', committed_sha: null,
    blocked_reason: 'pretool hook refused git commit on main: "commits to main are blocked"',
    uncommitted_files: ['.github/workflows/x.yml'],
  },
};
const INVALID = {
  'DONE with empty sha (the #4703 repro)': { status: 'DONE', committed_sha: '', blocked_reason: null },
  'BLOCKED with empty sha': { status: 'BLOCKED', committed_sha: '', blocked_reason: 'hook refused' },
  'DONE with null sha': { status: 'DONE', committed_sha: null, blocked_reason: null },
  'DONE with short sha': { status: 'DONE', committed_sha: 'abc1234', blocked_reason: null },
  'DONE with 39-char sha (#5010)': { status: 'DONE', committed_sha: SHA39, blocked_reason: null },
  'DONE with uppercase sha': { status: 'DONE', committed_sha: SHA.toUpperCase(), blocked_reason: null },
  'DONE with placeholder sha': { status: 'DONE', committed_sha: 'n/a', blocked_reason: null },
  'DONE carrying a blocked_reason': { status: 'DONE', committed_sha: SHA, blocked_reason: 'x' },
  'DONE_WITH_CONCERNS with null sha': {
    status: 'DONE_WITH_CONCERNS', committed_sha: null, blocked_reason: null,
    concerns: ['would land if sha were real'],
  },
  'DONE_WITH_CONCERNS without concerns (#5026 HOLD b54)': {
    status: 'DONE_WITH_CONCERNS', committed_sha: SHA, blocked_reason: null,
  },
  'DONE_WITH_CONCERNS with empty concerns (#5026 HOLD b54)': {
    status: 'DONE_WITH_CONCERNS', committed_sha: SHA, blocked_reason: null, concerns: [],
  },
  'BLOCKED with a real sha': { status: 'BLOCKED', committed_sha: SHA, blocked_reason: 'hook refused' },
  'BLOCKED with null reason': { status: 'BLOCKED', committed_sha: null, blocked_reason: null },
  'BLOCKED with empty reason': { status: 'BLOCKED', committed_sha: null, blocked_reason: '' },
  'missing committed_sha': { status: 'DONE', blocked_reason: null },
  'unknown status': { status: 'OK', committed_sha: SHA, blocked_reason: null },
  'committed_sha only (old caller shape)': { committed_sha: '' },
};

let failures = 0;
const fail = (msg) => { failures++; console.error(`FAIL ${msg}`); };
const pass = (msg) => console.log(`ok   ${msg}`);

const texts = [];
for (const rel of SCHEMA_PATHS) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) { fail(`${rel} missing`); continue; }
  texts.push(readFileSync(abs, 'utf8'));
  const schema = JSON.parse(texts.at(-1));
  for (const [name, value] of Object.entries(VALID)) {
    const errs = validate(schema, value);
    errs.length === 0 ? pass(`${rel}: accepts ${name}`) : fail(`${rel}: rejects ${name}: ${errs.join('; ')}`);
  }
  for (const [name, value] of Object.entries(INVALID)) {
    const errs = validate(schema, value);
    const unknown = errs.filter((e) => e.includes('does not know keyword'));
    if (unknown.length) fail(`${rel}: ${unknown.join('; ')}`);
    else if (errs.length > 0) pass(`${rel}: rejects ${name}`);
    else fail(`${rel}: ACCEPTS ${name}`);
  }
}
if (texts.length === 2 && texts[0] !== texts[1]) {
  fail('plugins/ork/shared/build-result.schema.json differs from src/shared (run the plugin build)');
}

// Agent wording: the status protocol every agent loads, and the builders that commit.
const WORDING = [
  ['src/shared/status-protocol.md', /blocked commit or push is BLOCKED, never an empty sha/],
  ['src/shared/status-protocol.md', /Never fill a required output field with an empty or placeholder value/],
  ['src/agents/ci-cd-engineer.md', /refuses is BLOCKED: report `committed_sha: null`/],
  ['src/agents/test-generator.md', /refuses is BLOCKED: report `committed_sha: null`/],
  ['src/agents/frontend-ui-developer.md', /refuses is BLOCKED: report `committed_sha: null`/],
];
for (const [rel, re] of WORDING) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) { fail(`${rel} missing`); continue; }
  re.test(readFileSync(abs, 'utf8')) ? pass(`${rel}: blocked-commit wording`) : fail(`${rel}: lost the blocked-commit wording`);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nbuild-result schema: all checks pass');
