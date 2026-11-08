import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { contextCrossingWarn } from '../posttool/context-crossing-warn.js';
import { loadAccumStateOrNull } from '../lib/session-token-accum.js';
import { nudgeOutcomeResolver } from '../lifecycle/nudge-outcome-resolver.js';
import { postCompactRecovery } from '../lifecycle/post-compact-recovery.js';
import { preCompactSaver } from '../lifecycle/pre-compact-saver.js';
import { cacheBreakDetector } from '../prompt/cache-break-detector.js';
import { readTurnCount } from '../lib/session-turn-counter.js';
import { writeMarker } from '../lib/nudge-outcome-state.js';
import { createTestContext } from './fixtures/test-context.js';
import type { HookInput } from '../types.js';

describe('State machine regression: session_id split-brain and turn counter', () => {
  let tempDir: string;
  let pluginDataDir: string;
  const SMART_SESSION_ID = 'orchestkit-main-1107-0906-59ba';
  const CC_UUID_1 = 'f3680d2b-495a-4f3d-8bfb-db6224361813';
  const CC_UUID_2 = '9a12bc34-5678-4ef0-9123-abcdef012345';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ork-sm-session-id-'));
    pluginDataDir = join(tempDir, 'plugin-data');
    process.env.CLAUDE_PROJECT_DIR = tempDir;
    process.env.CLAUDE_PLUGIN_DATA = pluginDataDir;
  });

  afterEach(() => {
    delete process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('contextCrossingWarn keys token accumulator by input.session_id so goal-tracker loadAccumStateOrNull finds it', () => {
    const ctx = createTestContext({
      projectDir: tempDir,
      sessionId: SMART_SESSION_ID,
    });
    const input: HookInput = {
      tool_name: 'Read',
      session_id: CC_UUID_1,
      project_dir: tempDir,
      tool_input: {},
      tool_output: 'x'.repeat(4000),
    };

    contextCrossingWarn(input, ctx);

    const accum = loadAccumStateOrNull(tempDir, CC_UUID_1);
    expect(accum).not.toBeNull();
    expect(accum?.estimatedTokens).toBeGreaterThan(0);
  });

  it('nudgeOutcomeResolver resolves prior session marker as clear after /clear even when ctx.sessionId retains cached smart ID', () => {
    // Session 1 writes a PreCompact nudge marker using its CC UUID
    writeMarker(tempDir, CC_UUID_1, new Date(Date.now() - 60_000).toISOString());

    // User runs /clear -> Session 2 starts with new CC_UUID_2 in input.session_id,
    // while ctx.sessionId still holds the 24h cached smart ID (or even if Session 1 had used ctx.sessionId).
    const ctx = createTestContext({
      projectDir: tempDir,
      sessionId: CC_UUID_1,
    });
    const sessionStartInput: HookInput = {
      tool_name: 'SessionStart',
      session_id: CC_UUID_2,
      project_dir: tempDir,
      tool_input: {},
    };

    nudgeOutcomeResolver(sessionStartInput, ctx);

    const decisionsPath = join(tempDir, '.claude', 'telemetry', 'pre-compact-decisions.jsonl');
    expect(existsSync(decisionsPath)).toBe(true);
    const record = JSON.parse(readFileSync(decisionsPath, 'utf8').trim());
    expect(record.user_action).toBe('clear');
    expect(record.nudge_session_id).toBe(CC_UUID_1);
  });

  it('preCompactSaver and postCompactRecovery round-trip state via input.session_id when ctx.sessionId differs', () => {
    const logDir = join(tempDir, '.claude', 'logs');
    const saverCtx = createTestContext({
      projectDir: tempDir,
      logDir,
      sessionId: SMART_SESSION_ID,
    });
    preCompactSaver(
      {
        tool_name: 'PreCompact',
        session_id: CC_UUID_1,
        project_dir: tempDir,
        tool_input: {},
      },
      saverCtx,
    );

    const expectedStateFile = join(logDir, 'sessions', `${CC_UUID_1}-state.json`);
    expect(existsSync(expectedStateFile)).toBe(true);

    // PostCompact in same CC_UUID_1 session resolves marker keyed by CC_UUID_1
    writeMarker(tempDir, CC_UUID_1, new Date(Date.now() - 10_000).toISOString());
    const recoveryCtx = createTestContext({
      projectDir: tempDir,
      logDir,
      sessionId: SMART_SESSION_ID,
    });
    postCompactRecovery(
      {
        tool_name: 'PostCompact',
        session_id: CC_UUID_1,
        project_dir: tempDir,
        tool_input: {},
      },
      recoveryCtx,
    );

    const decisionsPath = join(tempDir, '.claude', 'telemetry', 'pre-compact-decisions.jsonl');
    expect(existsSync(decisionsPath)).toBe(true);
    const record = JSON.parse(readFileSync(decisionsPath, 'utf8').trim());
    expect(record.user_action).toBe('compact');
    expect(record.nudge_session_id).toBe(CC_UUID_1);
  });

  it('cacheBreakDetector increments turnCount even when prompt is shorter than 50 chars', () => {
    const ctx = createTestContext({
      projectDir: tempDir,
      sessionId: SMART_SESSION_ID,
    });

    // Turn 1: short /goal prompt (28 chars < 50)
    cacheBreakDetector(
      {
        hook_event: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        session_id: CC_UUID_1,
        project_dir: tempDir,
        tool_input: {},
        prompt: '/goal until npm test passes',
      },
      ctx,
    );
    expect(readTurnCount(CC_UUID_1)).toBe(1);

    // Turn 2: short follow-up prompt (8 chars < 50)
    cacheBreakDetector(
      {
        hook_event: 'UserPromptSubmit',
        tool_name: 'UserPromptSubmit',
        session_id: CC_UUID_1,
        project_dir: tempDir,
        tool_input: {},
        prompt: 'continue',
      },
      ctx,
    );
    expect(readTurnCount(CC_UUID_1)).toBe(2);
  });
});
