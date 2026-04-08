/**
 * Unit tests for antipattern-warning — materializeAntipatternRules only
 *
 * The antipatternWarning() runtime function was removed in v7.27.1 (#1145).
 * Dynamic pattern matching migrated to type:prompt hook in hooks.json.
 * Only materializeAntipatternRules() remains — writes static rules at SessionStart.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { materializeAntipatternRules } from '../../prompt/antipattern-warning.js';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('prompt/antipattern-warning', () => {
  describe('materializeAntipatternRules', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `ap-rules-${Date.now()}`);
      mkdirSync(join(tempDir, '.claude', 'rules'), { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    test('writes .claude/rules/antipatterns.md', () => {
      materializeAntipatternRules(tempDir);
      const rulesFile = join(tempDir, '.claude', 'rules', 'antipatterns.md');
      expect(existsSync(rulesFile)).toBe(true);
    });

    test('rules file contains all 7 known anti-patterns', () => {
      materializeAntipatternRules(tempDir);
      const content = readFileSync(join(tempDir, '.claude', 'rules', 'antipatterns.md'), 'utf8');
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
      const content = readFileSync(join(tempDir, '.claude', 'rules', 'antipatterns.md'), 'utf8');
      expect(content).toContain('# Anti-Pattern Warnings');
    });

    test('each pattern is a bold bullet point', () => {
      materializeAntipatternRules(tempDir);
      const content = readFileSync(join(tempDir, '.claude', 'rules', 'antipatterns.md'), 'utf8');
      const bullets = content.split('\n').filter(l => l.startsWith('- **'));
      expect(bullets.length).toBe(7);
    });
  });
});
