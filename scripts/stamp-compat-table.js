#!/usr/bin/env node
'use strict';
// Writes the generated compatibility table between the compat-table markers in README.md and
// the docs guide. Usage: node scripts/stamp-compat-table.js [--check]
// --check exits 1 when a file differs from a fresh build and writes nothing.

const fs = require('node:fs');
const path = require('node:path');
const { buildCompatRows, renderCompatMarkdown, MARKERS } = require('./lib/compat-table');

const root = path.join(__dirname, '..');
const FILES = [
  ['README.md', MARKERS.md],
  ['docs/site/content/docs/guides/orchestkit-on-pi-codex-cursor.mdx', MARKERS.mdx],
];
const check = process.argv.includes('--check');
const table = renderCompatMarkdown(buildCompatRows(root));
let drift = 0;

for (const [rel, [start, end]] of FILES) {
  const file = path.join(root, rel);
  const text = fs.readFileSync(file, 'utf8');
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  if (a < 0 || b < 0) {
    console.error(`stamp-compat-table: no markers in ${rel}`);
    process.exit(1);
  }
  const next = `${text.slice(0, a + start.length)}\n\n${table}\n\n${text.slice(b)}`;
  if (next === text) continue;
  drift += 1;
  if (check) console.error(`stamp-compat-table: ${rel} is out of date`);
  else fs.writeFileSync(file, next);
}

if (check && drift) process.exit(1);
console.log(check ? 'stamp-compat-table: up to date' : `stamp-compat-table: ${drift} file(s) updated`);
