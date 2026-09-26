/**
 * Unit tests for antipattern-warning — materializeAntipatternRules only
 *
 * The antipatternWarning() runtime function was removed in v7.27.1 (#1145).
 * Dynamic pattern matching migrated to type:prompt hook in hooks.json.
 * Only materializeAntipatternRules() remains — writes static rules at SessionStart.
 *
 * CLAUDE_CONFIG_DIR is pinned to an empty temp dir in every test so a real
 * user-global rules file on the dev machine cannot flip the verdicts.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  materializeAntipatternRules,
  buildAntipatternsContent,
} from '../../prompt/antipattern-warning.js';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

describe('prompt/antipattern-warning', () => {
  describe('materializeAntipatternRules', () => {
    let tempDir: string;
    let configDir: string;
    let savedConfigDir: string | undefined;
    let savedRuleSeed: string | undefined;

    const projectRulesFile = () => join(tempDir, '.claude', 'rules', 'antipatterns.md');
    const globalRulesFile = () => join(configDir, 'rules', 'antipatterns.md');
    const writeGlobal = (content: string) => {
      mkdirSync(join(configDir, 'rules'), { recursive: true });
      writeFileSync(globalRulesFile(), content);
    };
    const indexProjectRules = (content: string) => {
      writeFileSync(projectRulesFile(), content);
      execFileSync('git', ['init', '-q'], { cwd: tempDir });
      execFileSync('git', ['add', '.claude/rules/antipatterns.md'], { cwd: tempDir });
      expect(
        execFileSync('git', ['ls-files', '.claude/rules/antipatterns.md'], {
          cwd: tempDir,
          encoding: 'utf8',
        }).trim(),
      ).toBe('.claude/rules/antipatterns.md');
    };

    beforeEach(() => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      tempDir = join(tmpdir(), `ap-rules-${suffix}`);
      configDir = join(tmpdir(), `ap-cfg-${suffix}`);
      mkdirSync(join(tempDir, '.claude', 'rules'), { recursive: true });
      mkdirSync(configDir, { recursive: true });
      savedConfigDir = process.env.CLAUDE_CONFIG_DIR;
      savedRuleSeed = process.env.ORK_NO_RULE_SEED;
      process.env.CLAUDE_CONFIG_DIR = configDir;
      delete process.env.ORK_NO_RULE_SEED;
    });

    afterEach(() => {
      if (savedConfigDir === undefined) {
        delete process.env.CLAUDE_CONFIG_DIR;
      } else {
        process.env.CLAUDE_CONFIG_DIR = savedConfigDir;
      }
      if (savedRuleSeed === undefined) {
        delete process.env.ORK_NO_RULE_SEED;
      } else {
        process.env.ORK_NO_RULE_SEED = savedRuleSeed;
      }
      rmSync(tempDir, { recursive: true, force: true });
      rmSync(configDir, { recursive: true, force: true });
    });

    test('writes .claude/rules/antipatterns.md', () => {
      materializeAntipatternRules(tempDir);
      expect(existsSync(projectRulesFile())).toBe(true);
    });

    test('rules file contains all 7 known anti-patterns', () => {
      materializeAntipatternRules(tempDir);
      const content = readFileSync(projectRulesFile(), 'utf8');
      expect(content).toContain('offset pagination');
      expect(content).toContain('manual jwt validation');
      expect(content).toContain('plaintext');
      expect(content).toContain('global state');
      expect(content).toContain('synchronous file');
      expect(content).toContain('n+1 query');
      expect(content).toContain('polling for real-time');
    });

    test('rules file has markdown heading', () => {
      materializeAntipatternRules(tempDir);
      const content = readFileSync(projectRulesFile(), 'utf8');
      expect(content).toContain('# Anti-Pattern Warnings');
    });

    test('each pattern is a bold bullet point', () => {
      materializeAntipatternRules(tempDir);
      const content = readFileSync(projectRulesFile(), 'utf8');
      const bullets = content.split('\n').filter(l => l.startsWith('- **'));
      expect(bullets.length).toBe(7);
    });

    test('skips project write when user-global rules file is identical', () => {
      writeGlobal(buildAntipatternsContent());
      materializeAntipatternRules(tempDir);
      expect(existsSync(projectRulesFile())).toBe(false);
    });

    test('preserves a stale project copy when global copy is identical', () => {
      writeFileSync(projectRulesFile(), '# stale rules\n');
      writeGlobal(buildAntipatternsContent());
      materializeAntipatternRules(tempDir);
      expect(readFileSync(projectRulesFile(), 'utf8')).toBe('# stale rules\n');
    });

    test('leaves an existing identical project copy in place', () => {
      writeFileSync(projectRulesFile(), buildAntipatternsContent());
      writeGlobal(buildAntipatternsContent());
      materializeAntipatternRules(tempDir);
      expect(readFileSync(projectRulesFile(), 'utf8')).toBe(buildAntipatternsContent());
    });

    test('writes project file when global copy differs', () => {
      writeGlobal('# different content\n');
      materializeAntipatternRules(tempDir);
      expect(readFileSync(projectRulesFile(), 'utf8')).toBe(buildAntipatternsContent());
    });

    test('writes project file when no global copy exists', () => {
      materializeAntipatternRules(tempDir);
      expect(existsSync(projectRulesFile())).toBe(true);
    });

    test('preserves a git-indexed project copy when no global copy exists', () => {
      const projectContent = '# project policy\n';
      indexProjectRules(projectContent);
      materializeAntipatternRules(tempDir);
      expect(readFileSync(projectRulesFile(), 'utf8')).toBe(projectContent);
    });

    test('preserves a git-indexed project copy when global copy is identical', () => {
      const projectContent = '# project policy\n';
      indexProjectRules(projectContent);
      writeGlobal(buildAntipatternsContent());
      materializeAntipatternRules(tempDir);
      expect(readFileSync(projectRulesFile(), 'utf8')).toBe(projectContent);
    });

    test('preserves a git-indexed project copy when global copy differs', () => {
      const projectContent = '# project policy\n';
      indexProjectRules(projectContent);
      writeGlobal('# different content\n');
      materializeAntipatternRules(tempDir);
      expect(readFileSync(projectRulesFile(), 'utf8')).toBe(projectContent);
    });

    test('does not seed project rules when ORK_NO_RULE_SEED is enabled', () => {
      process.env.ORK_NO_RULE_SEED = '1';
      materializeAntipatternRules(tempDir);
      expect(existsSync(projectRulesFile())).toBe(false);
    });

    test('honors CLAUDE_CONFIG_DIR for the global rules lookup', () => {
      // An identical file outside the configured global dir does not count.
      const stray = join(tempDir, 'elsewhere', 'rules');
      mkdirSync(stray, { recursive: true });
      writeFileSync(join(stray, 'antipatterns.md'), buildAntipatternsContent());
      materializeAntipatternRules(tempDir);
      expect(existsSync(projectRulesFile())).toBe(true);
    });
  });
});
