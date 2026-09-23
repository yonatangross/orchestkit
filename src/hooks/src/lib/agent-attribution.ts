/**
 * Agent Attribution — Branch Activity Ledger
 * Issue #1195: Track which sub-agents contributed to each branch.
 *
 * Split into 3 files:
 *   - agent-attribution-types.ts  (types, constants, helpers)
 *   - agent-attribution.ts        (this file — core read/write/filter)
 *   - agent-attribution-format.ts (commit trailers, PR markdown)
 */

import { readFileSync, existsSync, readdirSync, unlinkSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { bufferWrite } from './analytics-buffer.js';
import { getCurrentBranch, gitExec } from './git.js';
import { getProjectDir } from './common.js';
import { acquireLock, atomicWriteSync, releaseLock } from './atomic-write.js';
import type { SessionState, LedgerEntry } from './agent-attribution-types.js';

// Re-export types and formatters for consumers
export type { LedgerEntry, SessionState } from './agent-attribution-types.js';
export { normalizeAgentName, formatDuration, getAgentIcon } from './agent-attribution-types.js';
export { formatAsTrailers, formatAsAgentsSection, formatAsPrMarkdown } from './agent-attribution-format.js';

// -----------------------------------------------------------------------------
// Session State — file-based, locked for concurrent access
// -----------------------------------------------------------------------------

function getStatePath(): string {
  return join(getProjectDir(), '.claude', 'agents', 'session-state.json');
}

function readSessionState(): SessionState {
  try {
    const path = getStatePath();
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  } catch { /* corrupt state — start fresh */ }
  return { commit_base: '', agent_counter: 0, agent_starts: {}, agent_types: {} };
}

/**
 * Read-modify-write session state while holding the file lock for the WHOLE
 * critical section, not just the write (sweep T1). Locking only the write
 * leaves the read outside: two parallel SubagentStart processes each read
 * stale state, and the last writer wins, silently dropping agent entries.
 */
export function updateSessionState(fn: (state: SessionState) => void): void {
  const path = getStatePath();
  const lockPath = `${path}.lock`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    if (!acquireLock(lockPath)) return;
    try {
      const state = readSessionState();
      fn(state);
      atomicWriteSync(path, JSON.stringify(state));
    } finally {
      releaseLock(lockPath);
    }
  } catch { /* attribution should never break hooks */ }
}

/**
 * Record agent start time + type (called from SubagentStart hook).
 *
 * `agentType` is staged here because the SubagentStop payload carries no
 * subagent_type for forks/background agents — SubagentStart fires before
 * SubagentStop for both, so this is the reliable capture point (#245).
 */
export function recordAgentStart(agentId: string, agentType?: string): void {
  updateSessionState((state) => {
    state.agent_starts[agentId] = Date.now();
    if (agentType) {
      state.agent_types ||= {};
      state.agent_types[agentId] = agentType;
    }
    if (!state.commit_base) {
      const head = gitExec(['rev-parse', 'HEAD']);
      if (head) state.commit_base = head;
    }
  });
}

/**
 * Get agent context and increment counter (called from SubagentStop hook).
 * Returns `type` when the SubagentStart hook staged it for this agent_id.
 */
export function resolveAgentContext(agentId: string): { startMs: number; counter: number; commitBase: string; type?: string } {
  let resolved: { startMs: number; counter: number; commitBase: string; type?: string } = {
    startMs: 0,
    counter: 0,
    commitBase: '',
    type: undefined,
  };
  updateSessionState((state) => {
    resolved = {
      startMs: state.agent_starts[agentId] || 0,
      counter: state.agent_counter,
      commitBase: state.commit_base,
      type: state.agent_types?.[agentId],
    };
    state.agent_counter = resolved.counter + 1;
    delete state.agent_starts[agentId];
    if (state.agent_types) delete state.agent_types[agentId];
  });
  return resolved;
}

// -----------------------------------------------------------------------------
// Ledger Path — allowlist-based sanitization
// -----------------------------------------------------------------------------

/** Sanitize branch name for filename. Uses allowlist for defense in depth. */
export function sanitizeBranch(branch: string): string {
  return branch
    .replace(/\.\./g, '_')             // strip traversal
    .replace(/\//g, '--')              // slashes to double-dash
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // allowlist: only safe chars
}

export function getLedgerPath(branch?: string): string {
  const b = branch || getCurrentBranch();
  return join(getProjectDir(), '.claude', 'agents', 'activity', `${sanitizeBranch(b)}.jsonl`);
}

// -----------------------------------------------------------------------------
// Write
// -----------------------------------------------------------------------------

export function appendLedgerEntry(entry: LedgerEntry): void {
  bufferWrite(getLedgerPath(), `${JSON.stringify(entry)}\n`);
}

// -----------------------------------------------------------------------------
// Read + Filter
// -----------------------------------------------------------------------------

export function readBranchLedger(branch?: string): LedgerEntry[] {
  const ledgerPath = getLedgerPath(branch);
  if (!existsSync(ledgerPath)) return [];
  try {
    return readFileSync(ledgerPath, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          const p = JSON.parse(line);
          if (!p.agent || !p.ts) return null; // validate required fields
          return p as LedgerEntry;
        } catch { return null; }
      })
      .filter((e): e is LedgerEntry => e !== null);
  } catch { return []; }
}

export function filterSinceCommit(entries: LedgerEntry[], commitSha: string): LedgerEntry[] {
  const commitTs = gitExec(['log', '-1', '--format=%cI', commitSha]);
  if (!commitTs) return entries;
  const cutoff = new Date(commitTs).getTime();
  return entries.filter(e => new Date(e.ts).getTime() > cutoff);
}

/** Filter by minimum duration. Only duration — success doesn't mean "produced changes". */
export function filterByThreshold(entries: LedgerEntry[], minDurationMs = 5000): LedgerEntry[] {
  return entries.filter(e => e.duration_ms >= minDurationMs);
}

export function deduplicateAgents(entries: LedgerEntry[]): LedgerEntry[] {
  const byAgent = new Map<string, LedgerEntry>();
  for (const e of entries) {
    const existing = byAgent.get(e.agent);
    if (!existing || e.duration_ms > existing.duration_ms) {
      byAgent.set(e.agent, e);
    }
  }
  return Array.from(byAgent.values());
}

// -----------------------------------------------------------------------------
// Cleanup — TTL-based only (branch name reversal is lossy)
// -----------------------------------------------------------------------------

export function cleanupStaleLedgers(): number {
  const activityDir = join(getProjectDir(), '.claude', 'agents', 'activity');
  if (!existsSync(activityDir)) return 0;
  let cleaned = 0;
  const TTL_MS = 30 * 24 * 60 * 60 * 1000;
  try {
    for (const file of readdirSync(activityDir)) {
      if (!file.endsWith('.jsonl')) continue;
      try {
        const filePath = join(activityDir, file);
        if (Date.now() - statSync(filePath).mtimeMs > TTL_MS) {
          unlinkSync(filePath);
          cleaned++;
        }
      } catch { /* ignore per-file errors */ }
    }
  } catch { /* ignore */ }
  return cleaned;
}
