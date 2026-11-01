/**
 * Codex HOLD 6557208634 and b6 HOLD 6557214638 on #4962: a per-handler
 * budget is a timer on the same event loop, so it cannot interrupt
 * synchronous work. An untimed execFileSync in a folded guard (b6's probe:
 * 2 s under a 500 ms budget) runs to the end, and a hung one holds every
 * guard verdict until CC kills the whole dispatcher.
 *
 * Two rules:
 * - every execSync / execFileSync / spawnSync call reachable from either tool
 *   dispatcher passes a `timeout` with `killSignal: 'SIGKILL'`, so blocking
 *   work is bounded by a kill the child cannot ignore (the event loop cannot
 *   provide one, and SIGTERM waits for a child that traps it);
 * - a result that arrives after its budget is discarded (lib/budget.ts),
 *   so late work never decides.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve, relative } from 'node:path';
import { TIMED_OUT, withBudget } from '../../lib/budget.js';

const SRC = join(__dirname, '..', '..');
const ROOTS = [join(SRC, 'pretool', 'tool-dispatcher.ts'), join(SRC, 'posttool', 'tool-dispatcher.ts')];

/** Source with block and line comments blanked (string contents kept). */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

function reachable(): string[] {
  const seen = new Set<string>();
  const stack = [...ROOTS];
  while (stack.length) {
    const f = stack.pop() as string;
    if (seen.has(f)) continue;
    seen.add(f);
    const s = stripComments(readFileSync(f, 'utf8'));
    for (const m of s.matchAll(/(?:import|export)[^'"]*?from\s+['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      let p = resolve(dirname(f), m[1] ?? m[2]).replace(/\.js$/, '.ts');
      if (!existsSync(p) && existsSync(p.replace(/\.ts$/, '/index.ts'))) p = p.replace(/\.ts$/, '/index.ts');
      if (existsSync(p)) stack.push(p);
    }
  }
  return [...seen].sort();
}

function untimedSyncCalls(file: string): string[] {
  const s = stripComments(readFileSync(file, 'utf8'));
  const out: string[] = [];
  for (const m of s.matchAll(/\b(execSync|execFileSync|spawnSync)\s*\(/g)) {
    let depth = 0;
    const open = m.index + m[0].length - 1;
    let j = open;
    for (; j < s.length; j++) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')' && --depth === 0) break;
    }
    const args = s.slice(open, j + 1);
    // A timeout alone sends SIGTERM and then WAITS for the child to exit, so
    // a TERM-ignoring child outlasts it (Codex 6557806212, b6 6557838470:
    // 3024 ms under a 500 ms timeout). The bound is enforceable only with
    // killSignal SIGKILL.
    if (!/\btimeout\b/.test(args) || !/killSignal:\s*'SIGKILL'/.test(args)) {
      out.push(`${relative(SRC, file)}:${s.slice(0, m.index).split('\n').length} ${m[1]}`);
    }
  }
  return out;
}

describe('tool dispatchers: blocking work is bounded', () => {
  it('reaches the folded handlers (sanity: the walk is not empty)', () => {
    const files = reachable().map((f) => relative(SRC, f));
    expect(files).toContain(join('posttool', 'check-plugins-drift.ts'));
    expect(files).toContain(join('pretool', 'bash', 'sync-bash-dispatcher.ts'));
  });

  it('every sync child-process call reachable from a tool dispatcher passes a timeout and killSignal SIGKILL', () => {
    const offenders = reachable().flatMap(untimedSyncCalls);
    expect(offenders).toEqual([]);
  });

  it('the scan sees an untimed call and ignores one in a comment (negative control)', () => {
    const probe = stripComments("// execFileSync('git', ['log'])\nexecFileSync('git', ['status']);\nexecFileSync('git', [], { timeout: 1 });");
    expect(probe.match(/execFileSync\s*\(/g)).toHaveLength(2);
  });
});

describe('an enforceable bound on a TERM-ignoring child', () => {
  // The child traps SIGTERM and sleeps 3 s. With the default SIGTERM the
  // timeout waits it out; with SIGKILL it returns at the timeout.
  const IGNORE_TERM = "process.on('SIGTERM', () => {}); setTimeout(() => {}, 3000);";

  it('killSignal SIGKILL returns at the timeout', () => {
    const started = Date.now();
    expect(() =>
      execFileSync(process.execPath, ['-e', IGNORE_TERM], { stdio: 'ignore', timeout: 300, killSignal: 'SIGKILL' }),
    ).toThrow();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('the default SIGTERM does not (negative control: the probe can disagree)', () => {
    const started = Date.now();
    expect(() => execFileSync(process.execPath, ['-e', IGNORE_TERM], { stdio: 'ignore', timeout: 300 })).toThrow();
    expect(Date.now() - started).toBeGreaterThanOrEqual(2000);
  });
});

describe('lib/budget', () => {
  it('discards a result that arrives after its budget, even from synchronous work', async () => {
    const r = await withBudget(() => {
      const until = Date.now() + 120;
      while (Date.now() < until) {
        /* busy: the timer cannot fire */
      }
      return 'late verdict';
    }, 20);
    expect(r).toBe(TIMED_OUT);
  });

  it('keeps a result that arrives in time', async () => {
    expect(await withBudget(() => 'on time', 200)).toBe('on time');
  });
});
