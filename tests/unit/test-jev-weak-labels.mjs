import assert from 'node:assert/strict';
import { labelDecision } from '../../scripts/lib/jev-weak-labels.mjs';

const sha = 'a'.repeat(40);
const decision = (extra = {}) => ({
  source: 'route:/tmp/s/jev-route.jsonl:1', session_id: 's-a', prompt_id: 'p-a', jev_executor: 'builder', ...extra,
});
const event = (type, extra = {}) => ({ type, session_id: 's-a', prompt_id: 'p-a', evidence: { id: type }, ...extra });

{
  const label = labelDecision(decision(), [
    event('executor', { primary_handoff: true, executor: 'builder', evidence: { id: 'executed' } }),
    event('stop', { clean: true, task_completed: true, primary_handoff: true, executor: 'builder', evidence: { id: 'done' } }),
  ]);
  assert.equal(label.outcome, 'correct');
  assert.equal(label.signal, 'clean_completion');
  assert.deepEqual(label.evidence, [{ id: 'executed' }, { id: 'done' }]);
  assert.equal(Object.hasOwn(label, 'correct'), false);
}

{
  const label = labelDecision(decision(), [
    event('stop', { clean: true, task_completed: true, primary_handoff: true, executor: 'builder', evidence: { id: 'uncorroborated-stop' } }),
    event('executor', { primary_handoff: true, executor: 'reviewer', evidence: { id: 'alternate' } }),
  ]);
  assert.equal(label.outcome, 'wrong');
  assert.equal(label.signal, 'alternate_executor');
  assert.deepEqual(label.signals, ['alternate_executor']);
}

{
  const label = labelDecision(decision(), [
    event('operator_redirect', {
      prompt_id: 'p-next', previous_prompt_id: 'p-a', next_prompt_id: 'p-next', corrected_executor: 'reviewer', evidence: { id: 'redirect' },
    }),
    event('operator_redirect', {
      prompt_id: undefined, previous_prompt_id: 'p-a', next_prompt_id: undefined, corrected_executor: 'reviewer', evidence: { id: 'bad-link' },
    }),
  ]);
  assert.equal(label.outcome, 'wrong');
  assert.equal(label.signal, 'operator_redirect');
  assert.deepEqual(label.evidence, [{ id: 'redirect' }]);
}

{
  const label = labelDecision(decision(), [
    event('executor', { primary_handoff: true, executor: 'builder', evidence: { id: 'first' } }),
    event('executor', { primary_handoff: true, executor: 'reviewer', evidence: { id: 'second' } }),
    event('stop', { clean: true, task_completed: true, primary_handoff: true, executor: 'builder', evidence: { id: 'done' } }),
  ]);
  assert.equal(label.outcome, 'unknown');
  assert.equal(label.signal, 'ambiguous_primary_executor');
  assert.ok(label.signals.includes('executor_ambiguity'));
}

{
  const label = labelDecision(decision(), [
    event('revert', { session_id: 's-other', prompt_id: 'p-later', reverted_sha: sha, repo_id: 'repo-a', success: true, evidence: { id: 'revert' } }),
    event('commit', { sha, repo_id: 'repo-a', owned_by_prompt_id: 'p-a', success: true, evidence: { id: 'commit' } }),
    event('executor', { primary_handoff: true, executor: 'builder', evidence: { id: 'executed' } }),
    event('revert', { prompt_id: 'p-later', reverted_sha: sha, repo_id: 'repo-other', success: true, evidence: { id: 'wrong-repo' } }),
  ]);
  assert.equal(label.outcome, 'wrong');
  assert.equal(label.signal, 'revert');
  assert.deepEqual(label.evidence, [{ id: 'commit' }, { id: 'revert' }]);
}

{
  const label = labelDecision(decision(), [
    event('commit', { sha, repo_id: 'repo-a', owned_by_prompt_id: 'p-a', success: true, evidence: { id: 'commit' } }),
    event('revert', { session_id: 's-other', prompt_id: 'p-later', reverted_sha: sha, repo_id: 'repo-a', success: true, evidence: { id: 'revert' } }),
    event('executor', { primary_handoff: true, executor: 'reviewer', evidence: { id: 'actual-reviewer' } }),
  ]);
  assert.equal(label.outcome, 'wrong');
  assert.equal(label.signal, 'alternate_executor');
  assert.equal(label.signals.includes('revert'), false);
}

{
  const label = labelDecision(decision(), [
    event('commit', { sha, repo_id: 'repo-a', owned_by_prompt_id: 'p-a', success: true, evidence: { id: 'commit' } }),
    event('revert', { session_id: 's-other', prompt_id: 'p-later', reverted_sha: sha, repo_id: 'repo-a', success: true, evidence: { id: 'revert' } }),
  ]);
  assert.equal(label.outcome, 'unknown');
  assert.equal(label.signal, 'no_matching_signal');
  assert.deepEqual(label.evidence, [{ id: 'commit' }, { id: 'revert' }]);
}

{
  const label = labelDecision(decision(), [
    event('commit', { sha: 'b'.repeat(39), repo_id: 'repo-a', owned_by_prompt_id: 'p-a', success: true }),
    event('revert', { prompt_id: 'p-later', reverted_sha: 'b'.repeat(39), repo_id: 'repo-a', success: true }),
    event('stop', { clean: true, task_completed: false, primary_handoff: true, executor: 'builder' }),
    event('executor', { session_id: 's-b', primary_handoff: true, executor: 'reviewer' }),
  ]);
  assert.equal(label.outcome, 'unknown');
  assert.equal(label.signal, 'no_matching_signal');
}

{
  const label = labelDecision(decision({ session_id: null }), [event('executor', { primary_handoff: true, executor: 'reviewer' })]);
  assert.equal(label.signal, 'missing_session_id');
}

{
  assert.equal(labelDecision(decision({ prompt_id: null }), []).signal, 'missing_prompt_id');
  assert.equal(labelDecision(decision({ jev_executor: null }), []).signal, 'missing_executor');
  const plainStop = labelDecision(decision(), [event('stop', { clean: true, task_completed: true, primary_handoff: true, executor: 'builder' })]);
  assert.equal(plainStop.signal, 'no_matching_signal');
}

console.log('PASS: Jev weak labels require explicit prompt, executor, repository and completion evidence');
