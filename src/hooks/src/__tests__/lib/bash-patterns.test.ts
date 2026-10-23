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

  describe('git options that run a program', () => {
    test.each([
      'git fetch --upload-pack=x origin',
      'git fetch --upload-pa=x origin',
      'git fetch --upl x origin',
      'git -p status',
      'git --paginate log',
      'git --no-replace-objects -p log',
      'git grep -Ovim hello',
      'git grep -O hello',
      'git grep -nOvim hello',
      'git grep --open-files-in-pager=vim hello',
      'git grep --open-files=vim hello',
      'git grep --op=vim hello',
      // a top-level option with a separate value must not end the scan
      'git --namespace foo grep -Ovim hello',
      'git --namespace foo -p log',
      // --shallow-file takes the next word and is not in `git help git`
      'git --shallow-file /dev/null grep -Opython hello',
      'git --shallow-file x -p log',
    ])('rejects: %s', (cmd) => {
      expect(matchesReject(cmd)).toBe(true);
    });

    test.each([
      'git log -p',
      'git show -p HEAD',
      'git log --stat --graph',
      'git fetch --prune --all',
      'git -P log',
      'git grep -n hello',
      'git grep -e Option -- src',
      'git grep --or -e a -e b',
      'git log -O order.txt -1',
    ])('allows: %s', (cmd) => {
      expect(matchesReject(cmd)).toBe(false);
    });
  });

  test('a long run of git options does not backtrack exponentially', () => {
    // An ambiguous option scan took 3.5 s at 22 options and doubles per option.
    const cmd = `git${' --x'.repeat(40)} status`;
    const start = performance.now();
    expect(matchesReject(cmd)).toBe(false);
    expect(performance.now() - start).toBeLessThan(250);
  });

  test('a long git command with many grep words stays linear', () => {
    const cmd = `git${' grep'.repeat(20000)} hello`;
    const start = performance.now();
    expect(matchesReject(cmd)).toBe(false);
    expect(performance.now() - start).toBeLessThan(250);
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
