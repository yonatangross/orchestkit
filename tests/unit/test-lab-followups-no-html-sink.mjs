#!/usr/bin/env node
// ============================================================================
// lab follow-ups playground: no HTML string sinks (offline, reads shipped page)
// ============================================================================
// WHAT THIS GUARDS
//
//   CodeQL js/incomplete-html-attribute-sanitization (alert 435, PR #5224):
//   docs/site/public/lab/fix--ork-split-followups.html built its tabs and rows
//   with innerHTML template strings and an esc() that covers only & < >. A
//   double quote in a view key closed the data-k attribute and injected an
//   event handler. The page now builds nodes with createElement, textContent
//   and dataset, so no value is ever parsed as markup.
//
//   Regresses if anyone reintroduces a string-to-HTML sink on this page, or an
//   esc() style helper, or an attribute interpolation of a template value.
//
//   Reads the shipped lab copy, never a duplicate of it.
// ============================================================================

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGE = join(ROOT, 'docs/site/public/lab/fix--ork-split-followups.html');
const html = readFileSync(PAGE, 'utf8');

let passed = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) {
    passed++;
  } else {
    failures.push(detail ? `${name}\n      ${detail}` : name);
  }
}

console.log('==========================================');
console.log('  lab follow-ups playground: no HTML sinks');
console.log('==========================================\n');

const lines = html.split('\n');
const hits = (re) =>
  lines
    .map((text, i) => ({ n: i + 1, text }))
    .filter(({ text }) => re.test(text))
    .map(({ n, text }) => `line ${n}: ${text.trim().slice(0, 100)}`);

for (const [label, re] of [
  ['innerHTML assignment', /\.innerHTML\s*[+]?=/],
  ['outerHTML assignment', /\.outerHTML\s*[+]?=/],
  ['insertAdjacentHTML call', /insertAdjacentHTML\s*\(/],
  ['document.write call', /document\.write(ln)?\s*\(/],
]) {
  const found = hits(re);
  check(`no ${label}`, found.length === 0, found.join('\n      '));
}

const attrInterp = hits(/="[^">]*\$\{/);
check(
  'no template-string attribute interpolation',
  attrInterp.length === 0,
  attrInterp.join('\n      '),
);

const escHelper = hits(/function esc\(|const esc\s*=/);
check(
  'no partial esc() helper (covers only & < >)',
  escHelper.length === 0,
  escHelper.join('\n      '),
);

check(
  'copy button is still wired',
  /getElementById\("copy"\)/.test(html) || /getElementById\('copy'\)/.test(html),
);

console.log('');
if (failures.length > 0) {
  console.log(`FAILURES (${failures.length}):`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`\nPassed: ${passed}  Failed: ${failures.length}`);
  process.exit(1);
}
console.log(`Passed: ${passed}  Failed: 0`);
process.exit(0);
