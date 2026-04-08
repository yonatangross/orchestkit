/**
 * Unit tests for lib/bash-patterns.ts
 *
 * Tests REJECT_PATTERNS — the unified set of dangerous command patterns
 * that must never be auto-approved or retried.
 */

import { describe, test, expect } from 'vitest';
import { REJECT_PATTERNS } from '../../lib/bash-patterns.js';

function matchesReject(command: string): boolean {
  return REJECT_PATTERNS.some((p) => p.test(command));
}

describe('REJECT_PATTERNS', () => {
  test('is a non-empty array of RegExp', () => {
    expect(REJECT_PATTERNS.length).toBeGreaterThan(0);
    for (const p of REJECT_PATTERNS) {
      expect(p).toBeInstanceOf(RegExp);
    }
  });

  describe('git checkout destructive variants', () => {
    test.each([
      'git checkout -- .',
      'git checkout .',
      'git checkout -f',
      'git checkout --force',
      'git checkout -f main',
      'git checkout --force feature',
    ])('rejects: %s', (cmd) => {
      expect(matchesReject(cmd)).toBe(true);
    });

    test.each([
      'git checkout main',
      'git checkout -b new-branch',
      'git checkout feature/my-branch',
    ])('allows: %s', (cmd) => {
      expect(matchesReject(cmd)).toBe(false);
    });
  });

  describe('git reset --hard', () => {
    test.each([
      'git reset --hard',
      'git reset --hard HEAD~1',
      'git reset --hard origin/main',
    ])('rejects: %s', (cmd) => {
      expect(matchesReject(cmd)).toBe(true);
    });

    test.each([
      'git reset HEAD file.ts',
      'git reset --soft HEAD~1',
    ])('allows: %s', (cmd) => {
      expect(matchesReject(cmd)).toBe(false);
    });
  });

  describe('git push --force', () => {
    test.each([
      'git push --force',
      'git push origin main --force',
      'git push -f',
      'git push -f origin main',
    ])('rejects: %s', (cmd) => {
      expect(matchesReject(cmd)).toBe(true);
    });

    test.each([
      'git push',
      'git push origin main',
      'git push -u origin feature',
    ])('allows: %s', (cmd) => {
      expect(matchesReject(cmd)).toBe(false);
    });
  });

  describe('git clean', () => {
    test.each([
      'git clean',
      'git clean -fd',
      'git clean -fxd',
    ])('rejects: %s', (cmd) => {
      expect(matchesReject(cmd)).toBe(true);
    });
  });

  describe('rm and chmod', () => {
    test.each([
      'rm file.ts',
      'rm -rf /',
      'rm -f node_modules',
      'chmod 777 file.sh',
      'chmod +x script.sh',
    ])('rejects: %s', (cmd) => {
      expect(matchesReject(cmd)).toBe(true);
    });
  });

  describe('safe commands not rejected', () => {
    test.each([
      'git status',
      'git log --oneline',
      'git diff HEAD',
      'ls -la',
      'npm test',
      'cat file.ts',
      'echo hello',
    ])('allows: %s', (cmd) => {
      expect(matchesReject(cmd)).toBe(false);
    });
  });
});
