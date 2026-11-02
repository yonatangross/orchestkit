/**
 * #4629: nudge to the repo's own SDLC skill before a hand-rolled gh pr create.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HookContext, HookInput } from '../../../types.js';
import { NOOP_CTX } from '../../../lib/context.js';
import { readRepoSkills, resetRepoSkillsCache } from '../../../lib/repo-skills.js';
import { isGhPrCreate, nudgeText, sdlcSkillNudge } from '../../../pretool/bash/sdlc-skill-nudge.js';
import { unifiedBashAdvisoryDispatcher } from '../../../pretool/bash/unified-advisory-dispatcher.js';

let project: string;
let ctx: HookContext;

function bash(command: string): HookInput {
  return { hook_event: 'PreToolUse', tool_name: 'Bash', session_id: 's', tool_input: { command } } as HookInput;
}

function addSkill(name: string, description?: string): void {
  const dir = join(project, '.claude', 'skills', name);
  mkdirSync(dir, { recursive: true });
  const fm = description === undefined ? '' : `---\nname: ${name}\ndescription: ${description}\n---\n`;
  writeFileSync(join(dir, 'SKILL.md'), `${fm}# ${name}\n`);
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'sdlc-nudge-'));
  ctx = { ...NOOP_CTX, projectDir: project, log: vi.fn() };
  resetRepoSkillsCache();
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('isGhPrCreate', () => {
  it.each([
    'gh pr create --base main --title x',
    'git push -u origin feat && gh pr create --fill',
    'GH_TOKEN=abc gh pr create',
    'gh -R owner/repo pr create --fill',
    'cd repo; gh pr create',
  ])('matches %s', (cmd) => expect(isGhPrCreate(cmd)).toBe(true));

  it.each([
    'gh pr view 12',
    'gh pr list --json number',
    'echo "run gh pr create later"',
    'git commit -m "gh pr create docs"',
    'gh issue create --label bug',
  ])('ignores %s', (cmd) => expect(isGhPrCreate(cmd)).toBe(false));
});

describe('sdlcSkillNudge', () => {
  it('skill present: names the repo skill on gh pr create', () => {
    addSkill('integrate', 'Open a PR after lint, smoke and validate-deploy');
    const out = sdlcSkillNudge(bash('gh pr create --base development'), ctx);
    const text = out.hookSpecificOutput?.additionalContext ?? '';
    expect(out.continue).toBe(true);
    expect(out.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    expect(out.hookSpecificOutput).not.toHaveProperty('permissionDecision');
    expect(text).toContain('[skill-route]');
    expect(text).toContain('/integrate (.claude/skills/integrate)');
    expect(text).toContain('lint, smoke and validate-deploy');
  });

  it('a skill with another name counts when its description is about opening PRs', () => {
    addSkill('land', 'Creates the pull request with the 7-section body');
    const text = sdlcSkillNudge(bash('gh pr create'), ctx).hookSpecificOutput?.additionalContext ?? '';
    expect(text).toContain('/land');
  });

  it('skill absent: silent when the repo has no skills folder', () => {
    const out = sdlcSkillNudge(bash('gh pr create'), ctx);
    expect(out.hookSpecificOutput).toBeUndefined();
  });

  it('skill absent: silent when the repo skills are not about PRs', () => {
    addSkill('lint', 'Run the linters');
    addSkill('deploy', 'Deploy to staging');
    expect(sdlcSkillNudge(bash('gh pr create'), ctx).hookSpecificOutput).toBeUndefined();
  });

  it('not a gh pr create: silent and never reads the skills folder', () => {
    const readSkills = vi.fn(() => [{ name: 'integrate', description: '' }]);
    const out = sdlcSkillNudge(bash('gh pr view 4629'), ctx, { readSkills });
    expect(out.hookSpecificOutput).toBeUndefined();
    expect(readSkills).not.toHaveBeenCalled();
  });

  it('caps the list at three skills', () => {
    const skills = ['a', 'b', 'c', 'd'].map((n) => ({ name: n, description: 'open a PR' }));
    const text = nudgeText(skills);
    expect(text).toContain('/c ');
    expect(text).not.toContain('/d ');
    expect(text).toContain('and 1 more');
  });
});

describe('readRepoSkills', () => {
  it('reads name and description, skips folders without SKILL.md, caches by mtime', () => {
    addSkill('bugfix', 'Fix a bug and open the PR with docs');
    mkdirSync(join(project, '.claude', 'skills', 'empty'), { recursive: true });
    expect(readRepoSkills(project)).toEqual([{ name: 'bugfix', description: 'Fix a bug and open the PR with docs' }]);
    expect(readRepoSkills(project)).toBe(readRepoSkills(project));
  });
});

describe('wired into the Bash advisory dispatcher', () => {
  it('a gh pr create in a repo with /integrate carries the nudge as PreToolUse context', () => {
    addSkill('integrate', 'Open a PR the project way');
    const out = unifiedBashAdvisoryDispatcher(bash('gh pr create --fill'), ctx);
    expect(out.continue).not.toBe(false);
    expect(out.hookSpecificOutput?.additionalContext ?? '').toContain('/integrate');
  });
});
