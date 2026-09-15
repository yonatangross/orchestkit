/**
 * Tests for lib/subagent-result.ts getSubagentResult (GH-4158).
 *
 * The primary fixture is the SubagentStop payload measured live on CC
 * 2.1.272 (2026-09-15, GH-4158): it carries last_assistant_message and
 * agent_transcript_path and NO agent_output, output, summary or result.
 * Every reader that chained agent_output || output returned '' on it, which
 * is the bug; the reader must return the message.
 */

import { describe, test, expect } from 'vitest';
import { getSubagentResult } from '../../lib/subagent-result.js';
import type { HookInput } from '../../types.js';

function asInput(partial: Record<string, unknown>): HookInput {
  return partial as unknown as HookInput;
}

/** Measured CC 2.1.272 SubagentStop payload (GH-4158). Key-for-key the live
 *  capture; note there is no agent_output key at all. */
const CC_2_1_272_PAYLOAD: Record<string, unknown> = {
  session_id: '9f1d0a4e-2b3c-4d5e-8f90-1a2b3c4d5e6f',
  transcript_path: '/home/user/.claude/projects/-repo/9f1d0a4e.jsonl',
  cwd: '/home/user/repo',
  prompt_id: 'prompt-01J8ZK3M',
  permission_mode: 'acceptEdits',
  agent_id: 'a1b2c3d4e5f6789011',
  agent_type: 'code-quality-reviewer',
  effort: 'high',
  hook_event_name: 'SubagentStop',
  stop_hook_active: false,
  agent_transcript_path: '/home/user/.claude/projects/-repo/subagents/a1b2c3d4.jsonl',
  last_assistant_message:
    'Quality review complete: 2 issues found (unused import, missing test), both fixed.',
  background_tasks: [],
  session_crons: [],
};

describe('getSubagentResult', () => {
  test('returns last_assistant_message on the measured 2.1.272 payload (no agent_output key)', () => {
    const input = asInput(CC_2_1_272_PAYLOAD);
    expect(getSubagentResult(input)).toBe(
      'Quality review complete: 2 issues found (unused import, missing test), both fixed.',
    );
  });

  test('legacy shape: agent_output without last_assistant_message is returned', () => {
    const input = asInput({ agent_output: 'legacy agent output text' });
    expect(getSubagentResult(input)).toBe('legacy agent output text');
  });

  test('prefers last_assistant_message over the legacy names', () => {
    const input = asInput({
      last_assistant_message: 'the real result',
      agent_output: 'legacy output',
      output: 'older output',
    });
    expect(getSubagentResult(input)).toBe('the real result');
  });

  test('empty last_assistant_message falls through to agent_output', () => {
    const input = asInput({ last_assistant_message: '', agent_output: 'fallback output' });
    expect(getSubagentResult(input)).toBe('fallback output');
  });

  test('falls through the legacy chain in order: output, then summary, then result', () => {
    expect(getSubagentResult(asInput({ output: 'from output' }))).toBe('from output');
    expect(getSubagentResult(asInput({ summary: 'from summary' }))).toBe('from summary');
    expect(getSubagentResult(asInput({ result: 'from result' }))).toBe('from result');
    expect(getSubagentResult(asInput({ output: '', summary: 'from summary' }))).toBe('from summary');
  });

  test('empty-string candidates do not mask non-empty legacy ones', () => {
    const input = asInput({ agent_output: '', output: '', summary: 'from summary' });
    expect(getSubagentResult(input)).toBe('from summary');
  });

  test('non-string values are skipped, not coerced', () => {
    const input = asInput({ output: { text: 'object output' }, result: 42 });
    expect(getSubagentResult(input)).toBe('');
  });

  test('returns the empty string when nothing is present', () => {
    expect(getSubagentResult(asInput(CC_2_1_272_PAYLOAD_MUTED()))).toBe('');
  });

  test('empty input object returns the empty string', () => {
    expect(getSubagentResult(asInput({}))).toBe('');
  });
});

function CC_2_1_272_PAYLOAD_MUTED(): Record<string, unknown> {
  const { last_assistant_message: _drop, ...rest } = CC_2_1_272_PAYLOAD;
  return rest;
}
