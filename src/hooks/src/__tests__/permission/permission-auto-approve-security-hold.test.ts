/**
 * Security hold on #4374: PermissionRequest auto-approve must be opt-in
 * (ORK_PERMISSION_AUTO_APPROVE=1) and must never allow hard-denylisted paths.
 *
 * Fail-first: these assertions describe the post-hold contract. They are
 * expected to FAIL on a6206445 (allow always on, no denylist) and PASS after
 * the rework.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { autoApproveProjectWrites } from '../../permission/auto-approve-project-writes.js';
import { autoApproveSafeBash } from '../../permission/auto-approve-safe-bash.js';
import { learningTracker } from '../../permission/learning-tracker.js';
import type { HookInput } from '../../types.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const FLAG = 'ORK_PERMISSION_AUTO_APPROVE';
const PROJECT = '/test/project';

function writeInput(filePath: string, projectDir = PROJECT): HookInput {
  return {
    hook_event_name: 'PermissionRequest',
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: 'x' },
    project_dir: projectDir,
    session_id: 'sec-hold',
    cwd: projectDir,
  } as HookInput;
}

function bashInput(command: string): HookInput {
  return {
    hook_event_name: 'PermissionRequest',
    tool_name: 'Bash',
    tool_input: { command },
    project_dir: PROJECT,
    session_id: 'sec-hold',
    cwd: PROJECT,
  } as HookInput;
}

function isAllow(result: { hookSpecificOutput?: { decision?: { behavior?: string }; permissionDecision?: string } }): boolean {
  return (
    result.hookSpecificOutput?.decision?.behavior === 'allow' ||
    result.hookSpecificOutput?.permissionDecision === 'allow'
  );
}

describe('PermissionRequest auto-approve security hold (#4374)', () => {
  const prev = process.env[FLAG];

  afterEach(() => {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  });

  describe('DISABLED (default)', () => {
    beforeEach(() => {
      delete process.env[FLAG];
    });

    test('plain src write returns nothing (never allow)', () => {
      const r = autoApproveProjectWrites(writeInput(`${PROJECT}/src/foo.ts`));
      expect(isAllow(r)).toBe(false);
    });

    test('safe bash returns nothing (never allow)', () => {
      expect(isAllow(autoApproveSafeBash(bashInput('git status')))).toBe(false);
    });

    test('learning-tracker returns nothing without the flag', () => {
      expect(isAllow(learningTracker(bashInput('echo hello')))).toBe(false);
    });
  });

  describe('ENABLED: hard denylist never allows', () => {
    beforeEach(() => {
      process.env[FLAG] = '1';
    });

    const deniedRel = [
      '.claude/settings.json',
      '.claude/settings.local.json',
      'settings.json',
      'settings.foo.json',
      '.mcp.json',
      'plugin.json',
      'nested/plugin.json',
      '.claude/hooks/x.ts',
      '.claude/agents/x.md',
      '.claude/skills/x/SKILL.md',
      '.claude/commands/x.md',
      '.github/workflows/ci.yml',
      '.husky/pre-commit',
      '.env',
      '.env.local',
      '.env.production',
    ];

    test.each(deniedRel)('denies %s', (rel) => {
      const r = autoApproveProjectWrites(writeInput(`${PROJECT}/${rel}`));
      expect(isAllow(r), `must not allow ${rel}`).toBe(false);
    });

    test('denies path traversal into .claude via ../', () => {
      const r = autoApproveProjectWrites(
        writeInput(`${PROJECT}/src/../.claude/settings.local.json`),
      );
      expect(isAllow(r)).toBe(false);
    });

    test('denies symlink to settings.local.json', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ork-deny-'));
      const project = path.join(tmp, 'proj');
      const outside = path.join(tmp, 'outside');
      fs.mkdirSync(path.join(project, 'src'), { recursive: true });
      fs.mkdirSync(path.join(project, '.claude'), { recursive: true });
      fs.mkdirSync(outside, { recursive: true });
      const target = path.join(project, '.claude', 'settings.local.json');
      fs.writeFileSync(target, '{}');
      const link = path.join(project, 'src', 'looks-safe.json');
      fs.symlinkSync(target, link);
      try {
        const r = autoApproveProjectWrites(writeInput(link, project));
        expect(isAllow(r)).toBe(false);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    test('enabled path still allows a plain src write', () => {
      const r = autoApproveProjectWrites(writeInput(`${PROJECT}/src/foo.ts`));
      expect(isAllow(r)).toBe(true);
    });

    // reviewer-estate-2 should-fix #1: macOS case-insensitive denylist bypass
    const caseVariantRel = [
      '.MCP.json',
      'Plugin.json',
      '.Claude/settings.json',
      '.GITHUB/workflows/x.yml',
      '.ENV',
    ];

    test.each(caseVariantRel)('denies case variant %s', (rel) => {
      const r = autoApproveProjectWrites(writeInput(`${PROJECT}/${rel}`));
      expect(isAllow(r), `must not allow case variant ${rel}`).toBe(false);
    });

    test('denies dangling leaf symlink into .claude (CodeRabbit #4374)', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ork-dangle-'));
      fs.mkdirSync(path.join(tmp, 'proj', 'src'), { recursive: true });
      const project = fs.realpathSync(path.join(tmp, 'proj'));
      // Target absent: dangling link src/cfg.json -> ../.claude/settings.local.json
      const link = path.join(project, 'src', 'cfg.json');
      fs.symlinkSync('../.claude/settings.local.json', link);
      try {
        process.env[FLAG] = '1';
        const r = autoApproveProjectWrites(writeInput(link, project));
        expect(isAllow(r), 'dangling symlink into .claude must not auto-approve').toBe(false);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    test('denies live symlink into .claude (CodeRabbit #4374)', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ork-live-'));
      fs.mkdirSync(path.join(tmp, 'proj', 'src'), { recursive: true });
      fs.mkdirSync(path.join(tmp, 'proj', '.claude'), { recursive: true });
      const project = fs.realpathSync(path.join(tmp, 'proj'));
      const target = path.join(project, '.claude', 'settings.local.json');
      fs.writeFileSync(target, '{}');
      const link = path.join(project, 'src', 'looks-safe.json');
      fs.symlinkSync(target, link);
      try {
        process.env[FLAG] = '1';
        const r = autoApproveProjectWrites(writeInput(link, project));
        expect(isAllow(r)).toBe(false);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    test('denies dangling symlink CHAIN into .claude (multi-hop)', () => {
      // link1 -> link2 -> .claude/settings.local.json; both links dangling.
      // One readlink hop returns the lexical link2 path (no .claude segment).
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ork-chain-'));
      fs.mkdirSync(path.join(tmp, 'proj', 'src'), { recursive: true });
      const project = fs.realpathSync(path.join(tmp, 'proj'));
      const link2 = path.join(project, 'src', 'link2.json');
      const link1 = path.join(project, 'src', 'link1.json');
      fs.symlinkSync('../.claude/settings.local.json', link2);
      fs.symlinkSync('link2.json', link1);
      try {
        process.env[FLAG] = '1';
        const r = autoApproveProjectWrites(writeInput(link1, project));
        expect(isAllow(r), 'dangling symlink chain into .claude must not auto-approve').toBe(false);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });
});
