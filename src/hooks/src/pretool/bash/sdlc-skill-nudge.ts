/**
 * SDLC Skill Nudge: PreToolUse Bash advisory (#4629)
 *
 * A repo can ship its own SDLC skills under .claude/skills (an /integrate that
 * runs lint, smoke and a deploy check before opening a PR, a /bugfix that adds
 * the docs the project rules require). A hand-rolled `gh pr create` skips all
 * of that silently. When this hook sees `gh pr create` and the repo has a skill
 * that covers opening PRs, it names that skill as context. It never blocks.
 *
 * Cheap by design: no network, no git, no process. The skills folder is read
 * through lib/repo-skills (one readdir plus SKILL.md heads, cached by mtime),
 * injected as deps. Silent when the command is not `gh pr create`, when the
 * repo has no skills folder, or when no skill there is about opening PRs.
 */

import type { HookContext, HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess } from '../../lib/common.js';
import { NOOP_CTX } from '../../lib/context.js';
import { readRepoSkills, type RepoSkill } from '../../lib/repo-skills.js';

const HOOK_NAME = 'sdlc-skill-nudge';

/** At most this many skills are named, one short line each. */
const MAX_SKILLS = 3;

/** Skill folder names that mean "this is how we open PRs here". */
const PR_SKILL_NAMES = new Set([
  'integrate',
  'bugfix',
  'pr',
  'open-pr',
  'create-pr',
  'submit-pr',
  'ship',
  'pull-request',
]);

/** A description that talks about opening a PR. */
const PR_DESCRIPTION =
  /\b(pull requests?|gh pr create|open(?:s|ing)?\s+(?:a\s+|the\s+)?PRs?|create(?:s|ing)?\s+(?:a\s+|the\s+)?PRs?)\b/i;

/**
 * `gh pr create` as a command: at the start or after a shell separator, with
 * optional env assignments and gh global flags before the subcommand
 * (`gh -R owner/repo pr create`). `echo "gh pr create"` is not a hit.
 */
const GH_PR_CREATE = /(?:^|[;&|(]\s*|\n\s*)(?:\w+=\S+\s+)*gh\s+(?:-{1,2}[\w-]+(?:[ =](?!pr\b)\S+)?\s+)*pr\s+create\b/;

export interface SdlcSkillNudgeDeps {
  /** The repo's own skills (name + description). */
  readSkills: (projectDir: string) => RepoSkill[];
}

const DEFAULT_DEPS: SdlcSkillNudgeDeps = { readSkills: readRepoSkills };

/** True when the Bash command runs `gh pr create`. */
export function isGhPrCreate(command: string): boolean {
  return GH_PR_CREATE.test(command);
}

/** The skills that cover opening a PR: by folder name or by description. */
export function prSkills(skills: RepoSkill[]): RepoSkill[] {
  return skills.filter((s) => PR_SKILL_NAMES.has(s.name.toLowerCase()) || PR_DESCRIPTION.test(s.description));
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`;
}

/** The nudge text for the skills found. */
export function nudgeText(skills: RepoSkill[]): string {
  const shown = skills.slice(0, MAX_SKILLS);
  const lines = shown.map((s) => {
    const what = s.description ? `: ${clip(s.description, 140)}` : '';
    return `  /${s.name} (.claude/skills/${s.name})${what}`;
  });
  if (skills.length > shown.length) lines.push(`  and ${skills.length - shown.length} more under .claude/skills`);
  return [
    '[skill-route] This repo ships its own skill for opening PRs:',
    ...lines,
    'Use it instead of a hand-rolled gh pr create unless the user asked otherwise. When a subagent opens the PR, name the skill in its prompt.',
  ].join('\n');
}

/**
 * PreToolUse Bash advisory. Returns additionalContext naming the repo's PR
 * skill(s) on `gh pr create`; silent otherwise. Never blocks.
 */
export function sdlcSkillNudge(
  input: HookInput,
  ctx: HookContext = NOOP_CTX,
  deps: SdlcSkillNudgeDeps = DEFAULT_DEPS,
): HookResult {
  const command = input.tool_input?.command;
  if (typeof command !== 'string' || !isGhPrCreate(command)) return outputSilentSuccess();

  const skills = prSkills(deps.readSkills(ctx.projectDir));
  if (skills.length === 0) return outputSilentSuccess();

  ctx.log(HOOK_NAME, `gh pr create with repo PR skill(s): ${skills.map((s) => s.name).join(', ')}`);
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: nudgeText(skills),
    },
  };
}
