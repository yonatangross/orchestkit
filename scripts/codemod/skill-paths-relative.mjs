#!/usr/bin/env node
/**
 * skill-paths-relative.mjs, #3822 step 2.
 *
 * Rewrites SAME-SKILL references inside each src/skills/<name>/SKILL.md from
 * the plugin-root form to the portable form. Cross-skill, shared/ and
 * frontmatter `hooks: command:` references are left alone: a plugin root is
 * genuinely needed there.
 *
 * Why: pi and every other Agent Skills client deliver `${CLAUDE_PLUGIN_ROOT}`
 * to the model as a literal string. Claude Code (measured 2.1.251) resolves a
 * bare relative path against the SKILL.md directory and also expands
 * `${CLAUDE_SKILL_DIR}`. The Agent Skills spec and pi resolve relative paths
 * the same way, so bare relative is the only form every consumer understands.
 *
 * The rule, per occurrence of `${CLAUDE_PLUGIN_ROOT}/skills/<self>/<rest>`:
 *
 *   read shapes  -> `<rest>`                        Read("..."), markdown links,
 *                                                   backticked or prose mentions
 *                                                   outside a code fence
 *   exec shapes  -> `${CLAUDE_SKILL_DIR}/<rest>`    a command token before it
 *                                                   (bash, node, python3, ...),
 *                                                   a shell assignment (H="..."),
 *                                                   a scriptPath value, or any
 *                                                   non-Read shape inside a
 *                                                   fenced code block (shell cwd
 *                                                   is not the skill dir)
 *   skipped      -> unchanged                       `<rest>` is the skill's own
 *                                                   SKILL.md (documents the load
 *                                                   path an AGENT must Read;
 *                                                   agents keep the plugin-root
 *                                                   form, #3313)
 *
 * When `<rest>` names a directory in the tree, the relative form gets a
 * trailing slash so `scripts/` reads as a directory and not a stray word.
 *
 * Idempotent: a second run finds nothing to rewrite. Frontmatter is never
 * touched.
 *
 * Usage:
 *   node scripts/codemod/skill-paths-relative.mjs [--dry-run] [--check]
 *        [--skills a,b,c] [--limit N] [--json]
 *
 *   --dry-run   report per-file counts, write nothing
 *   --check     CI mode: exit 1 if any same-skill plugin-root reference remains
 *               (implies --dry-run)
 *   --skills    only these skill names (comma separated); default: all
 *   --limit N   only the first N SKILL.md files (alphabetical) that need a
 *               rewrite; for batching commits
 *   --json      machine-readable summary on stdout
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS = join(ROOT, 'src', 'skills');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
const check = has('--check');
const dryRun = has('--dry-run') || check;
const asJson = has('--json');
const only = argOf('--skills') ? new Set(argOf('--skills').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const limit = argOf('--limit') ? Number(argOf('--limit')) : Infinity;

// A command token immediately before the placeholder, with optional flags and
// an optional opening quote: `bash "`, `python3 `, `node -e "`.
const EXEC_TOKEN_RE = /(?:^|[\s`|(;&])(?:bash|sh|zsh|node|npx|python3|python|source|cat|jq|ls|exec)\s+(?:-\S+\s+)*["']?$/;
// Shell variable assignment: H="  or  PATH_TO=
const ASSIGN_RE = /(?:^|[\s;(])[A-Za-z_][A-Za-z0-9_]*=["']?$/;
// Workflow scriptPath in JSON, JS or Python shape: "scriptPath": "  |  scriptPath: "  |  scriptPath="
const SCRIPTPATH_RE = /scriptPath["']?\s*[:=]\s*["']$/;
const READ_RE = /Read\(\s*["']?$/;

function classify(pre, inFence) {
  if (READ_RE.test(pre)) return 'read';
  if (pre.endsWith('](')) return 'read';
  if (EXEC_TOKEN_RE.test(pre) || ASSIGN_RE.test(pre) || SCRIPTPATH_RE.test(pre)) return 'exec';
  if (inFence) return 'exec';
  return 'read';
}

function relativeForm(skillDir, rest) {
  if (rest.includes('<')) return rest; // template placeholder like <path>; leave shape alone
  const target = join(skillDir, rest);
  if (!rest.endsWith('/') && existsSync(target) && statSync(target).isDirectory()) return rest + '/';
  return rest;
}

function rewriteFile(name, file) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const skillDir = dirname(file);
  const counts = { read: 0, exec: 0, skipped: 0 };
  const pat = new RegExp('\\$\\{CLAUDE_PLUGIN_ROOT\\}/skills/' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/([^\\s"\'`)\\]>]*)', 'g');

  // frontmatter: leave untouched
  let bodyStart = 0;
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') { bodyStart = i + 1; break; }
    }
  }

  let inFence = false;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (!pat.test(line)) continue;
    pat.lastIndex = 0;
    lines[i] = line.replace(pat, (m, rest, offset) => {
      if (rest === 'SKILL.md') { counts.skipped++; return m; }
      const pre = line.slice(0, offset);
      const kind = classify(pre, inFence);
      counts[kind]++;
      return kind === 'exec' ? '${CLAUDE_SKILL_DIR}/' + rest : relativeForm(skillDir, rest);
    });
  }
  const out = lines.join('\n');
  const changed = out !== src;
  if (changed && !dryRun) writeFileSync(file, out);
  return { counts, changed };
}

const files = readdirSync(SKILLS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && (!only || only.has(d.name)))
  .map((d) => ({ name: d.name, file: join(SKILLS, d.name, 'SKILL.md') }))
  .filter((s) => existsSync(s.file))
  .sort((a, b) => a.name.localeCompare(b.name));

const perFile = [];
let taken = 0;
for (const s of files) {
  if (taken >= limit) break;
  const r = rewriteFile(s.name, s.file);
  const n = r.counts.read + r.counts.exec;
  if (n === 0 && r.counts.skipped === 0) continue;
  if (n > 0) taken++;
  perFile.push({ skill: s.name, ...r.counts, changed: r.changed });
}

const total = perFile.reduce((a, f) => ({ read: a.read + f.read, exec: a.exec + f.exec, skipped: a.skipped + f.skipped }), { read: 0, exec: 0, skipped: 0 });
const remaining = total.read + total.exec;

if (asJson) {
  console.log(JSON.stringify({ mode: check ? 'check' : dryRun ? 'dry-run' : 'write', files: perFile, total }, null, 2));
} else {
  const verb = dryRun ? 'would rewrite' : 'rewrote';
  for (const f of perFile) {
    console.log(`  ${f.skill.padEnd(32)} relative=${String(f.read).padStart(3)}  skill-dir=${String(f.exec).padStart(2)}${f.skipped ? `  skipped=${f.skipped}` : ''}`);
  }
  console.log(`\n${verb} ${remaining} same-skill reference(s) in ${perFile.filter((f) => f.read + f.exec > 0).length} SKILL.md file(s): ${total.read} bare relative, ${total.exec} \${CLAUDE_SKILL_DIR}${total.skipped ? `, ${total.skipped} skipped (own SKILL.md)` : ''}`);
}

if (check && remaining > 0) {
  console.error(`\n✗ ${remaining} same-skill reference(s) still use \${CLAUDE_PLUGIN_ROOT}/skills/<self>/; run: node scripts/codemod/skill-paths-relative.mjs`);
  process.exit(1);
}
