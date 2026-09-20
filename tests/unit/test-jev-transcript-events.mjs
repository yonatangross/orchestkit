import assert from 'node:assert/strict';
import { transcriptEvents } from '../../scripts/lib/jev-transcript-events.mjs';

const executors = new Set(['Skill:ork:fix-issue', 'Agent:ork-implementer']);
const source = (line) => `fixture.jsonl:${line}`;
const user = (sessionId, uuid, promptId, parentUuid = undefined) => ({
  type: 'user', sessionId, uuid, ...(parentUuid ? { parentUuid } : {}), promptId,
  message: { role: 'user', content: '[omitted]' },
});
const intermediary = (sessionId, uuid, parentUuid) => ({
  type: 'system', sessionId, uuid, parentUuid, subtype: 'hook_summary',
});
const assistant = (sessionId, uuid, parentUuid, blocks) => ({
  type: 'assistant', sessionId, uuid, parentUuid,
  message: { role: 'assistant', content: blocks },
});
const skill = (id, name) => ({ type: 'tool_use', id, name: 'Skill', input: { skill: name } });
const agent = (id, type) => ({ type: 'tool_use', id, name: 'Agent', input: { subagent_type: type } });
const toolResult = (sessionId, uuid, parentUuid, sourceToolUseID, options = {}) => ({
  type: 'system', sessionId, uuid, parentUuid, sourceToolUseID, toolUseResult: {}, ...options,
});
const records = (...rows) => rows.map((row, index) => ({ row, source: source(index + 1) }));

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    intermediary('s-1', 'i-1', 'u-1'),
    assistant('s-1', 'a-1', 'i-1', [skill('call-1', 'ork:fix-issue')]),
    toolResult('s-1', 'result-1', 'a-1', 'call-1'),
  ), { executors });
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    type: 'executor', session_id: 's-1', prompt_id: 'p-1', executor: 'Skill:ork:fix-issue',
    primary_handoff: true, event_id: 'fixture.jsonl:3#tool:call-1',
    evidence: {
      source: 'fixture.jsonl:3', assistant_uuid: 'a-1', tool_use_id: 'call-1',
      result: { observed: true, denied: false, error: false, source_count: 1 },
    },
  });
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    assistant('s-1', 'a-1', 'u-1', [skill('missing-result', 'ork:fix-issue')]),
  ), { executors });
  assert.equal(events[0].primary_handoff, false, 'an absent result cannot prove a primary handoff');
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    assistant('s-1', 'a-1', 'u-1', [skill('failed-result', 'ork:fix-issue')]),
    toolResult('s-1', 'result-1', 'a-1', 'failed-result', { toolUseResult: { is_error: true } }),
  ), { executors });
  assert.equal(events[0].primary_handoff, false, 'a failed result cannot prove a primary handoff');
  assert.equal(events[0].evidence.result.error, true);
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    assistant('s-1', 'a-1', 'u-1', [skill('unrooted-result', 'ork:fix-issue')]),
    toolResult('s-1', 'result-1', 'missing-parent', 'unrooted-result'),
  ), { executors });
  assert.equal(events[0].primary_handoff, false, 'a result without exact ancestry cannot bind a tool use');
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    assistant('s-1', 'a-1', 'u-1', [skill('reused-id', 'ork:fix-issue')]),
    toolResult('s-1', 'result-1', 'a-1', 'reused-id'),
    user('s-1', 'u-2', 'p-2'),
    assistant('s-1', 'a-2', 'u-2', [skill('reused-id', 'ork:fix-issue')]),
  ), { executors });
  assert.equal(events.length, 2);
  assert.equal(events.every((event) => event.primary_handoff === false), true,
    'a tool ID with multiple prompt owners cannot bind any result');
}

{
  const events = transcriptEvents(records(
    assistant('s-1', 'orphan', 'missing-root', [skill('orphan-call', 'ork:fix-issue')]),
  ), { executors });
  assert.deepEqual(events, [], 'missing UUID ancestry must not become a prompt label');
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    { type: 'system', sessionId: 's-1', uuid: 'same-stop', parentUuid: 'u-1', subtype: 'stop_hook_summary', preventedContinuation: false, hookErrors: [] },
    { type: 'system', sessionId: 's-1', uuid: 'same-stop', parentUuid: 'u-1', subtype: 'stop_hook_summary', preventedContinuation: true, hookErrors: [] },
  ), { executors });
  assert.deepEqual(events, [], 'conflicting stop evidence for one UUID is invalid');
}

{
  const events = transcriptEvents(records(
    user('s-a', 'same-uuid', 'p-a'),
    assistant('s-b', 'a-b', 'same-uuid', [skill('cross-session', 'ork:fix-issue')]),
  ), { executors });
  assert.deepEqual(events, [], 'a UUID from another session is not valid ancestry');
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    assistant('s-1', 'dup', 'u-1', [skill('one', 'ork:fix-issue')]),
    assistant('s-1', 'dup', 'different-parent', [skill('two', 'ork:fix-issue')]),
  ), { executors });
  assert.deepEqual(events, [], 'conflicting duplicate UUIDs invalidate their events');
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    assistant('s-1', 'dup-tools', 'u-1', [skill('first', 'ork:fix-issue')]),
    assistant('s-1', 'dup-tools', 'u-1', [skill('second', 'ork:fix-issue')]),
  ), { executors });
  assert.deepEqual(events, [], 'duplicate UUIDs with conflicting tool structure are rejected');
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    assistant('s-1', 'cycle-a', 'cycle-b', [skill('cycle', 'ork:fix-issue')]),
    intermediary('s-1', 'cycle-b', 'cycle-a'),
  ), { executors });
  assert.deepEqual(events, [], 'cycles never gain a prompt identity');
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    assistant('s-1', 'a-1', 'u-1', [skill('denied-call', 'ork:fix-issue')]),
    {
      type: 'system', sessionId: 's-1', uuid: 'result-1', parentUuid: 'a-1',
      sourceToolUseID: 'denied-call', toolDenialKind: 'permission_denied', toolUseResult: { is_error: true },
    },
  ), { executors });
  assert.equal(events.length, 1);
  assert.equal(events[0].primary_handoff, false, 'denied tool use is never observed primary');
  assert.deepEqual(events[0].evidence.result, { observed: true, denied: true, error: true, source_count: 1 });
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    {
      type: 'system', sessionId: 's-1', uuid: 'stop-1', parentUuid: 'u-1', subtype: 'stop_hook_summary',
      preventedContinuation: false, hookErrors: [],
    },
    { type: 'assistant', sessionId: 's-1', uuid: 'end-turn', parentUuid: 'u-1', message: { role: 'assistant', stop_reason: 'end_turn', content: [] } },
  ), { executors });
  assert.equal(events.length, 1, 'end_turn does not create a stop event');
  assert.equal(events[0].type, 'stop');
  assert.equal(events[0].clean, true);
  assert.equal(events[0].task_completed, false, 'clean Stop is not task completion');
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    {
      type: 'system', sessionId: 's-1', uuid: 'blocked-stop', parentUuid: 'u-1', subtype: 'stop_hook_summary',
      preventedContinuation: false, hookErrors: ['failure detail not emitted'],
    },
  ), { executors });
  assert.equal(events.length, 1);
  assert.equal(events[0].clean, false, 'a stop-hook error blocks a clean-stop label');
}

{
  const sidechain = assistant('s-1', 'side', 'u-1', [skill('side-call', 'ork:fix-issue')]);
  sidechain.isSidechain = true;
  const events = transcriptEvents(records(user('s-1', 'u-1', 'p-1'), sidechain), { executors });
  assert.deepEqual(events, [], 'sidechain events cannot label the main prompt');
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    assistant('s-1', 'a-1', 'u-1', [skill('router', 'ork:auto'), agent('agent', 'ork-implementer')]),
    toolResult('s-1', 'result-1', 'a-1', 'agent'),
  ), { executors });
  assert.equal(events.length, 1, 'router calls are not executor events');
  assert.equal(events[0].executor, 'Agent:ork-implementer');
  assert.equal(events[0].primary_handoff, true);
}

{
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    assistant('s-1', 'a-1', 'u-1', [skill('one', 'ork:fix-issue'), agent('two', 'ork-implementer')]),
    toolResult('s-1', 'result-1', 'a-1', 'one'),
    toolResult('s-1', 'result-2', 'a-1', 'two'),
  ), { executors });
  assert.equal(events.filter((event) => event.primary_handoff).length, 2,
    'multiple core executor calls remain explicit for the labeler to mark unknown');
}

{
  const redirect = user('s-1', 'u-2', 'p-2', 'a-1');
  redirect.operator_redirect = {
    human_origin: true, explicit_command: true, previous_prompt_id: 'p-1', next_prompt_id: 'p-2',
    previous_executor: 'Agent:ork-implementer', corrected_executor: 'Skill:ork:fix-issue',
  };
  const events = transcriptEvents(records(
    user('s-1', 'u-1', 'p-1'),
    assistant('s-1', 'a-1', 'u-1', []),
    redirect,
  ), { executors });
  assert.deepEqual(events, [], 'untrusted native operator_redirect fields are ignored');
}

console.log('PASS: transcript events require exact main-chain UUID ancestry and explicit clean-stop evidence');
