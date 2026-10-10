/**
 * Guard: no hook source calls process.exit(2) (#4561).
 *
 * For a PreToolUse or PermissionRequest hook, exit code 2 BLOCKS the tool
 * call and Claude Code renders the stderr text as a red hook error. The
 * documented deny path is hookSpecificOutput.permissionDecision with exit 0,
 * and a warning is { systemMessage } or additionalContext with exit 0.
 * outputStderrWarning in lib/log.ts was a "warning" helper that exited 2, so
 * any future caller would have silently blocked tool calls.
 *
 * This test scans every non-test .ts file under src/hooks/src for a
 * process.exit(2) call (comments are stripped first) and fails on any hit
 * outside ALLOWLIST. Adding a file to ALLOWLIST needs an audited reason.
 */

import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Paths relative to src/hooks/src that may call process.exit(2). Empty by design.
const ALLOWLIST: ReadonlySet<string> = new Set<string>();

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      out.push(...listSourceFiles(full));
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

const EXIT_2 = /process\.exit\(\s*2\s*\)/;

describe('hook sources never exit 2 (#4561)', () => {
  test('the scan covers the hook source tree', () => {
    const files = listSourceFiles(SRC_ROOT);
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith(join('lib', 'log.ts')))).toBe(true);
  });

  test('no process.exit(2) outside the allowlist', () => {
    const hits = listSourceFiles(SRC_ROOT)
      .map((f) => relative(SRC_ROOT, f))
      .filter((rel) => !ALLOWLIST.has(rel))
      .filter((rel) => EXIT_2.test(stripComments(readFileSync(join(SRC_ROOT, rel), 'utf8'))));
    expect(hits).toEqual([]);
  });

  test('the scanner flags a real call and ignores a commented one', () => {
    expect(EXIT_2.test(stripComments('function f() {\n  process.exit(2);\n}'))).toBe(true);
    expect(EXIT_2.test(stripComments('/** calls process.exit(2) */\n// process.exit(2)\nf();'))).toBe(false);
  });

  test('lib/common.js no longer exports outputStderrWarning', async () => {
    const common: Record<string, unknown> = await import('../../lib/common.js');
    expect(common).not.toHaveProperty('outputStderrWarning');
  });
});
