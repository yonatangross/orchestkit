/**
 * Agent Attribution — Formatters
 * Issue #1195: Format ledger entries as commit trailers and PR markdown.
 */

import type { LedgerEntry } from './agent-attribution-types.js';
import { normalizeAgentName, formatDuration, getAgentIcon, STAGE_LABELS } from './agent-attribution-types.js';

/** Deduplicate entries by agent type — keep longest duration per agent. */
function dedup(entries: LedgerEntry[]): LedgerEntry[] {
  const byAgent = new Map<string, LedgerEntry>();
  for (const e of entries) {
    const existing = byAgent.get(e.agent);
    if (!existing || e.duration_ms > existing.duration_ms) byAgent.set(e.agent, e);
  }
  return Array.from(byAgent.values());
}

/** Format ledger entries as Co-Authored-By git trailers. */
export function formatAsTrailers(entries: LedgerEntry[]): string {
  return dedup(entries)
    .map(e => `Co-Authored-By: ork:${normalizeAgentName(e.agent)} <noreply@orchestkit.dev>`)
    .join('\n');
}

/** Format ledger entries as "Agents Involved:" commit section. */
export function formatAsAgentsSection(entries: LedgerEntry[]): string {
  const unique = dedup(entries);
  if (unique.length === 0) return '';
  const lines = unique.map(e => {
    const dur = formatDuration(e.duration_ms);
    return `  ${normalizeAgentName(e.agent)} \u2014 ${e.summary} (${dur})`;
  });
  return `Agents Involved:\n${lines.join('\n')}`;
}

/** Generate full PR attribution markdown (badges + roster + credits). */
export function formatAsPrMarkdown(entries: LedgerEntry[]): string {
  const unique = dedup(entries);
  if (unique.length === 0) return '';

  const parts: string[] = [];

  // Badges
  parts.push(`![Agents](https://img.shields.io/badge/agents-${unique.length}-blue?style=for-the-badge)`);
  const testAgent = unique.find(e => normalizeAgentName(e.agent) === 'test-generator');
  if (testAgent) {
    const tc = testAgent.summary.match(/\d+/)?.[0] || '?';
    parts.push(`![Tests](https://img.shields.io/badge/tests-${tc}-green?style=for-the-badge)`);
  }
  if (unique.find(e => normalizeAgentName(e.agent) === 'security-auditor')) {
    parts.push(`![Security](https://img.shields.io/badge/security-reviewed-brightgreen?style=for-the-badge)`);
  }
  parts.push('');

  // Orchestrator
  const orchestrators = [...new Set(unique.map(e => e.orchestrator).filter(Boolean))];
  if (orchestrators.length > 0) {
    parts.push(`> Orchestrated by: **${orchestrators.join('**, **')}**`);
    parts.push('');
  }

  // Team Roster
  parts.push('## Agent Team Sheet');
  parts.push('');
  parts.push('| Agent | Task | Stage | Time |');
  parts.push('|-------|------|-------|------|');
  for (const e of unique) {
    const icon = getAgentIcon(e.agent);
    const stage = STAGE_LABELS[e.stage] || 'Unknown';
    const name = normalizeAgentName(e.agent);
    const task = (e.prompt || e.summary || e.agent).slice(0, 80);
    parts.push(`| ${icon} **${name}** | ${task} | ${stage} | ${formatDuration(e.duration_ms)} |`);
  }
  parts.push('');

  // Credits Roll
  const lead = unique.filter(e => e.stage === 0);
  const parallel = unique.filter(e => e.stage === 1);
  const followUp = unique.filter(e => e.stage === 2);
  const totalDur = unique.reduce((s, e) => s + e.duration_ms, 0);

  parts.push('<details>');
  parts.push(`<summary><strong>\u{1f3ac} Agent Credits</strong> \u2014 ${unique.length} agents collaborated on this PR</summary>`);
  parts.push('');
  const renderGroup = (label: string, group: LedgerEntry[]) => {
    if (!group.length) return;
    parts.push(`**${label}**`);
    group.forEach(e => parts.push(`- ${getAgentIcon(e.agent)} **${normalizeAgentName(e.agent)}** \u2014 ${e.summary} (${formatDuration(e.duration_ms)})`));
    parts.push('');
  };
  renderGroup('Lead', lead);
  renderGroup('\u26a1 Parallel (ran simultaneously)', parallel);
  renderGroup('Follow-up', followUp);
  parts.push('---');
  parts.push(`<sub>Orchestrated by <a href="https://github.com/yonatangross/orchestkit">OrchestKit</a> \u2014 ${unique.length} agents, ${formatDuration(totalDur)} total</sub>`);
  parts.push('');
  parts.push('</details>');

  return parts.join('\n');
}
