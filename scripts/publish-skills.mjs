#!/usr/bin/env node
/**
 * publish-skills.mjs — dry-run-by-default publish rail for the Claude Platform
 * Skills API (POST /v1/skills, GA since 2026-08-19, no beta header required).
 *
 * OrchestKit ships through exactly one channel today: the CC plugin
 * marketplace (docs/marketplace-submission.md). This script adds a SECOND,
 * independent channel — packaging the same BUILT skills as versioned uploads
 * to the Skills API. It does not touch marketplace-submission.md's "Claude
 * Code only" positioning line; flipping that claim is a separate operator
 * decision once this channel is actually in use.
 *
 * Source of truth is the BUILT tree: plugins/ork/skills/*\/SKILL.md, the
 * output of `npm run build` (scripts/build-plugins.sh), never src/skills —
 * src/ is pre-build source and does not carry the assembled bundle CC (or
 * this script) actually reads.
 *
 * DRY-RUN IS THE DEFAULT. Composing and validating payloads never touches the
 * network. A real upload requires BOTH --publish AND ANTHROPIC_API_KEY; the
 * two together are the explicit operator-consent gate. This script is never
 * invoked with --publish in tests, CI, or during its own implementation —
 * publishing is outward-facing.
 *
 * Fail-closed and loud:
 *   - every skill is checked and reported, none silently skipped
 *   - any constraint violation exits non-zero, with the exact rule + file
 *   - zero skills discovered is a could-not-observe failure (exit 1) —
 *     it is never reported as "nothing to publish"
 *   - --publish without ANTHROPIC_API_KEY refuses before touching the network
 *
 * Skills API constraints validated (per issue #3628):
 *   - name: <= 64 chars, lowercase letters/digits/hyphens only
 *   - description: <= 1024 chars, and must state WHEN to use the skill
 *     (heuristic: contains the word "when" — the same what+when bar
 *     src/skills/CONTRIBUTING-SKILLS.md already holds every skill to)
 *
 * Usage:
 *   node scripts/publish-skills.mjs                    # dry-run, all skills
 *   node scripts/publish-skills.mjs --skill implement   # dry-run, one skill
 *   node scripts/publish-skills.mjs --limit 10          # dry-run, first 10
 *   node scripts/publish-skills.mjs --publish           # REAL upload (needs ANTHROPIC_API_KEY)
 *
 * Env:
 *   PUBLISH_SKILLS_DIR   override the skills directory (tests use this to
 *                        point at a hermetic fixture instead of the real
 *                        plugins/ork/skills tree)
 *
 * Issue: #3628
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYamlFrontmatter } from './lib/parse-frontmatter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SKILLS_DIR = process.env.PUBLISH_SKILLS_DIR
  ? resolve(process.env.PUBLISH_SKILLS_DIR)
  : join(ROOT, 'plugins/ork/skills');

const NAME_MAX = 64;
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DESC_MAX = 1024;
const WHEN_PATTERN = /\bwhen\b/i;

// GA per the issue brief (2026-08-19); no anthropic-beta header. Confirm
// against live docs.anthropic.com before the first real --publish, since
// this script has intentionally never made the network call itself.
const API_ENDPOINT = 'https://api.anthropic.com/v1/skills';
const API_VERSION = '2023-06-01';

function die(msg) {
  console.error(`[publish-skills] ${msg}`);
  process.exit(1);
}

function printHelp() {
  console.log(`publish-skills.mjs — dry-run-by-default Skills API publish rail

Usage:
  node scripts/publish-skills.mjs [options]

Options:
  --dry-run        Compose + validate payloads, print what would be sent (default)
  --publish        Actually upload (requires ANTHROPIC_API_KEY)
  --skill <name>   Only process one skill (directory name under plugins/ork/skills)
  --limit <N>      Only process the first N skills (alphabetical)
  --help, -h       Show this help
`);
}

function parseArgs(argv) {
  const args = { publish: false, skill: null, limit: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--publish') {
      args.publish = true;
    } else if (a === '--dry-run') {
      args.publish = false;
    } else if (a === '--skill') {
      args.skill = argv[++i];
      if (!args.skill) die('--skill requires a value');
    } else if (a.startsWith('--skill=')) {
      args.skill = a.slice('--skill='.length);
    } else if (a === '--limit') {
      args.limit = Number(argv[++i]);
    } else if (a.startsWith('--limit=')) {
      args.limit = Number(a.slice('--limit='.length));
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      die(`unknown argument: ${a} (see --help)`);
    }
  }
  return args;
}

function enumerateSkillDirs() {
  if (!existsSync(SKILLS_DIR)) {
    die(`skills dir not found: ${SKILLS_DIR} — did you run "npm run build"?`);
  }
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function walkFiles(dir, baseDir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, baseDir));
    } else if (entry.isFile()) {
      out.push({ path: relative(baseDir, full), size: statSync(full).size });
    }
  }
  return out;
}

/**
 * Validate one skill directory against the Skills API constraints and
 * collect its bundled files. Never throws for a bad skill — violations are
 * data, reported by the caller; only I/O errors on the directory itself
 * propagate (there's nothing sane to report if the dir vanished mid-scan).
 */
function validateSkill(dirName) {
  const skillDir = join(SKILLS_DIR, dirName);
  const skillMdPath = join(skillDir, 'SKILL.md');
  const violations = [];

  if (!existsSync(skillMdPath)) {
    violations.push({
      rule: 'missing-skill-md',
      message: 'SKILL.md not found in skill directory',
      file: skillMdPath,
    });
    return { dirName, name: dirName, description: '', violations, files: [], totalBytes: 0, skillMdPath };
  }

  const content = readFileSync(skillMdPath, 'utf8');
  const { frontmatter } = parseYamlFrontmatter(content);
  const name = typeof frontmatter.name === 'string' ? frontmatter.name : '';
  const description = typeof frontmatter.description === 'string' ? frontmatter.description : '';

  if (!name) {
    violations.push({ rule: 'name-missing', message: 'frontmatter has no name field', file: skillMdPath });
  } else {
    if (name.length > NAME_MAX) {
      violations.push({
        rule: 'name-too-long',
        message: `name is ${name.length} chars, max ${NAME_MAX}`,
        file: skillMdPath,
      });
    }
    if (!NAME_PATTERN.test(name)) {
      violations.push({
        rule: 'name-invalid-chars',
        message: `name "${name}" must be lowercase letters, digits, and hyphens only`,
        file: skillMdPath,
      });
    }
  }

  if (!description) {
    violations.push({ rule: 'description-missing', message: 'frontmatter has no description field', file: skillMdPath });
  } else {
    if (description.length > DESC_MAX) {
      violations.push({
        rule: 'description-too-long',
        message: `description is ${description.length} chars, max ${DESC_MAX}`,
        file: skillMdPath,
      });
    }
    if (!WHEN_PATTERN.test(description)) {
      violations.push({
        rule: 'description-missing-when',
        message: 'description does not state WHEN to use the skill (no "when")',
        file: skillMdPath,
      });
    }
  }

  const files = walkFiles(skillDir, skillDir).sort((a, b) => a.path.localeCompare(b.path));
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  return { dirName, name: name || dirName, description, violations, files, totalBytes, skillMdPath };
}

function describePayload(r) {
  return {
    name: r.name,
    description: r.description,
    description_length: r.description.length,
    file_count: r.files.length,
    total_bytes: r.totalBytes,
    files: r.files.map((f) => f.path),
  };
}

async function publishAll(results) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let failures = 0;
  for (const r of results) {
    console.log(`Publishing ${r.name} (${r.files.length} files, ${r.totalBytes} bytes)...`);
    const form = new FormData();
    for (const f of r.files) {
      const abs = join(SKILLS_DIR, r.dirName, f.path);
      const buf = readFileSync(abs);
      form.append('files', new Blob([buf]), `${r.name}/${f.path}`);
    }
    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
        },
        body: form,
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`  FAILED (${res.status}): ${text.slice(0, 500)}`);
        failures++;
        continue;
      }
      console.log(`  OK: ${text.slice(0, 200)}`);
    } catch (e) {
      console.error(`  FAILED (network error): ${e.message}`);
      failures++;
    }
  }
  return failures;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Consent gate FIRST — refuse before enumerating or touching disk state
  // that a real publish would need, so the failure is instant and never
  // depends on the skills tree being buildable.
  if (args.publish && !process.env.ANTHROPIC_API_KEY) {
    die('--publish requires ANTHROPIC_API_KEY to be set. Refusing to run without it.');
  }

  const allDirs = enumerateSkillDirs();
  if (allDirs.length === 0) {
    die(`zero skills found under ${SKILLS_DIR} — could-not-observe, never "nothing to publish". Did you run "npm run build"?`);
  }

  let targetDirs = allDirs;
  if (args.skill) {
    if (!allDirs.includes(args.skill)) {
      die(`--skill "${args.skill}" not found under ${SKILLS_DIR} (${allDirs.length} skills available)`);
    }
    targetDirs = [args.skill];
  }
  if (args.limit != null) {
    if (!Number.isFinite(args.limit) || args.limit <= 0) {
      die(`--limit must be a positive integer, got: ${process.argv.find((a) => a.includes('limit')) || args.limit}`);
    }
    targetDirs = targetDirs.slice(0, args.limit);
  }

  const results = targetDirs.map(validateSkill);
  const passed = results.filter((r) => r.violations.length === 0);
  const failed = results.filter((r) => r.violations.length > 0);

  for (const r of results) {
    if (r.violations.length === 0) {
      console.log(`PASS  ${r.name}  (${r.description.length} desc chars, ${r.files.length} files, ${r.totalBytes} bytes)`);
    } else {
      console.log(`FAIL  ${r.dirName}`);
      for (const v of r.violations) {
        console.log(`      - [${v.rule}] ${v.message} (${v.file})`);
      }
    }
  }

  console.log('');
  console.log(`Summary: ${passed.length} passed, ${failed.length} failed, ${results.length} total`);

  if (args.publish) {
    if (failed.length > 0) {
      die(`refusing to publish: ${failed.length} of ${results.length} skill(s) failed validation`);
    }
    const publishFailures = await publishAll(passed);
    if (publishFailures > 0) {
      die(`${publishFailures} of ${passed.length} skill(s) failed to publish`);
    }
    console.log(`Published ${passed.length} skill(s).`);
    return;
  }

  console.log('');
  console.log('Mode: DRY RUN (no network calls). Pass --publish + ANTHROPIC_API_KEY for a real upload.');
  console.log('');
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        endpoint: API_ENDPOINT,
        anthropic_version: API_VERSION,
        skills: passed.map(describePayload),
      },
      null,
      2,
    ),
  );

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((e) => die(`unhandled error: ${e.stack || e.message}`));
