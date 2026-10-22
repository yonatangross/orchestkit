#!/usr/bin/env node
// Export chosen ork skills as Gemini app Skills: one .zip per skill.
//
// The Gemini app takes "a SKILL.md file, or ... a folder or .zip file that
// contains a SKILL.md file in its main folder" (support.google.com/gemini/
// answer/17094296, read 2026-10-15). Its rules, enforced here:
//   - the skill name is lowercase words joined by hyphens
//   - the description is at most 1024 characters
//   - plain-text files only (no .docx/.xlsx, no hidden files such as .DS_Store)
//   - all uploads together stay under 100 MB
//   - scripts cannot reach the internet
// A chat app has no shell, no hooks, no subagents and no MCP servers, so a skill
// whose body names those tools is refused unless the allowlist says otherwise.
//
// Usage:
//   node scripts/export-gemini-skills.mjs --skills business-case,okr-design [--out dir]
//   node scripts/export-gemini-skills.mjs --allowlist configs/gemini-skills.txt
// Test seam: --skills-dir <dir> reads skills from a fixture tree.
//
// Exit codes: 0 every skill exported; 1 at least one skill refused (nothing is
// written for a refused skill); 2 usage error.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_DESCRIPTION = 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const TEXT_EXT = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.csv', '.html', '.py']);
// Files that only make sense inside OrchestKit's own test harness.
const DROP_FILES = new Set(['test-cases.json']);
// Words that mean the skill expects a runtime a chat app does not have.
const RUNTIME_WORDS = [
  { re: /\bmcp__[a-z0-9_-]+/i, why: 'names an MCP tool' },
  { re: /\bAgent\(/, why: 'spawns a subagent' },
  { re: /(^|[^\w])gh (api|pr|issue|run)\b/m, why: 'runs the GitHub CLI' },
  { re: /\bhooks?\.json\b/, why: 'depends on Claude Code hooks' },
];

function parseArgs(argv) {
  const opts = { skills: [], out: join(ROOT, 'dist', 'gemini-skills'), skillsDir: join(ROOT, 'plugins', 'ork', 'skills') };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined) usage(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === '--skills') opts.skills.push(...next().split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--allowlist') opts.skills.push(...readAllowlist(next()));
    else if (a === '--out') opts.out = resolve(next());
    else if (a === '--skills-dir') opts.skillsDir = resolve(next());
    else usage(`unknown argument: ${a}`);
  }
  if (opts.skills.length === 0) usage('no skills named (use --skills or --allowlist)');
  return opts;
}

function usage(msg) {
  process.stderr.write(`export-gemini-skills: ${msg}\n`);
  process.exit(2);
}

function readAllowlist(path) {
  return readFileSync(path, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
}

/** Split SKILL.md into its frontmatter lines and its body. */
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  return { front: m[1].split('\n'), body: m[2] };
}

/** Read one top-level scalar key: plain, quoted, or a > / | block. */
function readScalar(lines, key) {
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i < 0) return null;
  const raw = lines[i].slice(key.length + 1).trim();
  if (raw === '>' || raw === '|' || raw === '>-' || raw === '|-') {
    const block = [];
    for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]); j += 1) block.push(lines[j].trim());
    return raw.startsWith('>') ? block.join(' ') : block.join('\n');
  }
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    const inner = raw.slice(1, -1);
    return raw.startsWith('"') ? inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : inner.replace(/''/g, "'");
  }
  return raw;
}

/**
 * Every regular file under dir. A symlink is never followed: readFileSync,
 * cpSync and zip would all read its TARGET, so a link named notes.md that
 * points at a key file would ship that file to Google. Links are returned in
 * `links` and the caller refuses the skill.
 */
function listFiles(dir, links = []) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isSymbolicLink()) links.push(p);
    else if (entry.isDirectory()) out.push(...listFiles(p, links));
    else if (entry.isFile()) out.push(p);
    else links.push(p);
  }
  return out;
}

/** Check one skill; return { problems, files, name, description, body }. */
function inspect(skillDir, skill) {
  const problems = [];
  const skillMd = join(skillDir, 'SKILL.md');
  if (lstatSync(skillDir).isSymbolicLink()) return { problems: [`the skill folder ${skill} is a symlink`] };
  if (!existsSync(skillMd)) return { problems: [`no SKILL.md in ${skill}`] };
  if (lstatSync(skillMd).isSymbolicLink()) return { problems: ['SKILL.md is a symlink'] };
  const parts = splitFrontmatter(readFileSync(skillMd, 'utf8'));
  if (!parts) return { problems: ['SKILL.md has no frontmatter block'] };
  const name = readScalar(parts.front, 'name');
  const description = readScalar(parts.front, 'description');
  if (!name || !NAME_RE.test(name)) problems.push(`name "${name}" is not lowercase words joined by hyphens`);
  if (name && name !== skill) problems.push(`name "${name}" does not match the folder "${skill}"`);
  if (!description) problems.push('description is missing');
  else if (description.length > MAX_DESCRIPTION) problems.push(`description is ${description.length} characters (max ${MAX_DESCRIPTION})`);

  const files = [];
  const links = [];
  const found = listFiles(skillDir, links);
  for (const link of links) problems.push(`${relative(skillDir, link)} is a symlink or special file (only regular files are exported)`);
  for (const abs of found) {
    const rel = relative(skillDir, abs);
    const base = rel.split('/').pop();
    if (base.startsWith('.')) { problems.push(`hidden file ${rel} (remove it before export)`); continue; }
    if (DROP_FILES.has(base) || rel === 'SKILL.md') continue;
    const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')).toLowerCase() : '';
    if (!TEXT_EXT.has(ext)) { problems.push(`${rel} is not a plain-text type the Gemini app accepts`); continue; }
    files.push(rel);
  }

  const texts = [parts.body, ...files.map((f) => readFileSync(join(skillDir, f), 'utf8'))];
  for (const { re, why } of RUNTIME_WORDS) {
    if (texts.some((t) => re.test(t))) problems.push(`the skill ${why} (${re}); a chat app cannot run it`);
  }
  return { problems, files, name, description, body: parts.body };
}

function frontmatter(name, description) {
  return `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n`;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(opts.out, { recursive: true });
  const stage = join(opts.out, '.stage');
  rmSync(stage, { recursive: true, force: true });

  const manifest = { generated_by: 'scripts/export-gemini-skills.mjs', skills: [] };
  let refused = 0;
  let total = 0;
  for (const skill of opts.skills) {
    const dir = join(opts.skillsDir, skill);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      process.stderr.write(`REFUSED ${skill}: not a skill folder under ${opts.skillsDir}\n`);
      refused += 1;
      continue;
    }
    const r = inspect(dir, skill);
    if (r.problems.length > 0) {
      for (const p of r.problems) process.stderr.write(`REFUSED ${skill}: ${p}\n`);
      refused += 1;
      continue;
    }
    const target = join(stage, skill);
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'SKILL.md'), frontmatter(r.name, r.description) + r.body);
    for (const f of r.files) {
      mkdirSync(dirname(join(target, f)), { recursive: true });
      cpSync(join(dir, f), join(target, f));
    }
    const zip = join(opts.out, `${skill}.zip`);
    rmSync(zip, { force: true });
    // -X drops extra file attributes; -y stores a link as a link, never its target.
    // Run from the stage so the zip's main folder is the skill.
    execFileSync('zip', ['-q', '-r', '-X', '-y', zip, skill], { cwd: stage });
    const bytes = statSync(zip).size;
    total += bytes;
    manifest.skills.push({ name: skill, zip: `${skill}.zip`, bytes, sha256: sha256(zip), files: ['SKILL.md', ...r.files] });
    process.stdout.write(`OK ${skill}.zip ${bytes} bytes\n`);
  }
  rmSync(stage, { recursive: true, force: true });
  manifest.total_bytes = total;
  if (total > MAX_TOTAL_BYTES) {
    process.stderr.write(`REFUSED: total ${total} bytes is over the 100 MB upload limit\n`);
    refused += 1;
  }
  writeFileSync(join(opts.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.exit(refused > 0 ? 1 : 0);
}

main();
