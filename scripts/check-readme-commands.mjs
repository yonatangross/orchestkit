#!/usr/bin/env node
/**
 * check-readme-commands.mjs — fail CI when hand-written docs advertise an
 * /ork:<name> command that Claude Code will never generate.
 *
 * Why: a skill only surfaces as a slash command when its frontmatter says
 * `user-invocable: true`. Flip that to false and the command silently stops
 * existing, while every doc that mentions it keeps looking correct. Observed in
 * #3183: README advertised `/ork:configure` for ~4 months after
 * src/skills/configure/SKILL.md went `user-invocable: false` in 7bcab430a. No
 * gate noticed, because check-docs-facts validates counts and the CC floor and
 * never reads a command name.
 *
 * This is the cheap half of #3186. The other half (dead URLs) needs the network
 * and lives in the scheduled .github/workflows/readme-link-audit.yml, because
 * link rot is time-based and a PR-only gate never fires on links that break
 * while nobody touches the file.
 *
 * Scope: FILES below. Escape hatch: any line containing "readme-cmd-ignore" is
 * skipped, for documenting a command that is deliberately not invocable.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Hand-written surfaces that name commands. Generated docs are excluded: they
 *  are rebuilt from src/ and cannot drift from it. */
const FILES = ['README.md'];

const IGNORE = 'readme-cmd-ignore';
const CMD_RE = /\/ork:([a-z0-9][a-z0-9-]*)/g;

/** A skill surfaces as /ork:<dir> iff its frontmatter has user-invocable: true. */
function invocability(name) {
  const file = path.join(ROOT, 'src/skills', name, 'SKILL.md');
  if (!existsSync(file)) return { exists: false };

  // Frontmatter only: a `user-invocable:` mentioned in prose must not count.
  const text = readFileSync(file, 'utf8');
  const fm = text.startsWith('---') ? text.slice(3).split(/^---\s*$/m)[0] ?? '' : '';
  const m = fm.match(/^user-invocable:\s*(\S+)/m);
  return { exists: true, invocable: m?.[1] === 'true', declared: m?.[1] ?? '<unset>' };
}

const problems = [];
let checked = 0;

for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!existsSync(file)) {
    problems.push({ rel, line: 0, cmd: '', why: `file not found: ${rel}` });
    continue;
  }

  // Blank out the What's New block (line count preserved so reported line
  // numbers stay true). It is GENERATED release history — the file's own
  // header says generated docs are excluded, and this block is the one
  // generated region inside a hand-written file. Release notes legitimately
  // name commands that no longer exist: the first 10.0.0-alpha recompute put
  // the glyph-rename bullet in the block, and this gate then demanded
  // /ork:quickviz — a skill v10 deliberately deleted — block the release of
  // the very version that deleted it.
  const raw = readFileSync(file, 'utf8');
  const scanned = raw.replace(
    /<!--ork:whats-new-->[\s\S]*?<!--\/ork-->/,
    (block) => block.replace(/[^\n]/g, ''),
  );

  scanned.split('\n').forEach((text, i) => {
    if (text.includes(IGNORE)) return;
    for (const [, name] of text.matchAll(CMD_RE)) {
      checked++;
      const { exists, invocable, declared } = invocability(name);
      if (!exists) {
        problems.push({
          rel, line: i + 1, cmd: `/ork:${name}`,
          why: `no such skill (src/skills/${name}/SKILL.md is missing)`,
        });
      } else if (!invocable) {
        problems.push({
          rel, line: i + 1, cmd: `/ork:${name}`,
          why: `skill exists but user-invocable: ${declared}, so no command is generated`,
        });
      }
    }
  });
}

const gh = process.env.GITHUB_ACTIONS === 'true' || process.argv.includes('--github');

// Anti-vacuous-green: this repo has shipped gates that passed because they
// never ran (a discovery glob that matched nothing, an exit 0 that meant
// "skipped"). README has advertised commands since January, so zero matches
// means the regex or FILES broke, not that the docs got clean.
if (problems.length === 0 && checked === 0) {
  const msg =
    'check-readme-commands found ZERO /ork: references. Expected at least one; ' +
    'the extractor or FILES list is broken, not the docs.';
  console.error(gh ? `::error::${msg}` : `  ${msg}`);
  process.exit(1);
}

if (problems.length > 0) {
  for (const p of problems) {
    const msg = `${p.cmd || p.rel}: ${p.why}`;
    console.error(
      gh ? `::error file=${p.rel},line=${p.line}::${msg}` : `  ${p.rel}:${p.line}  ${msg}`,
    );
  }
  console.error(
    `\ncheck-readme-commands: ${problems.length} broken command reference(s) in ${FILES.join(', ')}.`,
  );
  console.error(
    'Fix: point the doc at a real user-invocable skill, or add ' +
      `"${IGNORE}" to the line if the mention is deliberate.`,
  );
  process.exit(1);
}

console.log(
  `check-readme-commands: OK (${checked} command reference(s) across ${FILES.length} file(s), all invocable)`,
);
