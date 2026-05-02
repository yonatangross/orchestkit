#!/usr/bin/env node
/**
 * cc-triage.mjs — LLM-assisted feature extraction for unsnapshotted CC versions.
 *
 * Reads shared/cc-adoption-gaps.json (written by cc-release-watch.mjs).
 * For each entry where `features` is empty and `parse_failed` is false, calls
 * `claude -p --bare --model claude-opus-4-7` with a typed prompt to extract
 * structured CCFeature[] from the snapshot file.
 *
 * Soft dependency on CLAUDE_CODE_OAUTH_TOKEN. If not set, this script no-ops
 * cleanly (exit 0) so the workflow's fallback "manual triage needed" issue
 * filer can still run.
 *
 * Issue: #1486 (M130). Prompt design: ork:llm-integrator agent output.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_DIR = join(ROOT, 'shared/cc-snapshots');
const GAPS_PATH = join(ROOT, 'shared/cc-adoption-gaps.json');
const SKILLS_DIR = join(ROOT, 'src/skills');

const VALID_CATEGORIES = new Set(['new_event', 'new_field', 'new_attr', 'new_command', 'new_perm', 'breaking', 'deprecation']);
const SCORE_BY_CATEGORY = {
  new_event: 10, new_field: 5, new_attr: 5,
  new_command: 15, new_perm: 12, breaking: 20, deprecation: 8,
};

function buildSkillsCatalog() {
  const skills = [];
  for (const dir of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_')) continue;
    const skillPath = join(SKILLS_DIR, dir.name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;
    const txt = readFileSync(skillPath, 'utf8');
    // Pull `description: "..."` from frontmatter.
    const m = txt.match(/^description:\s*"([^"]+)"/m) || txt.match(/^description:\s*(.+)$/m);
    const desc = m ? m[1].trim() : '(no description)';
    skills.push(`${dir.name} — ${desc.slice(0, 100)}`);
  }
  return skills.join('\n');
}

function buildPrompt(version, snapshotText, skillsCatalog) {
  return `<system>
You are a structured-data extractor. Your only output is a single valid JSON array — no prose, no markdown fences, no explanation. If you have nothing to emit, output an empty array: []
</system>

<user>
Extract CCFeature objects from the Claude Code changelog version ${version}.

## Rules

1. Skip any bullet that begins with "Fixed" UNLESS it fixes a security-relevant behaviour (e.g. permission bypass, credential exposure, sandbox escape). Those security-fix bullets are category "breaking".
2. Skip Windows-only, IDE-only (JetBrains/VS Code GUI), and cosmetic/animation items.
3. For each qualifying bullet, output one object with these exact fields:

{
  "feature_slug": string,       // snake_case identifier, max 40 chars, e.g. "claude_project_purge"
  "category": one of ["new_event","new_field","new_attr","new_command","new_perm","breaking","deprecation"],
  "description": string,        // one sentence, max 120 chars
  "gap_score": number,          // category weight: new_event=10, new_field=5, new_attr=5, new_command=15, new_perm=12, breaking=20, deprecation=8
  "affected_skills": string[],  // skill names from the catalog below that are most likely to need updating; empty array if none
  "reference_changelog_line": string  // verbatim bullet text, trimmed
}

4. Sort output by gap_score descending. Ties: preserve changelog order.
5. Cap output at 20 objects. Drop lowest-scoring if over the cap.
6. Output ONLY the raw JSON array.

## Category Decision Guide

new_event=OTel/hook event | new_field=new config/response field | new_attr=new attribute on existing object | new_command=CLI command/flag | new_perm=permission/sandbox | breaking=behaviour change or security fix | deprecation=announced removal

## Skills Catalog

${skillsCatalog}

## Changelog Text

Version: ${version}

${snapshotText}

Output the JSON array now.
</user>`;
}

function callClaude(prompt) {
  // Single retry on parse failure. Each call has 60s timeout via spawnSync.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = spawnSync('claude', ['-p', '--bare', '--model', 'claude-opus-4-7'], {
        input: prompt,
        encoding: 'utf8',
        timeout: 60_000,
      });
      if (res.status !== 0) {
        console.error(`claude exit ${res.status}: ${(res.stderr || '').slice(0, 500)}`);
        if (attempt === 2) return null;
        continue;
      }
      const out = (res.stdout || '').trim();
      const parsed = JSON.parse(out);
      if (!Array.isArray(parsed)) throw new Error('result is not array');
      return parsed;
    } catch (err) {
      console.error(`attempt ${attempt} failed: ${err.message}`);
      if (attempt === 2) return null;
    }
  }
  return null;
}

function validateAndScore(features) {
  // Drop malformed items, normalize gap_score to canonical (model can't drift it).
  const clean = [];
  for (const f of features) {
    if (typeof f !== 'object' || f === null) continue;
    if (typeof f.feature_slug !== 'string') continue;
    if (!VALID_CATEGORIES.has(f.category)) continue;
    if (typeof f.description !== 'string') continue;
    clean.push({
      feature_slug: f.feature_slug.slice(0, 40),
      category: f.category,
      description: f.description.slice(0, 120),
      gap_score: SCORE_BY_CATEGORY[f.category],
      affected_skills: Array.isArray(f.affected_skills) ? f.affected_skills : [],
      reference_changelog_line: typeof f.reference_changelog_line === 'string' ? f.reference_changelog_line : '',
    });
  }
  return clean.sort((a, b) => b.gap_score - a.gap_score).slice(0, 20);
}

function main() {
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    console.log('cc-triage: CLAUDE_CODE_OAUTH_TOKEN not set — skipping LLM extraction.');
    process.exit(0);
  }

  if (!existsSync(GAPS_PATH)) {
    console.log('cc-triage: no gaps file — nothing to do.');
    process.exit(0);
  }

  const gaps = JSON.parse(readFileSync(GAPS_PATH, 'utf8'));
  if (!Array.isArray(gaps) || gaps.length === 0) {
    console.log('cc-triage: gaps file empty.');
    process.exit(0);
  }

  const skillsCatalog = buildSkillsCatalog();
  let updated = 0;

  for (const entry of gaps) {
    if (entry.parse_failed || entry.features?.length > 0) continue;

    const snapPath = join(SNAPSHOT_DIR, `${entry.version}.md`);
    if (!existsSync(snapPath)) {
      console.warn(`cc-triage: missing snapshot for ${entry.version} — skipping.`);
      continue;
    }
    const snapText = readFileSync(snapPath, 'utf8');

    console.log(`cc-triage: extracting features from ${entry.version}...`);
    const prompt = buildPrompt(entry.version, snapText, skillsCatalog);
    const result = callClaude(prompt);

    if (result === null) {
      entry.parse_failed = true;
      entry.failed_at = new Date().toISOString();
      console.error(`cc-triage: ${entry.version} — both attempts failed; sentinel written.`);
    } else {
      entry.features = validateAndScore(result);
      console.log(`cc-triage: ${entry.version} — extracted ${entry.features.length} feature(s).`);
    }
    updated++;
  }

  if (updated > 0) {
    writeFileSync(GAPS_PATH, JSON.stringify(gaps, null, 2) + '\n');
    console.log(`cc-triage: updated ${updated} version entries in ${GAPS_PATH}`);
  } else {
    console.log('cc-triage: no entries needed extraction.');
  }
}

main();
