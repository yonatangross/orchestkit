/**
 * The forwarded PostToolUseFailure record carries a fixed error_class and
 * never any part of the error text, the tool input, paths or cwd.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

const logHook = vi.fn();

vi.mock('../../lib/common.js', () => mockCommonBasic({
  getSessionId: () => 'test-session-123',
  getCachedBranch: () => 'test-branch',
  logHook: (...args: unknown[]) => logHook(...args),
}));

vi.mock('../../lib/crypto.js', () => ({
  sanitizePayload: (obj: unknown) => obj,
  signPayload: (body: string, _secret: string) => `sha256=mock-${body.length}`,
}));

vi.mock('../../lifecycle/usage-summary-reporter.js', () => ({
  getProjectSlug: () => 'test-project',
}));

import type { HookInput } from '../../types.js';
import type { TelemetryEvent, TelemetrySink } from '../../lib/telemetry.js';
import * as telemetry from '../../lib/telemetry.js';

const { buildEvent, emit, registerSink, _resetSinksForTesting } = telemetry;

const MARKER = 'QZX-MARKER-7f3a91';
const ERROR_TEXT =
  `Exit code 1\ncat: /Users/someone/clients/${MARKER}/secret-notes.txt: No such file or directory`;

/**
 * True when the serialized record holds the marker or any 10-char window of
 * the error text. Used on real records and on the control record below.
 */
function leaksErrorText(record: unknown, errorText: string, windowLen = 10): boolean {
  const json = JSON.stringify(record);
  if (json.includes(MARKER)) return true;
  for (let i = 0; i + windowLen <= errorText.length; i++) {
    if (json.includes(errorText.slice(i, i + windowLen))) return true;
  }
  return false;
}

function failureInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    hook_event: 'PostToolUseFailure',
    session_id: 'sess-abc',
    tool_name: 'Bash',
    tool_use_id: 'toolu_01',
    tool_input: { command: `cat /Users/someone/clients/${MARKER}/secret-notes.txt` },
    error: ERROR_TEXT,
    cwd: `/Users/someone/clients/${MARKER}`,
    ...overrides,
  } as HookInput;
}

class RecordingSink implements TelemetrySink {
  readonly name = 'recorder';
  readonly supportedEvents: string[] = [];
  readonly events: TelemetryEvent[] = [];
  addEvent(event: TelemetryEvent): void { this.events.push(event); }
  async flush(): Promise<void> {}
}

describe('PostToolUseFailure telemetry record', () => {
  beforeEach(() => {
    _resetSinksForTesting();
    // Optional call so the RED run on main fails on behavior, not on a missing export.
    (telemetry as { _resetFailureWarningsForTesting?: () => void })._resetFailureWarningsForTesting?.();
    logHook.mockClear();
  });

  it('carries error_class from the closed list', () => {
    const event = buildEvent(failureInput());
    expect(event.data.error_class).toBe('not_found');
    expect(event.data.error_class_version).toBe(1);
    expect(event.data.tool_name).toBe('Bash');
  });

  it('contains no substring of the error text, the command, the path or cwd', () => {
    const event = buildEvent(failureInput());
    expect(leaksErrorText(event, ERROR_TEXT)).toBe(false);
    expect(event.data.tool_input).toBeUndefined();
    expect(event.data.tool_output).toBeUndefined();
    expect(event.data.tool_error).toBeUndefined();
  });

  it('does not leak even when the legacy tool_error field is populated', () => {
    const event = buildEvent(failureInput({ tool_error: ERROR_TEXT }));
    expect(leaksErrorText(event, ERROR_TEXT)).toBe(false);
  });

  it('the record written to a sink is clean too', () => {
    const sink = new RecordingSink();
    registerSink(sink);
    emit(failureInput());
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0].data.error_class).toBe('not_found');
    expect(leaksErrorText(sink.events[0], ERROR_TEXT)).toBe(false);
  });

  it('is_interrupt classes as interrupted', () => {
    expect(buildEvent(failureInput({ is_interrupt: true })).data.error_class).toBe('interrupted');
  });

  it('a payload without error still gets a record, classed other, and warns once per cause', () => {
    const a = buildEvent(failureInput({ error: undefined }));
    const b = buildEvent(failureInput({ error: undefined }));
    expect(a.data.error_class).toBe('other');
    expect(b.data.error_class).toBe('other');
    const warnings = logHook.mock.calls.filter(c => String(c[1]).includes('error_class'));
    expect(warnings).toHaveLength(1);
    expect(leaksErrorText(warnings, ERROR_TEXT)).toBe(false);
  });

  it('other events are unchanged: no error_class, tool_input kept', () => {
    const event = buildEvent({
      hook_event: 'PreToolUse',
      session_id: 's',
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
    } as HookInput);
    expect(event.data.error_class).toBeUndefined();
    expect(event.data.tool_input).toEqual({ command: 'npm test' });
  });

  it('control: the leak check catches a record that carries the marker', () => {
    const leaky = { data: { error_class: 'not_found', note: `saw ${MARKER}` } };
    expect(leaksErrorText(leaky, ERROR_TEXT)).toBe(true);
    const leakyWindow = { data: { error_class: 'not_found', note: ERROR_TEXT.slice(0, 12) } };
    expect(leaksErrorText(leakyWindow, ERROR_TEXT)).toBe(true);
  });
});
