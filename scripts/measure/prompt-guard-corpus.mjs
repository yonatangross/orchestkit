#!/usr/bin/env node
// Extract the command-string cases from the two regex guards' unit tests,
// labelled by the it() title verb (denies / asks / allows). This is the
// false-positive corpus for the prompt-hook A/B: every "allows ..." case is a
// command the regex guard once got wrong or was written to keep right, and
// every "denies"/"asks" case is a command it must keep catching.
//
//   node scripts/measure/prompt-guard-corpus.mjs [out.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = process.argv[2] || '/tmp/prompt-guard-corpus.json';
const files = {
  'dangerous-command-blocker': path.join(ROOT, 'src/hooks/src/__tests__/pretool/dangerous-command-blocker.test.ts'),
  'git-validator': path.join(ROOT, 'src/hooks/src/__tests__/pretool/git-validator.test.ts'),
};

const out = [];
for (const [guard, file] of Object.entries(files)) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /\bit(?:\.each\([^)]*\))?\(\s*(['"`])((?:\\.|(?!\1).)*)\1[\s\S]*?(?=\n\s*it(?:\.each)?\(|\n\s*describe\(|\n\s*}\);\s*\n\s*describe|$)/g;
  let m;
  while ((m = re.exec(src))) {
    const title = m[2];
    const body = m[0];
    const verb = /^(denies|blocks|deny|hard-blocks)/i.test(title) ? 'deny'
      : /^(asks|ask)/i.test(title) ? 'ask'
      : /^(allows|allow|does not block|permits)/i.test(title) ? 'allow'
      : null;
    if (!verb) continue;
    const cmds = new Set();
    for (const c of body.matchAll(/createBashInput\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) cmds.add(c[2]);
    for (const arr of body.matchAll(/\[\s*((?:\s*(['"`])(?:\\.|(?!\2).)*\2\s*,?\s*(?:\/\/[^\n]*)?)+)\s*\]/g)) {
      for (const c of arr[1].matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
        if (/\s|^[a-z]/.test(c[2]) && !/^(deny|ask|allow|should)/.test(c[2])) cmds.add(c[2]);
      }
    }
    for (const cmd of cmds) out.push({ guard, expected: verb, title, cmd: cmd.replace(/\\'/g, "'") });
  }
}
const seen = new Set();
const uniq = out.filter((o) => { const k = o.guard + '|' + o.cmd; if (seen.has(k)) return false; seen.add(k); return true; });
fs.writeFileSync(OUT, JSON.stringify(uniq, null, 1));
const tally = {};
for (const o of uniq) tally[o.guard + ':' + o.expected] = (tally[o.guard + ':' + o.expected] || 0) + 1;
console.log(JSON.stringify(tally), 'total', uniq.length, '->', OUT);
