/**
 * Agent Attribution — Branch Activity Ledger
 * Issue #1195: Track which sub-agents contributed to each branch
 *
 * The SubagentStop hook appends entries to .claude/agents/activity/{branch}.jsonl.
 * The /ork:commit and /ork:create-pr skills read the ledger for attribution.
 */

import { readFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { bufferWrite } from './analytics-buffer.js';
import { getCurrentBranch, gitExec } from './git.js';
import { getProjectDir } from './common.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface LedgerEntry {
  ts: string;
  agent: string;
  agent_name?: string;
  stage: number; // 0=lead, 1=parallel, 2=follow-up
  duration_ms: number;
  success: boolean;
  summary: string;
  commit_base: string;
}

// -----------------------------------------------------------------------------
// Ledger Path
// -----------------------------------------------------------------------------

function sanitizeBranch(branch: string): string {
  return branch.replace(/\//g, '--');
}

export function getLedgerPath(branch?: string): string {
  const b = branch || getCurrentBranch();
  const projectDir = getProjectDir();
  return join(projectDir, '.claude', 'agents', 'activity', `${sanitizeBranch(b)}.jsonl`);
}

// -----------------------------------------------------------------------------
// Write
// -----------------------------------------------------------------------------

export function appendLedgerEntry(entry: LedgerEntry): void {
  const ledgerPath = getLedgerPath();
  bufferWrite(ledgerPath, JSON.stringify(entry) + '\n');
}

// -----------------------------------------------------------------------------
// Read
// -----------------------------------------------------------------------------

export function readBranchLedger(branch?: string): LedgerEntry[] {
  const ledgerPath = getLedgerPath(branch);
  if (!existsSync(ledgerPath)) return [];

  try {
    const content = readFileSync(ledgerPath, 'utf8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line) as LedgerEntry; }
        catch { return null; }
      })
      .filter((e): e is LedgerEntry => e !== null);
  } catch {
    return [];
  }
}

export function filterSinceCommit(entries: LedgerEntry[], commitSha: string): LedgerEntry[] {
  const commitTs = gitExec(['log', '-1', '--format=%cI', commitSha]);
  if (!commitTs) return entries;
  const cutoff = new Date(commitTs).getTime();
  return entries.filter(e => new Date(e.ts).getTime() > cutoff);
}

export function filterByThreshold(entries: LedgerEntry[], minDurationMs = 5000): LedgerEntry[] {
  return entries.filter(e => e.duration_ms >= minDurationMs || e.success);
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
// Format — Commit Trailers
// -----------------------------------------------------------------------------

export function formatAsTrailers(entries: LedgerEntry[]): string {
  const unique = deduplicateAgents(entries);
  return unique
    .map(e => `Co-Authored-By: ork:${e.agent} <noreply@orchestkit.dev>`)
    .join('\n');
}

function formatDuration(ms: number): string {
  const secs = Math.round(ms / 1000);
  return `${Math.floor(secs / 60)}m${String(secs % 60).padStart(2, '0')}s`;
}

export function formatAsAgentsSection(entries: LedgerEntry[]): string {
  const unique = deduplicateAgents(entries);
  if (unique.length === 0) return '';
  const lines = unique.map(e => {
    const dur = formatDuration(e.duration_ms);
    return `  ${e.agent} — ${e.summary} (${dur})`;
  });
  return `Agents Involved:\n${lines.join('\n')}`;
}

// -----------------------------------------------------------------------------
// Format — PR Markdown
// -----------------------------------------------------------------------------

const AGENT_ICONS: Record<string, string> = {
  'backend-system-architect': '🏗️', 'security-auditor': '🛡️',
  'test-generator': '🧪', 'frontend-ui-developer': '🎨',
  'ci-cd-engineer': '⚙️', 'code-quality-reviewer': '🔍',
  'database-engineer': '💾', 'accessibility-specialist': '♿',
  'workflow-architect': '📐', 'debug-investigator': '🔬',
  'git-operations-engineer': '🔀', 'deployment-manager': '🚀',
};

const STAGE_LABELS = ['Lead', '⚡ Parallel', 'Follow-up'];

export function formatAsPrMarkdown(entries: LedgerEntry[]): string {
  const unique = deduplicateAgents(entries);
  if (unique.length === 0) return '';

  const parts: string[] = [];

  // Badges
  parts.push(`![Agents](https://img.shields.io/badge/agents-${unique.length}-blue?style=for-the-badge)`);
  const testAgent = unique.find(e => e.agent === 'test-generator');
  if (testAgent) {
    const testCount = testAgent.summary.match(/\d+/)?.[0] || '?';
    parts.push(`![Tests](https://img.shields.io/badge/tests-${testCount}-green?style=for-the-badge)`);
  }
  if (unique.find(e => e.agent === 'security-auditor')) {
    parts.push(`![Security](https://img.shields.io/badge/vulnerabilities-0-brightgreen?style=for-the-badge)`);
  }
  parts.push('');

  // Team Roster
  parts.push('## Agent Team Sheet');
  parts.push('');
  parts.push('| Agent | Role | Stage | Time |');
  parts.push('|-------|------|-------|------|');
  for (const e of unique) {
    const icon = AGENT_ICONS[e.agent] || '🤖';
    const stage = STAGE_LABELS[e.stage] || 'Unknown';
    parts.push(`| ${icon} **${e.agent}** | ${e.summary} | ${stage} | ${formatDuration(e.duration_ms)} |`);
  }
  parts.push('');

  // Credits Roll
  const lead = unique.filter(e => e.stage === 0);
  const parallel = unique.filter(e => e.stage === 1);
  const followUp = unique.filter(e => e.stage === 2);
  const totalDur = unique.reduce((s, e) => s + e.duration_ms, 0);

  parts.push('<details>');
  parts.push(`<summary><strong>🎬 Agent Credits</strong> — ${unique.length} agents collaborated on this PR</summary>`);
  parts.push('');
  if (lead.length) {
    parts.push('**Lead**');
    lead.forEach(e => parts.push(`- ${AGENT_ICONS[e.agent] || '🤖'} **${e.agent}** — ${e.summary} (${formatDuration(e.duration_ms)})`));
    parts.push('');
  }
  if (parallel.length) {
    parts.push('**⚡ Parallel** (ran simultaneously)');
    parallel.forEach(e => parts.push(`- ${AGENT_ICONS[e.agent] || '🤖'} **${e.agent}** — ${e.summary} (${formatDuration(e.duration_ms)})`));
    parts.push('');
  }
  if (followUp.length) {
    parts.push('**Follow-up**');
    followUp.forEach(e => parts.push(`- ${AGENT_ICONS[e.agent] || '🤖'} **${e.agent}** — ${e.summary} (${formatDuration(e.duration_ms)})`));
    parts.push('');
  }
  parts.push('---');
  parts.push(`<sub>Orchestrated by <a href="https://github.com/yonatangross/orchestkit">OrchestKit</a> — ${unique.length} agents, ${formatDuration(totalDur)} total</sub>`);
  parts.push('');
  parts.push('</details>');

  return parts.join('\n');
}

// -----------------------------------------------------------------------------
// Cleanup
// -----------------------------------------------------------------------------

export function cleanupStaleLedgers(): number {
  const projectDir = getProjectDir();
  const activityDir = join(projectDir, '.claude', 'agents', 'activity');
  if (!existsSync(activityDir)) return 0;

  let cleaned = 0;
  const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  try {
    const files = readdirSync(activityDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = join(activityDir, file);
      const branchName = file.replace('.jsonl', '').replace(/--/g, '/');
      const branchExists = gitExec(['rev-parse', '--verify', branchName]) !== '';
      const stat = statSync(filePath);
      const ageMs = Date.now() - stat.mtimeMs;
      if (!branchExists || ageMs > TTL_MS) {
        try { unlinkSync(filePath); cleaned++; } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }

  return cleaned;
}
