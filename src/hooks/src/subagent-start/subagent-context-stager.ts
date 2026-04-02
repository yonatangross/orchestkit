/**
 * Subagent Context Stager - SubagentStart Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * This hook:
 * 1. Checks if there are active todos from session state
 * 2. Stages relevant context files based on the task description
 * 3. Returns systemMessage with staged context
 *
 * Version: 1.0.0 (TypeScript port)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir, getPluginRoot } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Path Helpers
// -----------------------------------------------------------------------------

function getSessionState(): string {
  return `${getProjectDir()}/.claude/context/session/state.json`;
}

function getDecisionsFile(): string {
  return `${getProjectDir()}/.claude/context/knowledge/decisions/active.json`;
}

function getIssueDir(): string {
  return `${getProjectDir()}/docs/issues`;
}

// -----------------------------------------------------------------------------
// Context Extraction Functions
// -----------------------------------------------------------------------------

interface SessionState {
  tasks_pending?: string[];
  [key: string]: unknown;
}

interface DecisionsFile {
  decisions?: Array<{
    category?: string;
    title?: string;
    status?: string;
  }>;
}

function extractPendingTasks(): { count: number; summary: string } {
  const sessionState = getSessionState();
  if (!existsSync(sessionState)) {
    return { count: 0, summary: '' };
  }

  try {
    const state: SessionState = JSON.parse(readFileSync(sessionState, 'utf8'));
    const tasksPending = state.tasks_pending || [];
    const count = tasksPending.length;

    if (count === 0) {
      return { count: 0, summary: '' };
    }

    const summary = tasksPending.slice(0, 5).map((t) => `- ${t}`).join('\n');
    return { count, summary };
  } catch {
    return { count: 0, summary: '' };
  }
}

function extractRelevantDecisions(_taskDescription: string, category: string): string {
  const decisionsFile = getDecisionsFile();
  if (!existsSync(decisionsFile)) {
    return '';
  }

  try {
    const data: DecisionsFile = JSON.parse(readFileSync(decisionsFile, 'utf8'));
    const decisions = data.decisions || [];

    const relevantDecisions = decisions
      .filter((d) => d.category === category || d.category === 'api' || d.category === 'database')
      .slice(0, 8)
      .map((d) => `- ${d.title} (${d.status || 'unknown'})`);

    return relevantDecisions.join('\n');
  } catch {
    return '';
  }
}

function findIssueDoc(issueNum: string): string {
  const issueDir = getIssueDir();
  if (!existsSync(issueDir)) {
    return '';
  }

  try {
    const entries = readdirSync(issueDir);
    const match = entries.find((entry) => entry.includes(issueNum));
    if (match) {
      return `docs/issues/${match}`;
    }
  } catch {
    // Ignore
  }
  return '';
}

// -----------------------------------------------------------------------------
// Critical Rules Extraction
// -----------------------------------------------------------------------------

/**
 * Extract condensed critical rules from global and project CLAUDE.md files.
 * Sub-agents don't inherit ~/.claude/CLAUDE.md from the CC runtime,
 * so we inject key rules via systemMessage to prevent drift.
 *
 * Budget: ~150 tokens max — enough for guardrails, not a full CLAUDE.md copy.
 */
function extractCriticalRules(): string {
  const rules: string[] = [];

  // Read global CLAUDE.md (~/.claude/CLAUDE.md)
  const globalPath = join(homedir(), '.claude', 'CLAUDE.md');
  const globalRules = safeReadFile(globalPath);
  if (globalRules) {
    // Extract bullet points and key directives
    const extracted = extractRulesFromMarkdown(globalRules, 'global');
    rules.push(...extracted);
  }

  // Read project CLAUDE.md
  const projectPath = join(getProjectDir(), 'CLAUDE.md');
  const projectRules = safeReadFile(projectPath);
  if (projectRules) {
    const extracted = extractRulesFromMarkdown(projectRules, 'project');
    rules.push(...extracted);
  }

  if (rules.length === 0) return '';

  // Deduplicate and cap at 12 rules (~150 tokens)
  const unique = [...new Set(rules)].slice(0, 12);
  return `CRITICAL RULES (inherited from CLAUDE.md):\n${unique.map(r => `- ${r}`).join('\n')}\n\n`;
}

function safeReadFile(filePath: string): string {
  try {
    if (!existsSync(filePath)) return '';
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Extract actionable rules from markdown content.
 * Looks for: bullet points with imperative verbs, DO/DON'T blocks,
 * and lines containing "always", "never", "must".
 */
function extractRulesFromMarkdown(content: string, _source: string): string[] {
  const rules: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip headers, empty lines, code blocks
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```')) continue;

    // Match bullet points with strong directives
    if (/^[-*]\s+/.test(trimmed)) {
      const bullet = trimmed.replace(/^[-*]\s+/, '').trim();

      // Only keep rules with imperative/directive language
      if (/\b(always|never|must|don't|do not|required|NEVER|MUST|DON'T)\b/i.test(bullet)) {
        // Truncate long rules to ~80 chars
        const truncated = bullet.length > 80 ? `${bullet.substring(0, 77)}...` : bullet;
        rules.push(truncated);
      }
    }

    // Match bold DO/DON'T blocks
    if (/^\*\*(DO|DON'T|DO NOT)\*\*:/.test(trimmed)) {
      const directive = trimmed.replace(/\*\*/g, '').trim();
      if (directive.length <= 80) {
        rules.push(directive);
      }
    }
  }

  return rules;
}

// -----------------------------------------------------------------------------
// Agent Frontmatter Enrichment (Candlekeep #1231, #1232)
// -----------------------------------------------------------------------------

/** Cache parsed agent frontmatter to avoid re-reading .md files */
const agentFrontmatterCache = new Map<string, Record<string, string | string[]>>();

/**
 * Parse agent .md frontmatter for custom fields.
 * Returns a map of field → value for known enrichment fields.
 */
function parseAgentFrontmatter(agentType: string): Record<string, string | string[]> {
  if (agentFrontmatterCache.has(agentType)) {
    return agentFrontmatterCache.get(agentType)!;
  }

  const result: Record<string, string | string[]> = {};
  const pluginRoot = getPluginRoot();
  if (!pluginRoot) {
    agentFrontmatterCache.set(agentType, result);
    return result;
  }

  const agentFile = join(pluginRoot, 'agents', `${agentType}.md`);
  if (!existsSync(agentFile)) {
    agentFrontmatterCache.set(agentType, result);
    return result;
  }

  try {
    const content = readFileSync(agentFile, 'utf8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      agentFrontmatterCache.set(agentType, result);
      return result;
    }

    const fm = fmMatch[1];

    // critical_system_reminder: single-line string (#1231)
    const csrMatch = fm.match(/^critical_system_reminder:\s*"(.+)"$/m);
    if (csrMatch) {
      result.critical_system_reminder = csrMatch[1];
    }

    // required_mcp_servers: YAML array (#1232)
    const rmsMatch = fm.match(/^required_mcp_servers:\s*\[(.+)\]$/m);
    if (rmsMatch) {
      result.required_mcp_servers = rmsMatch[1].split(',').map(s => s.trim());
    }
  } catch {
    // Parse errors are non-fatal
  }

  agentFrontmatterCache.set(agentType, result);
  return result;
}

/**
 * Inject critical_system_reminder into subagent context (#1231).
 * These are persistent guardrails the agent should always follow.
 */
function injectCriticalReminder(agentType: string): string {
  const fm = parseAgentFrontmatter(agentType);
  const reminder = fm.critical_system_reminder;
  if (!reminder || typeof reminder !== 'string') return '';
  return `CRITICAL GUARDRAIL: ${reminder}\n\n`;
}

/**
 * Check required_mcp_servers availability and warn if missing (#1232).
 * Reads connected MCP servers from input and compares to requirements.
 */
function checkRequiredMcpServers(agentType: string): string {
  const fm = parseAgentFrontmatter(agentType);
  const required = fm.required_mcp_servers;
  if (!required || !Array.isArray(required) || required.length === 0) return '';

  // CC exposes connected MCP servers via CLAUDE_MCP_SERVERS env var
  const connectedRaw = process.env.CLAUDE_MCP_SERVERS || '';
  const connected = connectedRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const missing = required.filter(s => !connected.includes(s.toLowerCase()));

  if (missing.length === 0) return '';

  logHook('subagent-context-stager', `Agent ${agentType} missing MCP servers: ${missing.join(', ')}`);
  return `WARNING: This agent requires MCP servers that may not be connected: ${missing.join(', ')}. ` +
    `Results may be degraded. Consider connecting these servers before proceeding.\n\n`;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function subagentContextStager(input: HookInput): HookResult {
  const toolInput = input.tool_input || {};
  const subagentType = (toolInput.subagent_type as string) || '';
  const taskDescription = (toolInput.task_description as string) || (toolInput.description as string) || '';

  // === FORK DETECTION (CC 2.1.89 — #1227) ===
  // Forked subagents inherit parent's full context (system prompt, CLAUDE.md, conversation).
  // Skip heavy context injection (CLAUDE.md rules, decisions, todos, testing reminders)
  // but still inject critical guardrails and active issue context (~100 tokens vs ~500).
  const isFork = Boolean(input.is_fork);

  logHook('subagent-context-stager', `Staging context for ${subagentType}${isFork ? ' (fork — lightweight mode)' : ''}`);

  let stagedContext = '';

  // === INJECT AGENT-SPECIFIC GUARDRAILS (#1231) — always, even for forks ===
  const criticalReminder = injectCriticalReminder(subagentType);
  if (criticalReminder) {
    stagedContext += criticalReminder;
    logHook('subagent-context-stager', `Injected critical_system_reminder for ${subagentType}`);
  }

  // === CHECK REQUIRED MCP SERVERS (#1232) — always, even for forks ===
  const mcpWarning = checkRequiredMcpServers(subagentType);
  if (mcpWarning) {
    stagedContext += mcpWarning;
  }

  // === STAGE ISSUE DOCUMENTATION — always, even for forks ===
  const taskLower = taskDescription.toLowerCase();
  if (/issue|#\d+|bug|fix/.test(taskLower)) {
    logHook('subagent-context-stager', 'Issue-related task detected');

    const issueMatch = taskDescription.match(/#(\d+)/);
    if (issueMatch) {
      const issueNum = issueMatch[1];
      const issueDoc = findIssueDoc(issueNum);
      if (issueDoc) {
        stagedContext += `ISSUE DOCS: ${issueDoc}\n\n`;
        logHook('subagent-context-stager', `Staged issue documentation for #${issueNum}`);
      }
    }
  }

  // === FORK: skip heavy context (CLAUDE.md rules, decisions, todos, testing reminders) ===
  if (isFork) {
    logHook('subagent-context-stager', `Fork lightweight mode: skipped CLAUDE.md rules, decisions, todos`);
  } else {
    // === INJECT CRITICAL RULES FROM CLAUDE.md FILES ===
    const criticalRules = extractCriticalRules();
    if (criticalRules) {
      stagedContext += criticalRules;
      logHook('subagent-context-stager', 'Injected critical rules from CLAUDE.md');
    }

    // === CHECK FOR ACTIVE TODOS (Context Protocol 2.0) ===
    const { count: pendingCount, summary: taskSummary } = extractPendingTasks();
    if (pendingCount > 0) {
      logHook('subagent-context-stager', `Found ${pendingCount} pending tasks`);
      stagedContext += `ACTIVE TODOS:\n${taskSummary}\n\n`;
    }

    // === STAGE RELEVANT ARCHITECTURE DECISIONS ===
    if (/backend|api|endpoint|database|migration/.test(taskLower)) {
      logHook('subagent-context-stager', 'Backend task detected - staging backend decisions');
      const backendDecisions = extractRelevantDecisions(taskDescription, 'backend');
      if (backendDecisions) {
        stagedContext += `RELEVANT DECISIONS:\n${backendDecisions}\n\n`;
      }
    }

    if (/frontend|react|ui|component/.test(taskLower)) {
      logHook('subagent-context-stager', 'Frontend task detected - staging frontend decisions');
      const frontendDecisions = extractRelevantDecisions(taskDescription, 'frontend');
      if (frontendDecisions) {
        stagedContext += `RELEVANT DECISIONS:\n${frontendDecisions}\n\n`;
      }
    }

    // === STAGE TESTING REMINDERS ===
    if (/test|testing|pytest|jest/.test(taskLower)) {
      logHook('subagent-context-stager', 'Testing task detected - staging test context');
      stagedContext += `TESTING REMINDERS:
- Use 'tee' for visible test output
- Check test patterns in backend/tests/ or frontend/src/**/__tests__/
- Ensure coverage meets threshold requirements

`;
    }
  }

  // === RETURN SYSTEM MESSAGE (CC 2.1.7 Compliant) ===
  if (stagedContext) {
    const systemMessage = `${stagedContext}\nTask: ${taskDescription}\nSubagent: ${subagentType}`;
    const lineCount = stagedContext.split('\n').filter(Boolean).length;
    logHook('subagent-context-stager', `Staged context with ${lineCount} lines`);

    return {
      continue: true,
      systemMessage,
    };
  }

  logHook('subagent-context-stager', 'No context staged for this task');
  return outputSilentSuccess();
}
