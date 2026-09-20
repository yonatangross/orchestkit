/**
 * Extract only structurally correlated weak-label events from Claude JSONL.
 *
 * This deliberately does not copy message text, tool inputs, outputs, or
 * timestamps. A transcript event is usable only when its UUID ancestry reaches
 * one unambiguous, main-chain user row carrying a promptId in the same session.
 */

const AUTO_ROUTERS = new Set(['Skill:ork:auto', 'Skill:hq-ext:auto']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function sessionId(row) {
  return nonEmptyString(row?.sessionId) ?? nonEmptyString(row?.session_id);
}

function uuid(row) {
  return nonEmptyString(row?.uuid);
}

function parentUuid(row) {
  return nonEmptyString(row?.parentUuid);
}

function promptId(row) {
  return nonEmptyString(row?.promptId) ?? nonEmptyString(row?.prompt_id);
}

function isMainChain(row) {
  return row?.isSidechain !== true;
}

function isUserPrompt(row) {
  return row?.type === 'user' && row?.message?.role === 'user' && promptId(row) !== null;
}

function sourceOf(record, index) {
  return nonEmptyString(record?.source) ?? `record:${index + 1}`;
}

function stableShape(row) {
  // The transcript may repeat a row with metadata additions, which is harmless.
  // A different parent, prompt root, or structural tool/result identity for one
  // UUID is not a valid graph. Never include tool arguments or message text.
  const tools = toolUses(row).map((block) => ({
    id: nonEmptyString(block.id),
    name: nonEmptyString(block.name),
    executor: canonicalExecutor(block),
  }));
  return JSON.stringify({
    session_id: sessionId(row),
    uuid: uuid(row),
    parent_uuid: parentUuid(row),
    type: row?.type,
    role: row?.message?.role,
    prompt_id: promptId(row),
    sidechain: row?.isSidechain === true,
    subtype: nonEmptyString(row?.subtype),
    source_tool_use_id: nonEmptyString(row?.sourceToolUseID),
    result_denied: nonEmptyString(row?.toolDenialKind) !== null,
    result_error: nonEmptyString(row?.error) !== null
      || (row?.toolUseResult && typeof row.toolUseResult === 'object' && row.toolUseResult.is_error === true),
    stop_prevented_continuation: row?.preventedContinuation === true
      ? true : row?.preventedContinuation === false ? false : null,
    stop_hook_errors_empty: Array.isArray(row?.hookErrors) ? row.hookErrors.length === 0 : null,
    tools,
  });
}

function toolUses(row) {
  const content = row?.message?.content;
  const blocks = Array.isArray(content) ? content : [content];
  return blocks.filter((block) => block && typeof block === 'object' && block.type === 'tool_use');
}

function canonicalExecutor(block) {
  if (block?.name === 'Skill') {
    const skill = nonEmptyString(block?.input?.skill);
    return skill ? `Skill:${skill}` : null;
  }
  if (block?.name === 'Agent') {
    const agent = nonEmptyString(block?.input?.subagent_type);
    return agent ? `Agent:${agent}` : null;
  }
  return null;
}

function resultState(row) {
  const denial = nonEmptyString(row?.toolDenialKind) !== null;
  const directError = nonEmptyString(row?.error) !== null;
  const result = row?.toolUseResult;
  const resultError = result && typeof result === 'object' && result.is_error === true;
  return {
    observed: true,
    denied: denial,
    error: directError || resultError,
  };
}

function rootKey(sid, root) {
  return `${sid}\u0000${root.root_id}\u0000${root.prompt_id}`;
}

function resultSummary(result) {
  if (!result) return { observed: false, denied: false, error: false, source_count: 0 };
  return {
    observed: result.observed,
    denied: result.denied,
    error: result.error,
    source_count: result.sources.length,
  };
}

/**
 * Return evidence-only events from raw Claude transcript objects.
 *
 * `executors` contains canonical names such as `Skill:ork:fix-issue` and
 * `Agent:ork-implementer`. Router invocations are never executor events.
 */
export function transcriptEvents(records, { executors = new Set() } = {}) {
  if (!Array.isArray(records)) return [];
  const allowedExecutors = executors instanceof Set ? executors : new Set(executors);
  const nodes = new Map();
  const conflicts = new Set();
  const usable = [];

  records.forEach((record, index) => {
    const row = record?.row;
    if (!row || typeof row !== 'object' || !isMainChain(row)) return;
    const sid = sessionId(row);
    const id = uuid(row);
    if (!sid || !id) {
      usable.push({ record, index, row, sid, id: null });
      return;
    }
    const key = `${sid}\u0000${id}`;
    const existing = nodes.get(key);
    if (existing && existing.shape !== stableShape(row)) conflicts.add(key);
    if (!existing) nodes.set(key, { row, record, index, shape: stableShape(row) });
    usable.push({ record, index, row, sid, id });
  });

  const ancestry = new Map();
  function rootFor(sid, id) {
    const key = `${sid}\u0000${id}`;
    if (ancestry.has(key)) return ancestry.get(key);
    const seen = new Set();
    let current = key;
    while (true) {
      if (seen.has(current) || conflicts.has(current)) {
        ancestry.set(key, null);
        return null;
      }
      seen.add(current);
      const node = nodes.get(current);
      if (!node) {
        ancestry.set(key, null);
        return null;
      }
      if (isUserPrompt(node.row)) {
        const root = { prompt_id: promptId(node.row), root_id: uuid(node.row) };
        ancestry.set(key, root);
        return root;
      }
      const parent = parentUuid(node.row);
      if (!parent) {
        ancestry.set(key, null);
        return null;
      }
      current = `${sid}\u0000${parent}`;
    }
  }

  // A sourceToolUseID can only bind within one exact prompt root. Reuse across
  // roots, or an unrooted result, is ambiguous and cannot create a primary label.
  const toolOwners = new Map();
  for (const item of usable) {
    if (!item.sid || !item.id || item.row?.type !== 'assistant') continue;
    const root = rootFor(item.sid, item.id);
    if (!root) continue;
    for (const block of toolUses(item.row)) {
      const toolUseId = nonEmptyString(block.id);
      if (!toolUseId) continue;
      const key = `${item.sid}\u0000${toolUseId}`;
      const owners = toolOwners.get(key) ?? new Set();
      owners.add(rootKey(item.sid, root));
      toolOwners.set(key, owners);
    }
  }

  const results = new Map();
  for (const item of usable) {
    const toolUseId = nonEmptyString(item.row?.sourceToolUseID);
    if (!item.sid || !item.id || !toolUseId) continue;
    const root = rootFor(item.sid, item.id);
    if (!root) continue;
    const key = `${item.sid}\u0000${toolUseId}`;
    const owner = rootKey(item.sid, root);
    const prior = results.get(key) ?? { owners: new Set(), by_owner: new Map() };
    prior.owners.add(owner);
    const stateForOwner = prior.by_owner.get(owner) ?? {
      observed: false, denied: false, error: false, sources: [],
    };
    const state = resultState(item.row);
    stateForOwner.observed ||= state.observed;
    stateForOwner.denied ||= state.denied;
    stateForOwner.error ||= state.error;
    stateForOwner.sources.push(sourceOf(item.record, item.index));
    prior.by_owner.set(owner, stateForOwner);
    results.set(key, prior);
  }

  const events = [];
  for (const item of usable) {
    if (!item.sid || !item.id || conflicts.has(`${item.sid}\u0000${item.id}`)) continue;
    const root = rootFor(item.sid, item.id);
    if (!root) continue;
    const source = sourceOf(item.record, item.index);

    if (item.row.type === 'assistant' && item.row.message?.role === 'assistant') {
      for (const block of toolUses(item.row)) {
        const executor = canonicalExecutor(block);
        const toolUseId = nonEmptyString(block.id);
        if (!executor || !toolUseId || AUTO_ROUTERS.has(executor)) continue;
        const resultKey = `${item.sid}\u0000${toolUseId}`;
        const owner = rootKey(item.sid, root);
        const ownerSet = toolOwners.get(resultKey) ?? new Set();
        const resultEntry = results.get(resultKey);
        const rootBound = ownerSet.size === 1 && ownerSet.has(owner)
          && resultEntry?.owners.size === 1 && resultEntry.owners.has(owner);
        const result = rootBound ? resultEntry.by_owner.get(owner) ?? null : null;
        const successful = result?.observed === true && result.denied === false && result.error === false;
        const primary = allowedExecutors.has(executor) && successful;
        events.push({
          type: 'executor',
          session_id: item.sid,
          prompt_id: root.prompt_id,
          executor,
          primary_handoff: primary,
          event_id: `${source}#tool:${toolUseId}`,
          evidence: {
            source,
            assistant_uuid: item.id,
            tool_use_id: toolUseId,
            result: resultSummary(result),
          },
        });
      }
    }

    if (item.row.type === 'system' && item.row.subtype === 'stop_hook_summary') {
      const clean = item.row.preventedContinuation === false
        && Array.isArray(item.row.hookErrors)
        && item.row.hookErrors.length === 0;
      events.push({
        type: 'stop',
        session_id: item.sid,
        prompt_id: root.prompt_id,
        clean,
        task_completed: false,
        event_id: `${source}#stop:${item.id}`,
        evidence: {
          source,
          stop_uuid: item.id,
          subtype: 'stop_hook_summary',
          prevented_continuation: item.row.preventedContinuation === true,
          hook_errors_empty: Array.isArray(item.row.hookErrors) && item.row.hookErrors.length === 0,
        },
      });
    }

    // Native transcript text and ad hoc fields never establish human intent.
    // Reviewed, normalized redirect events are accepted by the caller separately.
  }
  return events;
}
