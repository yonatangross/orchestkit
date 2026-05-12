#!/usr/bin/env node
/**
 * hooks-to-args-form.mjs — convert hooks.json command entries to args[] exec form.
 *
 * CC 2.1.139 added hook `args: string[]` exec form that spawns the command
 * directly without a shell, eliminating ${VAR} shell-injection risk and
 * macOS/Linux quoting drift. This codemod converts every entry of the form:
 *
 *   { "command": "node ${CLAUDE_PLUGIN_ROOT}/path entry-key" }
 *
 * to:
 *
 *   { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/path", "entry-key"] }
 *
 * Idempotent. Entries already in args[] form are passed through unchanged.
 * Entries whose command doesn't match the OrchestKit run-hook pattern are
 * left untouched and reported.
 *
 * Issue: #1774 (M138)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.find(a => !a.startsWith('--'));
const target = resolve(positional || 'src/hooks/hooks.json');

const src = readFileSync(target, 'utf8');
const root = JSON.parse(src);

let converted = 0;
let alreadyArgs = 0;
let skipped = 0;
const skippedReasons = [];

function visit(node, path) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) visit(node[i], `${path}[${i}]`);
    return;
  }
  if (node && typeof node === 'object') {
    if ('hooks' in node && Array.isArray(node.hooks)) {
      for (let i = 0; i < node.hooks.length; i++) {
        const entry = node.hooks[i];
        if (!entry || typeof entry !== 'object') continue;
        if ('args' in entry) {
          alreadyArgs++;
          continue;
        }
        if (typeof entry.command !== 'string') continue;
        const parts = tokenize(entry.command);
        if (parts.length < 2) {
          skipped++;
          skippedReasons.push(`${path}.hooks[${i}]: single-token command "${entry.command}"`);
          continue;
        }
        entry.command = parts[0];
        entry.args = parts.slice(1);
        converted++;
      }
    }
    for (const k of Object.keys(node)) visit(node[k], `${path}.${k}`);
  }
}

function tokenize(s) {
  const out = [];
  let cur = '';
  let inDQ = false;
  let inSQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      cur += s[++i];
      continue;
    }
    if (c === '"' && !inSQ) { inDQ = !inDQ; continue; }
    if (c === "'" && !inDQ) { inSQ = !inSQ; continue; }
    if (!inDQ && !inSQ && /\s/.test(c)) {
      if (cur) { out.push(cur); cur = ''; }
      continue;
    }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

visit(root, '$');

console.log(`hooks-to-args-form: target=${target}`);
console.log(`  converted:    ${converted}`);
console.log(`  already args: ${alreadyArgs}`);
console.log(`  skipped:      ${skipped}`);
if (skippedReasons.length) {
  console.log('  skip reasons:');
  for (const r of skippedReasons.slice(0, 20)) console.log(`    - ${r}`);
  if (skippedReasons.length > 20) console.log(`    ... +${skippedReasons.length - 20} more`);
}

if (converted === 0) {
  console.log('No changes.');
  process.exit(0);
}

if (dryRun) {
  console.log('Dry-run: not writing.');
  process.exit(0);
}

writeFileSync(target, JSON.stringify(root, null, 2) + '\n');
console.log(`Wrote ${converted} converted entr${converted === 1 ? 'y' : 'ies'} to ${target}.`);
