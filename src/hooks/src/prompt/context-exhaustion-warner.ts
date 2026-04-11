/**
 * Session Quality Governor — UserPromptSubmit Hook
 *
 * Multi-signal quality score injected into Claude's context on every turn.
 * Claude self-regulates behavior based on the grade — no user action needed.
 *
 * Signals:
 *   1. Context fill % (from StatusLine bridge temp file)
 *   2. Compaction count (from pre-compact-saver session state)
 *   3. Session age (from state file or session start timestamp)
 *   4. Decision density (from decisions.jsonl)
 *
 * Quality score: 0-100 with letter grades S/A/B/C/D/F
 * Behavioral modes: S-A normal, B efficiency, C conservation, D-F emergency
 *
 * + Threshold escalation warnings at 70/80/90% (preserved from v1)
 *
 * Performance budget: ~15ms (3 small file reads + arithmetic)
 * Token cost: ~30 tokens/turn (quality line) + ~50 at thresholds
 *
 * CC 2.1.9+: Uses hookSpecificOutput.additionalContext
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult, HookContext } from '../types.js';
import { outputSilentSuccess, getLogDir, getSessionId, getProjectDir } from '../lib/common.js';
import { getTempDir } from '../lib/paths.js';
import { sanitizeSessionId } from '../lib/sanitize-shell.js';
import { NOOP_CTX } from '../lib/context.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WarnTier {
  pct: number;
  level: 'NOTICE' | 'WARNING' | 'CRITICAL';
  message: string;
}

type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface QualityScore {
  score: number;
  grade: Grade;
  contextPct: number;
  compactions: number;
  ageMinutes: number;
  decisions: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIERS: WarnTier[] = [
  {
    pct: 90,
    level: 'CRITICAL',
    message: 'Context 90%+ full. Auto-compaction imminent. Commit ALL work NOW and create a handoff.',
  },
  {
    pct: 80,
    level: 'WARNING',
    message: 'Context 80%+ full. Wrap up current task. Commit intermediate progress.',
  },
  {
    pct: 70,
    level: 'NOTICE',
    message: 'Context 70%+ full. Consider saving progress with /ork:commit.',
  },
];

const BEHAVIORAL_DIRECTIVES: Record<string, string> = {
  C: '[Quality C — Conservation] Finish current task only. Do not start new work or launch new subagents. Commit when done. Suggest /compact if context > 60%.',
  D: '[Quality D — Emergency] STOP new work. Commit everything uncommitted. Create handoff with decisions and next steps. Suggest ending session.',
  F: '[Quality F — Critical] Session exhausted. Create emergency handoff. Refuse new tasks. Commit all pending work immediately.',
};

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let highestWarnedPct = 0;
/** Session start timestamp — set on first invocation */
let sessionStartMs = 0;

// ---------------------------------------------------------------------------
// Quality Score Computation
// ---------------------------------------------------------------------------

function computeFillPenalty(pct: number): number {
  if (pct > 85) return 25 + (pct - 85) * 1.5;
  if (pct > 70) return 10 + (pct - 70) * 1.0;
  if (pct > 50) return (pct - 50) * 0.5;
  return 0;
}

function toGrade(score: number): Grade {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

export function computeQualityScore(
  contextPct: number,
  compactions: number,
  ageMinutes: number,
  decisions: number,
): QualityScore {
  let score = 100;

  // Fill penalty: 0-47 points
  score -= computeFillPenalty(contextPct);

  // Compaction penalty: -8 per compaction (max 3 counted = -24)
  score -= Math.min(compactions, 3) * 8;

  // Age penalty: sessions degrade over time
  if (ageMinutes > 120) score -= 15;
  else if (ageMinutes > 60) score -= 10;
  else if (ageMinutes > 30) score -= 5;

  // Decision density bonus: productive sessions get a small boost
  if (ageMinutes > 0 && (decisions / (ageMinutes / 60)) > 3) score += 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    grade: toGrade(score),
    contextPct,
    compactions,
    ageMinutes: Math.round(ageMinutes),
    decisions,
  };
}

// ---------------------------------------------------------------------------
// Data Readers (all tolerant of missing files)
// ---------------------------------------------------------------------------

function getContextPctFilePath(sessionId: string): string {
  const safeId = sanitizeSessionId(sessionId);
  if (!safeId) return '';
  return join(getTempDir(), `ork-ctx-pct-${safeId}.txt`);
}

function readContextPercentage(sessionId: string): number | null {
  const filePath = getContextPctFilePath(sessionId);
  if (!filePath || !existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, 'utf8').trim();
    const pct = Math.round(parseFloat(content));
    if (Number.isNaN(pct) || pct < 0 || pct > 100) return null;
    return pct;
  } catch {
    return null;
  }
}

function readCompactionCount(): number {
  try {
    const sessionId = getSessionId();
    if (!sessionId) return 0;
    const logDir = getLogDir();
    const stateFile = join(logDir, 'sessions', `${sessionId}-state.json`);
    if (!existsSync(stateFile)) return 0;
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    return state.compactionCount || 0;
  } catch {
    return 0;
  }
}

function countDecisions(): number {
  try {
    const projectDir = getProjectDir();
    // Check both possible locations (memory/ is the real path, logs/ is legacy)
    const candidates = [
      join(projectDir, '.claude', 'memory', 'decisions.jsonl'),
      join(projectDir, '.claude', 'logs', 'decisions.jsonl'),
    ];
    for (const decisionFile of candidates) {
      if (existsSync(decisionFile)) {
        const content = readFileSync(decisionFile, 'utf8').trim();
        if (!content) continue;
        return content.split('\n').filter(Boolean).length;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

function getSessionAgeMinutes(): number {
  if (sessionStartMs === 0) {
    sessionStartMs = Date.now();
  }
  return (Date.now() - sessionStartMs) / 60000;
}

// ---------------------------------------------------------------------------
// Output Formatting
// ---------------------------------------------------------------------------

function formatQualityLine(q: QualityScore): string {
  const parts = [`Q:${q.score}/${q.grade}`, `${q.contextPct}% ctx`];
  if (q.compactions > 0) parts.push(`${q.compactions}C`);
  parts.push(`${q.ageMinutes}m`);
  parts.push(`${q.decisions} decisions`);
  return `[Session ${parts.join(' · ')}]`;
}

// ---------------------------------------------------------------------------
// Hook Implementation
// ---------------------------------------------------------------------------

export function contextExhaustionWarner(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const sessionId = input.session_id || ctx.sessionId;
  if (!sessionId) return outputSilentSuccess();

  const pct = readContextPercentage(sessionId);
  if (pct === null) return outputSilentSuccess(); // StatusLine hasn't written yet

  // Read additional signals (graceful on failure — defaults to 0)
  const compactions = readCompactionCount();
  const ageMinutes = getSessionAgeMinutes();
  const decisions = countDecisions();

  // Compute quality score
  const quality = computeQualityScore(pct, compactions, ageMinutes, decisions);

  // Always inject quality line (every turn)
  const parts: string[] = [formatQualityLine(quality)];

  // Reset escalation tracking if context dropped (after /compact or /clear)
  if (pct < 70 && highestWarnedPct > 0) {
    ctx.log('quality-governor', `Context dropped to ${pct}%, resetting escalation`);
    highestWarnedPct = 0;
  }

  // Threshold escalation warnings (preserved from v1 — escalation-only)
  if (pct >= 70) {
    const matchingTier = TIERS.find(t => pct >= t.pct);
    if (matchingTier && matchingTier.pct > highestWarnedPct) {
      highestWarnedPct = matchingTier.pct;
      ctx.log('quality-governor', `Context ${pct}% — ${matchingTier.level}, quality ${quality.grade} (${quality.score})`);
      parts.push(`[Context ${matchingTier.level}] ${matchingTier.message} Quality: ${quality.grade} (${quality.score}/100).`);
    }
  }

  // Behavioral directives at grade C/D/F
  const directive = BEHAVIORAL_DIRECTIVES[quality.grade];
  if (directive) {
    parts.push(directive);
  }

  return {
    continue: true,
    hookSpecificOutput: {
      additionalContext: parts.join('\n'),
    },
  };
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export {
  readContextPercentage,
  getContextPctFilePath,
  TIERS,
  toGrade,
  computeFillPenalty,
  readCompactionCount,
  countDecisions,
  getSessionAgeMinutes,
  formatQualityLine,
};

/**
 * Reset module state between tests.
 */
export function _resetForTesting(): void {
  highestWarnedPct = 0;
  sessionStartMs = 0;
}

/**
 * Set session start for testing.
 */
export function _setSessionStartForTesting(ms: number): void {
  sessionStartMs = ms;
}
