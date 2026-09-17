#!/usr/bin/env node
// ============================================================================
// lab escapeAttr unit test (offline, reads the shipped page)
// ============================================================================
// WHAT THIS GUARDS
//
//   CodeQL js/incomplete-html-attribute-sanitization (#385 to #389):
//   docs/site/public/lab/chrono-board-release.html interpolated card values
//   into href, class and aria-label attributes through esc(), which only
//   covered & < >. A double or single quote in a card value could close the
//   attribute early and inject markup. The page now has escapeAttr, which
//   covers all five attribute-significant characters, and every attribute
//   interpolation routes through it.
//
//   Two ways this regresses, BOTH silent until the next CodeQL scan:
//   1. escapeAttr loses a character (someone "simplifies" the map).
//   2. A new or reverted attribute interpolation goes back through esc().
//
//   The helper is evaluated out of the shipped file, never duplicated here,
//   so the test measures the real sanitizer and not a copy of it.
// ============================================================================

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGE = join(ROOT, 'docs/site/public/lab/chrono-board-release.html');
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
console.log('  lab escapeAttr');
console.log('==========================================\n');

// [^\n]+, not [^;]+: the entity map itself contains semicolons (&amp;).
const decl = html.match(/const escapeAttr =\s*([^\n]+)/);
check('escapeAttr helper is defined in the page', Boolean(decl));
if (decl) decl[1] = decl[1].replace(/;\s*$/, '');

if (decl) {
  const escapeAttr = eval(`(${decl[1]})`);

  check(
    'probe escapes all five attribute-significant characters',
    escapeAttr(`a&b"c'd<e>f`) === 'a&amp;b&quot;c&#39;d&lt;e&gt;f',
    `got ${JSON.stringify(escapeAttr(`a&b"c'd<e>f`))}`,
  );
  check(
    'ordinary text passes through unchanged',
    escapeAttr('Notes for 10.0.0-beta.12') === 'Notes for 10.0.0-beta.12',
  );
  check('non-string input is stringified, not thrown', escapeAttr(7) === '7');
}

// Attribute context only: `="` then no `"` or `>` before `${esc(`. Element
// content (`>${esc(x)}<`) cannot match, so esc() stays legal for text nodes.
const attrEscapes = html.match(/="[^">]*\$\{esc\(/g) || [];
check(
  'no attribute interpolation still routes through esc()',
  attrEscapes.length === 0,
  attrEscapes.join('\n      '),
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
