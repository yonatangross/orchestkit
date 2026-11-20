const POLICY_VERSION = '1';
const FULL_SHA = /^[0-9a-f]{40}$/i;
const PRIORITY = ['revert', 'operator_redirect', 'alternate_executor', 'clean_completion'];

function string(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function samePrompt(event, decision) {
  return event.session_id === decision.session_id && event.prompt_id === decision.prompt_id;
}

function pushEvidence(target, event) {
  if (event.evidence === undefined || event.evidence === null) return;
  const key = JSON.stringify(event.evidence);
  if (!target.some((entry) => JSON.stringify(entry) === key)) target.push(event.evidence);
}

function result(decision, outcome, signal, signals, evidence) {
  return {
    source: string(decision?.source),
    kind: 'weak',
    outcome,
    signal,
    signals,
    evidence,
    session_id: string(decision?.session_id),
    prompt_id: string(decision?.prompt_id),
    policy_version: POLICY_VERSION,
  };
}

/**
 * Label a Jev executor choice only from explicit, correlated telemetry.
 * Events may arrive in source order rather than global causal order. No session
 * tail, timestamp or inferred ownership substitutes for explicit identities.
 */
export function labelDecision(decision, events) {
  if (!decision || typeof decision !== 'object') return result(decision, 'unknown', 'missing_decision', [], []);
  if (!string(decision.source)) return result(decision, 'unknown', 'missing_source', [], []);
  if (!string(decision.session_id)) return result(decision, 'unknown', 'missing_session_id', [], []);
  if (!string(decision.prompt_id)) return result(decision, 'unknown', 'missing_prompt_id', [], []);
  if (!string(decision.jev_executor)) return result(decision, 'unknown', 'missing_executor', [], []);
  if (!Array.isArray(events)) return result(decision, 'unknown', 'no_matching_signal', [], []);

  const signals = [];
  const evidence = [];
  const add = (signal, event) => {
    if (!signals.includes(signal)) signals.push(signal);
    pushEvidence(evidence, event);
  };
  const primaryExecutors = new Set();
  const matchingPrimary = [];
  const cleanStops = [];
  const revertCandidates = [];
  const commits = events.filter((event) => event && typeof event === 'object'
    && event.type === 'commit' && samePrompt(event, decision)
    && event.owned_by_prompt_id === decision.prompt_id
    && event.success === true && FULL_SHA.test(event.sha || '') && string(event.repo_id));

  for (const event of events) {
    if (!event || typeof event !== 'object') continue;

    if (event.type === 'revert' && event.success === true && string(event.repo_id) && FULL_SHA.test(event.reverted_sha || '')) {
      for (const commit of commits) {
        if (commit.repo_id === event.repo_id && commit.sha === event.reverted_sha) {
          revertCandidates.push({ commit, revert: event });
        }
      }
      continue;
    }

    if (event.session_id !== decision.session_id) continue;

    if (event.type === 'operator_redirect') {
      const redirectsThisDecision = string(event.previous_prompt_id) === decision.prompt_id
        && string(event.next_prompt_id) && string(event.prompt_id)
        && string(event.next_prompt_id) === string(event.prompt_id)
        && event.next_prompt_id !== event.previous_prompt_id
        && string(event.corrected_executor)
        && event.corrected_executor !== decision.jev_executor;
      if (redirectsThisDecision) add('operator_redirect', event);
      continue;
    }

    if (event.type === 'executor' && samePrompt(event, decision) && event.primary_handoff === true && string(event.executor)) {
      primaryExecutors.add(event.executor);
      if (event.executor === decision.jev_executor) matchingPrimary.push(event);
      if (event.executor !== decision.jev_executor) add('alternate_executor', event);
      continue;
    }

    if (event.type === 'stop' && samePrompt(event, decision)
      && event.clean === true && event.task_completed === true
      && event.primary_handoff === true && event.executor === decision.jev_executor) {
      cleanStops.push(event);
    }
  }

  if (primaryExecutors.size > 1) {
    const primaryEvents = events.filter((event) => event && event.type === 'executor'
      && samePrompt(event, decision) && event.primary_handoff === true && string(event.executor));
    primaryEvents.forEach((event) => add('executor_ambiguity', event));
  }
  for (const candidate of revertCandidates) {
    pushEvidence(evidence, candidate.commit);
    pushEvidence(evidence, candidate.revert);
  }
  if (matchingPrimary.length > 0 && primaryExecutors.size === 1) {
    revertCandidates.forEach((candidate) => {
      add('revert', candidate.commit);
      add('revert', candidate.revert);
    });
  }
  if (matchingPrimary.length > 0 && cleanStops.length > 0) {
    matchingPrimary.forEach((event) => pushEvidence(evidence, event));
    cleanStops.forEach((event) => add('clean_completion', event));
  }

  const decisive = PRIORITY.find((signal) => signals.includes(signal));
  const ambiguous = signals.includes('executor_ambiguity');
  if (decisive === 'revert' || decisive === 'operator_redirect') {
    return result(decision, 'wrong', decisive, signals, evidence);
  }
  if (ambiguous) return result(decision, 'unknown', 'ambiguous_primary_executor', signals, evidence);
  if (decisive === 'alternate_executor') return result(decision, 'wrong', decisive, signals, evidence);
  if (decisive === 'clean_completion' && !ambiguous) {
    return result(decision, 'correct', decisive, signals, evidence);
  }
  return result(decision, 'unknown', 'no_matching_signal', signals, evidence);
}
