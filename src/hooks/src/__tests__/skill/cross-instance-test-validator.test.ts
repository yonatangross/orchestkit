/**
 * Unit tests for cross-instance-test-validator hook (Stop-time shape, #3804)
 *
 * Real filesystem, no fs mocks: the previous suite built a payload carrying
 * `tool_input.file_path` that the registered event (Stop) never delivers, so
 * every test was green while the hook was dead in production. These tests
 * drive the hook with a Stop payload and a seeded `.claude/state/edit-history.jsonl`.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import type { HookInput } from '../../types.js';
import { crossInstanceTestValidator, testFileCandidates } from '../../skill/cross-instance-test-validator.js';
import { createTestContext } from '../fixtures/test-context.js';

const SID = 'sid-aaaa-1111';
const OTHER_SID = 'sid-bbbb-2222';

let project: string;

function write(rel: string, content: string): string {
  const full = join(project, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  return full;
}

function recordEdit(file: string, sid: string = SID, tool = 'Write'): void {
  const p = join(project, '.claude', 'state', 'edit-history.jsonl');
  mkdirSync(dirname(p), { recursive: true });
  appendFileSync(p, `${JSON.stringify({ t: Date.now(), f: file, tool, sid })}\n`);
}

function stopInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: SID,
    project_dir: project,
    tool_input: {},
    stop_hook_active: false,
    ...overrides,
  };
}

const IMPL = 'export function alpha() { return 1; }\nexport function beta() { return 2; }\n';

describe('cross-instance-test-validator (Stop)', () => {
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'citv-'));
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  test('silent when the session wrote nothing', () => {
    const r = crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));
    expect(r.continue).toBe(true);
    expect(r.stopReason).toBeUndefined();
  });

  test('blocks at Stop when a new implementation file has exports and no test file', () => {
    const f = write('src/svc.ts', IMPL);
    recordEdit(f);

    const r = crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));

    expect(r.continue).toBe(false);
    expect(r.stopReason).toContain('Missing test coverage');
    expect(r.stopReason).toContain(f);
    expect(r.stopReason).toContain('alpha');
    expect(r.stopReason).toContain('beta');
  });

  test('stop_hook_active short-circuits even with an untested file', () => {
    const f = write('src/svc.ts', IMPL);
    recordEdit(f);

    const r = crossInstanceTestValidator(stopInput({ stop_hook_active: true }), createTestContext({ projectDir: project }));

    expect(r.continue).toBe(true);
    expect(r.stopReason).toBeUndefined();
  });

  test('a sibling .test.ts file satisfies the check', () => {
    const f = write('src/svc.ts', IMPL);
    write('src/svc.test.ts', 'import { alpha, beta } from "./svc";\n');
    recordEdit(f);

    const r = crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));

    expect(r.continue).toBe(true);
    expect(r.systemMessage).toBeUndefined();
  });

  test('a MIRRORED __tests__ tree satisfies the check (this repo\'s own layout)', () => {
    const f = write('src/hooks/src/skill/thing.ts', IMPL);
    write('src/hooks/src/__tests__/skill/thing.test.ts', 'alpha(); beta();\n');
    recordEdit(f);

    const r = crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));

    expect(r.continue).toBe(true);
    expect(r.systemMessage).toBeUndefined();
  });

  test('a python tests/ mirror satisfies the check', () => {
    const f = write('pkg/mod/svc.py', 'def alpha():\n    return 1\n\nclass Beta:\n    pass\n');
    write('pkg/tests/mod/test_svc.py', 'from mod.svc import alpha, Beta\n');
    recordEdit(f);

    const r = crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));

    expect(r.continue).toBe(true);
  });

  test('warns (systemMessage, no block) when the test file exists but misses a unit', () => {
    const f = write('src/svc.ts', IMPL);
    write('src/svc.test.ts', 'import { alpha } from "./svc";\n');
    recordEdit(f);

    const r = crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));

    expect(r.continue).toBe(true);
    expect(r.systemMessage).toContain('beta');
    expect(r.systemMessage).not.toContain('- alpha');
  });

  test('ignores edits recorded by another session (#2919)', () => {
    const f = write('src/svc.ts', IMPL);
    recordEdit(f, OTHER_SID);

    const r = crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));

    expect(r.continue).toBe(true);
  });

  test('ignores entries with no session id and a payload with no session id', () => {
    const f = write('src/svc.ts', IMPL);
    recordEdit(f, '');

    const r = crossInstanceTestValidator(
      stopInput({ session_id: '' }),
      createTestContext({ projectDir: project, sessionId: '' }),
    );

    expect(r.continue).toBe(true);
  });

  test('reports each file once per session: the second Stop is silent', () => {
    const f = write('src/svc.ts', IMPL);
    recordEdit(f);
    const ctx = createTestContext({ projectDir: project });

    const first = crossInstanceTestValidator(stopInput(), ctx);
    const second = crossInstanceTestValidator(stopInput(), ctx);

    expect(first.continue).toBe(false);
    expect(second.continue).toBe(true);
    const marker = join(project, '.claude', 'state', `test-coverage-reported-${SID}.json`);
    expect(existsSync(marker)).toBe(true);
    expect(JSON.parse(readFileSync(marker, 'utf8'))).toEqual([f]);
  });

  test('a file written by another session in the same project is not remembered against this one', () => {
    const f = write('src/svc.ts', IMPL);
    recordEdit(f);
    crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));

    // the other session now writes the same file and stops
    recordEdit(f, OTHER_SID);
    const r = crossInstanceTestValidator(
      stopInput({ session_id: OTHER_SID }),
      createTestContext({ projectDir: project, sessionId: OTHER_SID }),
    );

    expect(r.continue).toBe(false);
  });

  test('skips test files, non-code files and files deleted since the write', () => {
    const t = write('src/svc.test.ts', 'export function helper() {}\n');
    const md = write('docs/notes.md', '# export function looksLikeCode() {}\n');
    const gone = join(project, 'src', 'gone.ts');
    recordEdit(t);
    recordEdit(md);
    recordEdit(gone);

    const r = crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));

    expect(r.continue).toBe(true);
  });

  test('a file with no exports needs no test', () => {
    const f = write('src/script.ts', 'const x = 1;\nconsole.log(x);\n');
    recordEdit(f);

    const r = crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));

    expect(r.continue).toBe(true);
  });

  test('resolves a relative edit-history path against the project dir', () => {
    write('src/svc.ts', IMPL);
    recordEdit('src/svc.ts');

    const r = crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));

    expect(r.continue).toBe(false);
    expect(r.stopReason).toContain(join(project, 'src', 'svc.ts'));
  });

  test('falls back to ctx for projectDir and sessionId when the payload omits them', () => {
    const f = write('src/svc.ts', IMPL);
    recordEdit(f);

    const r = crossInstanceTestValidator(
      { tool_name: '', session_id: '', tool_input: {} } as HookInput,
      createTestContext({ projectDir: project, sessionId: SID }),
    );

    expect(r.continue).toBe(false);
  });

  test('lists at most five files and counts the rest', () => {
    for (let i = 0; i < 7; i++) recordEdit(write(`src/m${i}.ts`, IMPL));

    const r = crossInstanceTestValidator(stopInput(), createTestContext({ projectDir: project }));

    expect(r.continue).toBe(false);
    expect(r.stopReason).toContain('and 2 more file(s)');
  });
});

describe('cross-instance-test-validator (legacy single-file dispatch)', () => {
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'citv-'));
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  test('blocks on a Write payload for an implementation without a test file', () => {
    const f = join(project, 'src', 'svc.ts');
    const r = crossInstanceTestValidator(
      { tool_name: 'Write', session_id: SID, project_dir: project, tool_input: { file_path: f, content: IMPL } },
      createTestContext({ projectDir: project }),
    );

    expect(r.continue).toBe(false);
    expect(r.stopReason).toContain(f);
  });

  test('reads the file from disk when the payload carries no content (Edit)', () => {
    const f = write('src/svc.ts', IMPL);
    write('src/svc.test.ts', 'alpha();\n');

    const r = crossInstanceTestValidator(
      { tool_name: 'Edit', session_id: SID, project_dir: project, tool_input: { file_path: f } },
      createTestContext({ projectDir: project }),
    );

    expect(r.continue).toBe(true);
    expect(r.systemMessage).toContain('beta');
  });

  test('silent for a test file payload', () => {
    const r = crossInstanceTestValidator(
      { tool_name: 'Write', session_id: SID, project_dir: project, tool_input: { file_path: join(project, 'a.test.ts'), content: 'export function x() {}' } },
      createTestContext({ projectDir: project }),
    );
    expect(r.continue).toBe(true);
  });
});

describe('testFileCandidates', () => {
  test('includes sibling, sibling __tests__ and every mirrored ancestor tree', () => {
    const c = testFileCandidates('/p/src/hooks/src/skill/x.ts', '/p');
    expect(c).toContain('/p/src/hooks/src/skill/x.test.ts');
    expect(c).toContain('/p/src/hooks/src/skill/__tests__/x.test.ts');
    expect(c).toContain('/p/src/hooks/src/__tests__/skill/x.test.ts');
    expect(c).toContain('/p/src/hooks/tests/src/skill/x.spec.ts');
    expect(c).toContain('/p/__tests__/src/hooks/src/skill/x.test.tsx');
  });

  test('stops the ancestor walk at the project dir', () => {
    const c = testFileCandidates('/p/src/x.ts', '/p');
    expect(c.some((p) => p.startsWith('/__tests__/') || p.startsWith('/tests/'))).toBe(false);
  });

  test('python: sibling, tests/ subdir, and mirrored tests/ at each ancestor', () => {
    const c = testFileCandidates('/p/pkg/mod/svc.py', '/p');
    expect(c).toContain('/p/pkg/mod/test_svc.py');
    expect(c).toContain('/p/pkg/mod/tests/test_svc.py');
    expect(c).toContain('/p/pkg/tests/mod/test_svc.py');
    expect(c).toContain('/p/pkg/tests/test_svc.py');
    expect(c).toContain('/p/tests/pkg/mod/svc_test.py');
  });
});
