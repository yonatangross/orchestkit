/**
 * Decision History Module
 *
 * Core functionality for parsing CHANGELOG.md, aggregating decisions from multiple sources,
 * and formatting output for CLI display and Mermaid diagrams.
 *
 * Issues: #203, #206, #207, #208
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getProjectDir, getPluginRoot } from './common.js';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Changelog section types (Keep a Changelog format)
 */
export type ChangelogSectionType =
  | 'Added'
  | 'Changed'
  | 'Fixed'
  | 'Deprecated'
  | 'Removed'
  | 'Security';

/**
 * Single entry within a changelog section
 */
export interface ChangelogEntry {
  text: string;
  category: string;
  impact: 'high' | 'medium' | 'low';
  ccReference?: string;
}

/**
 * A section within a changelog version (Added, Changed, Fixed, etc.)
 */
export interface ChangelogSection {
  type: ChangelogSectionType;
  entries: ChangelogEntry[];
}

/**
 * A version block from the changelog
 */
export interface ChangelogVersion {
  version: string;
  date: string;
  ccVersion?: string;
  sections: ChangelogSection[];
}

/**
 * Parsed changelog with metadata
 */
export interface ParsedChangelog {
  generatedAt: string;
  changelogHash: string;
  versions: ChangelogVersion[];
}

/**
 * Unified decision record from any source
 */
export interface Decision {
  id: string;
  date: string;
  summary: string;
  rationale?: string;
  ccVersion?: string;
  pluginVersion?: string;
  category: string;
  impact: 'high' | 'medium' | 'low';
  status: 'proposed' | 'implemented' | 'deprecated' | 'superseded';
  source: 'changelog' | 'session' | 'coordination' | 'mem0';
  bestPractice?: string;
  entities?: string[];
}

/**
 * Aggregated decisions with metadata
 */
export interface AggregatedDecisions {
  metadata: {
    totalDecisions: number;
    sources: Record<string, number>;
    lastAggregated: string;
  };
  decisions: Decision[];
}

// =============================================================================
// ANSI Colors for Terminal Output
// =============================================================================

export const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Hash a string using SHA-256
 */
export function hashString(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Detect decision category from entry text
 * Reused pattern from mem0-decision-saver
 */
export function detectDecisionCategory(text: string): string {
  const lowerText = text.toLowerCase();

  const categoryPatterns: [string, RegExp][] = [
    ['architecture', /\b(architecture|redesign|refactor|migration|modular|restructure)\b/],
    ['security', /\b(security|auth|permission|owasp|vulnerability|guardrail|safety)\b/],
    ['performance', /\b(performance|optimization|cache|bundle|speed|latency|throughput)\b/],
    ['testing', /\b(test|coverage|mock|e2e|integration|unit|validation)\b/],
    ['devops', /\b(ci\/cd|pipeline|deploy|docker|kubernetes|github.action|workflow)\b/],
    ['api', /\b(api|endpoint|rest|graphql|grpc|webhook|route)\b/],
    ['database', /\b(database|schema|migration|query|postgres|sqlalchemy|alembic)\b/],
    ['frontend', /\b(react|frontend|component|ui|ux|css|tailwind|vite)\b/],
    ['ai', /\b(ai|llm|rag|embedding|langraph|agent|mem0|mcp)\b/],
    ['hooks', /\b(hook|pretool|posttool|lifecycle|permission)\b/],
    ['skills', /\b(skill|skill\.md|knowledge|pattern)\b/],
    ['agents', /\b(agent|subagent|specialist|architect)\b/],
    ['documentation', /\b(doc|readme|changelog|claude\.md)\b/],
    ['bugfix', /\b(fix|bug|error|issue|broken|crash)\b/],
  ];

  for (const [category, pattern] of categoryPatterns) {
    if (pattern.test(lowerText)) {
      return category;
    }
  }

  return 'general';
}

/**
 * Detect impact level from entry text and section type
 */
export function detectImpact(text: string, sectionType: ChangelogSectionType): 'high' | 'medium' | 'low' {
  const lowerText = text.toLowerCase();

  // High impact indicators
  const highPatterns = [
    /\b(breaking|critical|major|complete|full|comprehensive|redesign|migration)\b/,
    /\b(security|vulnerability|authentication|authorization)\b/,
    /\b(architecture|infrastructure|core)\b/,
    /\*\*new/i, // Bold **New** features
    /^-\s*\*\*/,  // Bold entries
  ];

  for (const pattern of highPatterns) {
    if (pattern.test(lowerText) || pattern.test(text)) {
      return 'high';
    }
  }

  // Medium impact based on section type
  if (sectionType === 'Added' || sectionType === 'Security') {
    return 'medium';
  }

  // Low impact
  if (sectionType === 'Fixed' || sectionType === 'Deprecated') {
    const trivialPatterns = /\b(typo|cleanup|minor|small|doc|readme)\b/;
    if (trivialPatterns.test(lowerText)) {
      return 'low';
    }
    return 'medium';
  }

  return 'low';
}

/**
 * Extract CC version reference from text
 */
export function extractCCVersion(text: string): string | undefined {
  const match = text.match(/CC\s*(\d+\.\d+\.\d+)/i);
  return match?.[1];
}

/**
 * Generate a unique ID for a decision
 */
export function generateDecisionId(version: string, index: number, category: string): string {
  const slug = category.toLowerCase().replace(/\s+/g, '-');
  return `${version}-${slug}-${index}`;
}

// =============================================================================
// CHANGELOG Parser (#206)
// =============================================================================

/**
 * Parse CHANGELOG.md content into structured data
 */
export function parseChangelog(content: string): ParsedChangelog {
  const versions: ChangelogVersion[] = [];
  // Normalize CRLF to LF for cross-platform compatibility (Windows uses \r\n)
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  // Version header regex: ## [X.Y.Z] - YYYY-MM-DD
  const versionRegex = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/;
  // Section header regex: ### Added/Changed/Fixed/etc
  const sectionRegex = /^### (Added|Changed|Fixed|Deprecated|Removed|Security)/;

  let currentVersion: ChangelogVersion | null = null;
  let currentSection: ChangelogSection | null = null;

  for (const line of lines) {
    // Check for version header
    const versionMatch = line.match(versionRegex);
    if (versionMatch) {
      if (currentVersion) {
        versions.push(currentVersion);
      }
      currentVersion = {
        version: versionMatch[1],
        date: versionMatch[2],
        sections: [],
      };
      currentSection = null;
      continue;
    }

    // Check for section header
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch && currentVersion) {
      currentSection = {
        type: sectionMatch[1] as ChangelogSectionType,
        entries: [],
      };
      currentVersion.sections.push(currentSection);
      continue;
    }

    // Parse entry (lines starting with -)
    if (line.startsWith('- ') && currentSection && currentVersion) {
      const text = line.slice(2).trim();
      const ccVersion = extractCCVersion(text);

      // Detect CC version for this version block if found
      if (ccVersion && !currentVersion.ccVersion) {
        currentVersion.ccVersion = ccVersion;
      }

      currentSection.entries.push({
        text,
        category: detectDecisionCategory(text),
        impact: detectImpact(text, currentSection.type),
        ccReference: ccVersion,
      });
    }
  }

  // Don't forget the last version
  if (currentVersion) {
    versions.push(currentVersion);
  }

  return {
    generatedAt: new Date().toISOString(),
    changelogHash: hashString(content).slice(0, 16),
    versions,
  };
}

/**
 * Convert parsed changelog to unified Decision format
 */
export function changelogToDecisions(parsed: ParsedChangelog): Decision[] {
  const decisions: Decision[] = [];

  for (const version of parsed.versions) {
    let entryIndex = 0;

    for (const section of version.sections) {
      // Map section type to decision status
      const statusMap: Record<ChangelogSectionType, Decision['status']> = {
        Added: 'implemented',
        Changed: 'implemented',
        Fixed: 'implemented',
        Deprecated: 'deprecated',
        Removed: 'superseded',
        Security: 'implemented',
      };

      for (const entry of section.entries) {
        entryIndex++;
        decisions.push({
          id: generateDecisionId(version.version, entryIndex, entry.category),
          date: version.date,
          summary: entry.text.slice(0, 100) + (entry.text.length > 100 ? '...' : ''),
          rationale: entry.text,
          ccVersion: version.ccVersion || entry.ccReference,
          pluginVersion: version.version,
          category: entry.category,
          impact: entry.impact,
          status: statusMap[section.type],
          source: 'changelog',
        });
      }
    }
  }

  return decisions;
}

// =============================================================================
// Decision Aggregator (#207)
// =============================================================================

/**
 * Load session decisions from active.json
 */
export function loadSessionDecisions(): Decision[] {
  const projectDir = getProjectDir();
  const sessionFile = `${projectDir}/.claude/context/knowledge/decisions/active.json`;

  if (!existsSync(sessionFile)) {
    return [];
  }

  try {
    const content = JSON.parse(readFileSync(sessionFile, 'utf-8'));
    const decisions: Decision[] = [];

    // Handle array format
    if (Array.isArray(content)) {
      for (const item of content) {
        decisions.push({
          id: item.id || `session-${Date.now()}`,
          date: item.date || new Date().toISOString().slice(0, 10),
          summary: item.summary || item.decision || '',
          rationale: item.rationale || item.context,
          ccVersion: item.cc_version || item.ccVersion,
          pluginVersion: item.plugin_version || item.pluginVersion,
          category: item.category || detectDecisionCategory(item.summary || ''),
          impact: item.impact || 'medium',
          status: item.status || 'implemented',
          source: 'session',
          bestPractice: item.best_practice || item.bestPractice,
          entities: item.entities,
        });
      }
    }

    return decisions;
  } catch {
    return [];
  }
}

/**
 * Load coordination decisions from decision-log.json
 */
export function loadCoordinationDecisions(): Decision[] {
  const projectDir = getProjectDir();
  const coordFile = `${projectDir}/.claude/coordination/decision-log.json`;

  if (!existsSync(coordFile)) {
    return [];
  }

  try {
    const content = JSON.parse(readFileSync(coordFile, 'utf-8'));
    const decisions: Decision[] = [];

    // Handle decisions array
    const items = content.decisions || content;
    if (Array.isArray(items)) {
      for (const item of items) {
        decisions.push({
          id: item.id || `coord-${Date.now()}`,
          date: item.timestamp?.slice(0, 10) || item.date || new Date().toISOString().slice(0, 10),
          summary: item.decision || item.summary || '',
          rationale: item.rationale || item.context,
          category: item.category || detectDecisionCategory(item.decision || ''),
          impact: item.impact || 'medium',
          status: 'implemented',
          source: 'coordination',
        });
      }
    }

    return decisions;
  } catch {
    return [];
  }
}

/**
 * Load changelog decisions (with caching)
 */
export function loadChangelogDecisions(): Decision[] {
  const pluginRoot = getPluginRoot();
  const cacheFile = `${getProjectDir()}/.claude/feedback/changelog-decisions.json`;
  const changelogFile = `${pluginRoot}/CHANGELOG.md`;

  if (!existsSync(changelogFile)) {
    return [];
  }

  try {
    const changelogContent = readFileSync(changelogFile, 'utf-8');
    const currentHash = hashString(changelogContent).slice(0, 16);

    // Check cache validity
    if (existsSync(cacheFile)) {
      const cached = JSON.parse(readFileSync(cacheFile, 'utf-8'));
      if (cached.changelogHash === currentHash) {
        return cached.decisions || [];
      }
    }

    // Parse and cache
    const parsed = parseChangelog(changelogContent);
    const decisions = changelogToDecisions(parsed);

    // Write cache
    const cacheDir = `${getProjectDir()}/.claude/feedback`;
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    writeFileSync(
      cacheFile,
      JSON.stringify({ ...parsed, decisions }, null, 2)
    );

    return decisions;
  } catch {
    return [];
  }
}

/**
 * Deduplicate decisions by ID
 */
export function deduplicateById(decisions: Decision[]): Decision[] {
  const seen = new Map<string, Decision>();

  for (const d of decisions) {
    // Prefer non-changelog sources for same ID (they have more context)
    if (!seen.has(d.id) || d.source !== 'changelog') {
      seen.set(d.id, d);
    }
  }

  return Array.from(seen.values());
}

/**
 * Aggregate decisions from all sources
 */
export async function aggregateDecisions(): Promise<AggregatedDecisions> {
  const decisions: Decision[] = [];
  const sources: Record<string, number> = {};

  // 1. Load session decisions (highest priority)
  const sessionDecisions = loadSessionDecisions();
  decisions.push(...sessionDecisions);
  sources.session = sessionDecisions.length;

  // 2. Load changelog decisions
  const changelogDecisions = loadChangelogDecisions();
  decisions.push(...changelogDecisions);
  sources.changelog = changelogDecisions.length;

  // 3. Load coordination decisions
  const coordDecisions = loadCoordinationDecisions();
  decisions.push(...coordDecisions);
  sources.coordination = coordDecisions.length;

  // Deduplicate by ID, sort by date descending
  const uniqueDecisions = deduplicateById(decisions);
  const sortedDecisions = uniqueDecisions.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return {
    metadata: {
      totalDecisions: sortedDecisions.length,
      sources,
      lastAggregated: new Date().toISOString(),
    },
    decisions: sortedDecisions,
  };
}

// =============================================================================
// Formatters (#208)
// =============================================================================

/**
 * Group decisions by a field
 */
export function groupDecisions(
  decisions: Decision[],
  groupBy: string = 'cc_version'
): Record<string, Decision[]> {
  const grouped: Record<string, Decision[]> = {};

  for (const d of decisions) {
    let key: string;

    switch (groupBy) {
      case 'cc_version':
        key = d.ccVersion || 'Unknown';
        break;
      case 'category':
        key = d.category;
        break;
      case 'month':
        key = d.date.slice(0, 7); // YYYY-MM
        break;
      case 'plugin_version':
        key = d.pluginVersion || 'Unknown';
        break;
      default:
        key = d.ccVersion || 'Unknown';
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(d);
  }

  return grouped;
}

/**
 * Format decisions as ASCII table
 */
export function formatTable(decisions: Decision[], limit: number = 20): string {
  const header = `${COLORS.bold}
┌────────────┬──────────┬────────────────────────────────────────────┬────────────┐
│ Date       │ CC Ver   │ Summary                                    │ Category   │
├────────────┼──────────┼────────────────────────────────────────────┼────────────┤${COLORS.reset}`;

  const rows = decisions.slice(0, limit).map((d) => {
    const date = d.date.slice(0, 10).padEnd(10);
    const ccVer = (d.ccVersion || '?').padEnd(8);
    const summary = d.summary.slice(0, 42).padEnd(42);
    const category = d.category.slice(0, 10).padEnd(10);

    return `│ ${date} │ ${ccVer} │ ${summary} │ ${category} │`;
  });

  const footer = `${COLORS.dim}└────────────┴──────────┴────────────────────────────────────────────┴────────────┘${COLORS.reset}`;

  const remaining = decisions.length - limit;
  const remainingNote =
    remaining > 0 ? `\n${COLORS.dim}... and ${remaining} more decisions${COLORS.reset}` : '';

  return `${header}\n${rows.join('\n')}\n${footer}${remainingNote}`;
}

/**
 * Format decisions as ASCII timeline
 */
export function formatTimeline(
  decisions: Decision[],
  groupBy: string = 'cc_version'
): string {
  const grouped = groupDecisions(decisions, groupBy);

  let output = `\n${COLORS.bold}Decision History Timeline${COLORS.reset}\n`;
  output += '═'.repeat(60) + '\n\n';

  // Sort groups by most recent date in each group
  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    const aDate = a[1][0]?.date || '';
    const bDate = b[1][0]?.date || '';
    return bDate.localeCompare(aDate);
  });

  for (const [group, items] of sortedGroups) {
    const label = groupBy === 'cc_version' ? `CC ${group}` : group;
    output += `${COLORS.cyan}${label}${COLORS.reset}\n`;

    for (const d of items.slice(0, 5)) {
      const dateStr = d.date.slice(0, 10);
      const summaryStr = d.summary.slice(0, 40);
      const impactColor =
        d.impact === 'high' ? COLORS.red : d.impact === 'medium' ? COLORS.yellow : COLORS.dim;

      output += `  ├── ${COLORS.dim}${dateStr}${COLORS.reset} ── ${summaryStr}\n`;
      output += `  │   ${impactColor}${d.impact.toUpperCase()}${COLORS.reset} │ ${d.category}\n`;
    }

    if (items.length > 5) {
      output += `  └── ${COLORS.dim}... and ${items.length - 5} more${COLORS.reset}\n`;
    }
    output += '\n';
  }

  return output;
}

/**
 * Format statistics summary
 */
export function formatStats(aggregated: AggregatedDecisions): string {
  const { metadata, decisions } = aggregated;

  // Count by category
  const byCategory: Record<string, number> = {};
  const byCCVersion: Record<string, number> = {};
  const byImpact = { high: 0, medium: 0, low: 0 };
  const bySource: Record<string, number> = {};

  for (const d of decisions) {
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
    if (d.ccVersion) {
      byCCVersion[d.ccVersion] = (byCCVersion[d.ccVersion] || 0) + 1;
    }
    byImpact[d.impact]++;
    bySource[d.source] = (bySource[d.source] || 0) + 1;
  }

  return `
${COLORS.bold}═══════════════════════════════════════════════════════
                  Decision History Statistics
═══════════════════════════════════════════════════════${COLORS.reset}

${COLORS.cyan}Overview${COLORS.reset}
  Total Decisions: ${metadata.totalDecisions}
  Last Aggregated: ${metadata.lastAggregated.slice(0, 19)}

${COLORS.cyan}By Source${COLORS.reset}
${Object.entries(bySource)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `  ${k}: ${v}`)
  .join('\n')}

${COLORS.cyan}By Impact${COLORS.reset}
  ${COLORS.red}high${COLORS.reset}: ${byImpact.high}
  ${COLORS.yellow}medium${COLORS.reset}: ${byImpact.medium}
  ${COLORS.dim}low${COLORS.reset}: ${byImpact.low}

${COLORS.cyan}By Category (top 10)${COLORS.reset}
${Object.entries(byCategory)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([k, v]) => `  ${k}: ${v}`)
  .join('\n')}

${COLORS.cyan}By CC Version${COLORS.reset}
${Object.entries(byCCVersion)
  .sort((a, b) => b[0].localeCompare(a[0]))
  .slice(0, 8)
  .map(([k, v]) => `  ${k}: ${v}`)
  .join('\n')}
`;
}

/**
 * Format single decision details
 */
export function formatDecisionDetail(decision: Decision): string {
  const impactColor =
    decision.impact === 'high'
      ? COLORS.red
      : decision.impact === 'medium'
        ? COLORS.yellow
        : COLORS.dim;

  return `
${COLORS.bold}═══════════════════════════════════════════════════════
Decision: ${decision.id}
═══════════════════════════════════════════════════════${COLORS.reset}

${COLORS.cyan}Summary${COLORS.reset}
${decision.summary}

${COLORS.cyan}Details${COLORS.reset}
  Date:           ${decision.date}
  Category:       ${decision.category}
  Impact:         ${impactColor}${decision.impact.toUpperCase()}${COLORS.reset}
  Status:         ${decision.status}
  Source:         ${decision.source}
  CC Version:     ${decision.ccVersion || 'N/A'}
  Plugin Version: ${decision.pluginVersion || 'N/A'}

${decision.rationale ? `${COLORS.cyan}Rationale${COLORS.reset}\n${decision.rationale}\n` : ''}
${decision.bestPractice ? `${COLORS.cyan}Best Practice${COLORS.reset}\n${decision.bestPractice}\n` : ''}
${decision.entities?.length ? `${COLORS.cyan}Related Entities${COLORS.reset}\n${decision.entities.join(', ')}\n` : ''}
`;
}

// =============================================================================
// Mermaid Generator (#203)
// =============================================================================

/**
 * Sanitize text for Mermaid diagram compatibility
 * Mermaid timeline has strict syntax - colons, brackets, and special chars break parsing
 */
function sanitizeMermaidText(text: string, maxLength: number = 30): string {
  return text
    .slice(0, maxLength)
    // Remove markdown formatting
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    // Remove quotes (can break Mermaid parsing)
    .replace(/["']/g, '')
    // Replace colons with dashes (colon is Mermaid delimiter)
    .replace(/:/g, '-')
    // Remove brackets and special chars that break Mermaid
    .replace(/[[\]{}()|#<>&;\\]/g, '')
    // Remove leading slashes (for commands like /ork-doctor)
    .replace(/^\/+/, '')
    // Replace multiple spaces/dashes with single
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    // Remove leading/trailing dashes and spaces
    .replace(/^[-\s]+|[-\s]+$/g, '')
    .trim();
}

/**
 * Format decisions as Mermaid timeline diagram
 */
export function formatMermaid(
  decisions: Decision[],
  groupBy: string = 'cc_version'
): string {
  const grouped = groupDecisions(decisions, groupBy);

  let output = '```mermaid\ntimeline\n';
  output += '    title OrchestKit Evolution with Claude Code\n';

  // Sort versions descending
  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    const aDate = a[1][0]?.date || '';
    const bDate = b[1][0]?.date || '';
    return bDate.localeCompare(aDate);
  });

  for (const [group, items] of sortedGroups.slice(0, 10)) {
    // Sanitize section label
    const label = groupBy === 'cc_version' ? `CC ${group}` : sanitizeMermaidText(group, 20);
    output += `    section ${label}\n`;

    // Take top 3 high-impact decisions per group
    const topItems = items
      .filter((d) => d.impact === 'high' || d.impact === 'medium')
      .slice(0, 3);

    for (const d of topItems) {
      // Sanitize summary and category for Mermaid
      const summary = sanitizeMermaidText(d.summary, 30);
      const category = sanitizeMermaidText(d.category, 15);

      // Only add if we have valid content after sanitization
      if (summary.length > 0) {
        output += `        ${summary} : ${category}\n`;
      }
    }
  }

  output += '```';
  return output;
}

/**
 * Validate Mermaid diagram using mermaid.ink API
 * Returns true if diagram is valid, false otherwise
 * Note: Requires network access to mermaid.ink
 */
export async function validateMermaidViaAPI(mermaidCode: string): Promise<boolean> {
  try {
    // Remove markdown code fences if present
    const code = mermaidCode
      .replace(/^```mermaid\n?/, '')
      .replace(/\n?```$/, '');

    // Encode as base64 for mermaid.ink API
    const base64 = Buffer.from(code).toString('base64');

    // Fetch SVG from mermaid.ink
    const response = await fetch(`https://mermaid.ink/svg/${base64}`);
    const text = await response.text();

    // Valid diagrams return SVG, invalid return error HTML
    return text.includes('<svg');
  } catch {
    // Network error or other issue - assume valid to not block
    return true;
  }
}

/**
 * Generate full Mermaid document with multiple diagrams
 */
export function generateMermaidDocument(decisions: Decision[]): string {
  let doc = '# OrchestKit Decision History\n\n';
  doc += `Generated: ${new Date().toISOString().slice(0, 19)}\n\n`;

  // Timeline by CC version
  doc += '## Evolution Timeline (by CC Version)\n\n';
  doc += formatMermaid(decisions, 'cc_version');
  doc += '\n\n';

  // Timeline by category
  doc += '## Architecture Decisions (by Category)\n\n';
  doc += formatMermaid(decisions, 'category');
  doc += '\n\n';

  // Stats summary
  const stats = {
    total: decisions.length,
    high: decisions.filter((d) => d.impact === 'high').length,
    categories: Array.from(new Set(decisions.map((d) => d.category))).length,
    ccVersions: Array.from(new Set(decisions.map((d) => d.ccVersion).filter(Boolean))).length,
  };

  doc += '## Summary Statistics\n\n';
  doc += `| Metric | Value |\n`;
  doc += `|--------|-------|\n`;
  doc += `| Total Decisions | ${stats.total} |\n`;
  doc += `| High Impact | ${stats.high} |\n`;
  doc += `| Categories | ${stats.categories} |\n`;
  doc += `| CC Versions | ${stats.ccVersions} |\n`;

  return doc;
}

// =============================================================================
// Filter Functions
// =============================================================================

export interface FilterOptions {
  ccVersion?: string;
  category?: string;
  days?: number;
  impact?: 'high' | 'medium' | 'low';
  source?: string;
  limit?: number;
}

/**
 * Filter decisions based on criteria
 */
export function filterDecisions(
  decisions: Decision[],
  options: FilterOptions
): Decision[] {
  let filtered = decisions;

  if (options.ccVersion) {
    filtered = filtered.filter((d) => d.ccVersion === options.ccVersion);
  }

  if (options.category) {
    filtered = filtered.filter((d) =>
      d.category.toLowerCase().includes(options.category!.toLowerCase())
    );
  }

  if (options.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - options.days);
    filtered = filtered.filter((d) => new Date(d.date) >= cutoff);
  }

  if (options.impact) {
    filtered = filtered.filter((d) => d.impact === options.impact);
  }

  if (options.source) {
    filtered = filtered.filter((d) => d.source === options.source);
  }

  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Search decisions by text query
 */
export function searchDecisions(decisions: Decision[], query: string): Decision[] {
  const lowerQuery = query.toLowerCase();

  return decisions.filter(
    (d) =>
      d.summary.toLowerCase().includes(lowerQuery) ||
      d.rationale?.toLowerCase().includes(lowerQuery) ||
      d.category.toLowerCase().includes(lowerQuery) ||
      d.id.toLowerCase().includes(lowerQuery)
  );
}
