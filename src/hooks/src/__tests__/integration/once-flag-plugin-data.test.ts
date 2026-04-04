/**
 * Integration: unified-dispatcher once-flags + prompt-hash use CLAUDE_PLUGIN_DATA
 * CC 2.1.78 — validates PLUGIN_DATA vs legacy .claude/memory/sessions/ fallback.
 * Uses REAL filesystem (os.tmpdir), no fs mocks.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock sub-hooks (suppress side effects, not filesystem)
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: () => process.env.CLAUDE_PROJECT_DIR || '.',
    getSessionId: () => process.env.CLAUDE_SESSION_ID || 'fallback-sid',
  };
});

vi.mock('../../lib/prompt-guards.js', () => ({
  isImageOrBinaryPrompt: () => false,
  MAX_PROMPT_LENGTH: 100000,
}));

vi.mock('../../lib/effort-detector.js', () => ({
  detectEffortLevel: () => 'high',
  effortTokenBudget: () => 50000,
}));

vi.mock('../../prompt/handoff-injector.js', () => ({
  handoffInjector: () => ({
    continue: true,
    hookSpecificOutput: { additionalContext: 'test-handoff' },
  }),
}));

vi.mock('../../prompt/agentation-context.js', () => ({
  agentationContext: () => ({ continue: true, suppressOutput: true }),
}));

vi.mock('../../prompt/context-exhaustion-warner.js', () => ({
  contextExhaustionWarner: () => ({ continue: true, suppressOutput: true }),
}));

vi.mock('../../prompt/pipeline-detector.js', () => ({
  pipelineDetector: () => ({ continue: true, suppressOutput: true }),
}));

import { unifiedPromptDispatcher } from '../../prompt/unified-dispatcher.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

let tmpDir: string;
const savedEnv: Record<string, string | undefined> = {};

function saveEnv(...keys: string[]): void {
  for (const key of keys) savedEnv[key] = process.env[key];
}
function restoreEnv(): void {
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
}
function makeInput(sid: string, projectDir: string, prompt = 'test prompt'): HookInput {
  return { tool_name: 'UserPromptSubmit', session_id: sid, tool_input: {}, project_dir: projectDir, prompt };
}
function setEnv(pluginData: string | undefined, projectDir: string, sid: string): void {
  if (pluginData) process.env.CLAUDE_PLUGIN_DATA = pluginData;
  else delete process.env.CLAUDE_PLUGIN_DATA;
  process.env.CLAUDE_PROJECT_DIR = projectDir;
  process.env.CLAUDE_SESSION_ID = sid;
}

let testCtx: ReturnType<typeof createTestContext>;
describe('unified-dispatcher once-flags + hash with PLUGIN_DATA (real fs)', () => {
  beforeEach(() => {
    testCtx = createTestContext();
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ork-onceflag-'));
    saveEnv('CLAUDE_PLUGIN_DATA', 'CLAUDE_PROJECT_DIR', 'CLAUDE_SESSION_ID');
  });

  afterAll(() => {
    restoreEnv();
    try { if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true }); }
    catch { /* best-effort */ }
  });

  describe('PLUGIN_DATA set', () => {
    it('once-flag and prompt-hash land under PLUGIN_DATA, not legacy path', () => {
      const pd = path.join(tmpDir, 'pd'), proj = path.join(tmpDir, 'proj'), sid = 'pd-001';
      setEnv(pd, proj, sid);

      unifiedPromptDispatcher(makeInput(sid, proj));

      // once-flag under PLUGIN_DATA
      expect(existsSync(path.join(pd, 'sessions', sid, 'once-flags', 'handoff-injector.done'))).toBe(true);
      // prompt-hash under PLUGIN_DATA
      expect(existsSync(path.join(pd, 'sessions', sid, 'prompt-hash.txt'))).toBe(true);
      // NOT in legacy path
      expect(existsSync(path.join(proj, '.claude', 'memory', 'sessions', sid))).toBe(false);
    });
  });

  describe('PLUGIN_DATA absent', () => {
    it('once-flag and prompt-hash land under projectDir/.claude/memory/sessions/', () => {
      const proj = path.join(tmpDir, 'proj-leg'), sid = 'leg-001';
      setEnv(undefined, proj, sid);

      unifiedPromptDispatcher(makeInput(sid, proj));

      const base = path.join(proj, '.claude', 'memory', 'sessions', sid);
      expect(existsSync(path.join(base, 'once-flags', 'handoff-injector.done'))).toBe(true);
      expect(existsSync(path.join(base, 'prompt-hash.txt'))).toBe(true);
    });
  });

  describe('once-flag persistence', () => {
    it('second call skips once-per-session hooks', () => {
      const pd = path.join(tmpDir, 'pd-per'), proj = path.join(tmpDir, 'proj-per'), sid = 'per-001';
      setEnv(pd, proj, sid);

      const r1 = unifiedPromptDispatcher(makeInput(sid, proj));
      // Second call with DIFFERENT prompt to avoid hash-delta skip
      const r2 = unifiedPromptDispatcher(makeInput(sid, proj, 'different prompt'));

      // First call produced handoff context
      expect(r1.hookSpecificOutput?.additionalContext).toContain('test-handoff');
      // Second call: handoff blocked by once-flag
      expect(r2.hookSpecificOutput?.additionalContext ?? '').not.toContain('test-handoff');
    });
  });

  describe('hash delta detection', () => {
    it('identical prompt on second call triggers delta skip', () => {
      const pd = path.join(tmpDir, 'pd-hash'), proj = path.join(tmpDir, 'proj-hash'), sid = 'hash-001';
      setEnv(pd, proj, sid);
      const prompt = 'identical prompt for hashing';

      const r1 = unifiedPromptDispatcher(makeInput(sid, proj, prompt));
      expect(r1.hookSpecificOutput?.additionalContext).toBeDefined();

      // Same prompt again — once-hooks already ran, hash unchanged → silent
      const r2 = unifiedPromptDispatcher(makeInput(sid, proj, prompt));
      expect(r2.suppressOutput).toBe(true);
      expect(r2.hookSpecificOutput?.additionalContext).toBeUndefined();
    });

    it('different prompt after first call updates hash file', () => {
      const pd = path.join(tmpDir, 'pd-hd'), proj = path.join(tmpDir, 'proj-hd'), sid = 'hd-001';
      setEnv(pd, proj, sid);

      unifiedPromptDispatcher(makeInput(sid, proj, 'prompt alpha'));
      unifiedPromptDispatcher(makeInput(sid, proj, 'prompt beta'));

      // Hash file should exist and have been updated
      expect(existsSync(path.join(pd, 'sessions', sid, 'prompt-hash.txt'))).toBe(true);
    });
  });
});
