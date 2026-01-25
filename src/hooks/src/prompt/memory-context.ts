/**
 * Memory Context - UserPromptSubmit Hook
 * Auto-searches knowledge graph for relevant context based on user prompt
 * CC 2.1.7 Compliant
 *
 * Graph-First Architecture (v2.1):
 * - ALWAYS works - knowledge graph requires no configuration
 * - Primary: Search knowledge graph (mcp__memory__search_nodes)
 * - Optional: Also search mem0 for semantic matches if configured
 *
 * Part of Memory Fabric v2.1
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir } from '../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Keywords that suggest memory search would be valuable
const MEMORY_TRIGGER_KEYWORDS = [
  'add',
  'implement',
  'create',
  'build',
  'design',
  'refactor',
  'update',
  'modify',
  'fix',
  'change',
  'continue',
  'resume',
  'remember',
  'previous',
  'last time',
  'before',
  'earlier',
  'pattern',
  'decision',
  'how did we',
  'what did we',
];

// Keywords that suggest graph search would be valuable
const GRAPH_TRIGGER_KEYWORDS = [
  'relationship',
  'related',
  'connected',
  'depends',
  'uses',
  'recommends',
  'what does.*recommend',
  'how does.*work with',
];

// Minimum prompt length to trigger memory search
const MIN_PROMPT_LENGTH = 20;

/**
 * Check if prompt contains memory trigger keywords
 */
function shouldSearchMemory(prompt: string): boolean {
  const promptLower = prompt.toLowerCase();

  for (const keyword of MEMORY_TRIGGER_KEYWORDS) {
    if (promptLower.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if prompt contains graph trigger keywords
 */
function hasGraphTrigger(prompt: string): boolean {
  const promptLower = prompt.toLowerCase();

  for (const keyword of GRAPH_TRIGGER_KEYWORDS) {
    if (new RegExp(keyword, 'i').test(promptLower)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract search terms from prompt
 */
function extractSearchTerms(prompt: string): string {
  const stopwords = new Set([
    'the',
    'a',
    'an',
    'to',
    'for',
    'in',
    'on',
    'at',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'can',
    'may',
    'might',
    'must',
    'shall',
    'i',
    'you',
    'we',
    'they',
    'it',
    'this',
    'that',
    'these',
    'those',
    'my',
    'your',
    'our',
    'their',
    'its',
    'and',
    'or',
    'but',
    'if',
    'then',
    'else',
    'when',
    'where',
    'how',
    'what',
    'which',
    'who',
    'whom',
    'with',
    'from',
    'into',
    'onto',
    'about',
    'after',
    'before',
    'global',
  ]);

  const words = prompt
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word))
    .slice(0, 5);

  return words.join(' ');
}

/**
 * Generate mem0 user ID for a scope
 */
function getMem0UserId(scope: string, projectDir: string): string {
  const projectName = projectDir.split('/').pop() || 'unknown';
  return `project:${projectName}:${scope}`;
}

/**
 * Get current agent ID if available
 */
function getAgentContext(projectDir: string): string {
  // Check environment variable first
  const agentId = process.env.CLAUDE_AGENT_ID;
  if (agentId) return agentId;

  // Check agent tracking file
  const trackingFile = join(projectDir, '.claude', 'session', 'current-agent-id');
  if (existsSync(trackingFile)) {
    try {
      return readFileSync(trackingFile, 'utf8').trim();
    } catch {
      // Ignore
    }
  }

  return '';
}

/**
 * Memory context hook - suggests memory searches for relevant context
 */
export function memoryContext(input: HookInput): HookResult {
  const prompt = input.prompt || '';
  const projectDir = input.project_dir || getProjectDir();

  const isMem0Available = false; // Simplified - mem0 availability would be checked at runtime

  logHook('memory-context', `Memory context hook starting (graph-first, mem0=${isMem0Available})`);

  // Skip if prompt is too short
  if (prompt.length < MIN_PROMPT_LENGTH) {
    logHook('memory-context', `Prompt too short (${prompt.length} chars), skipping memory search`);
    return outputSilentSuccess();
  }

  // Check for special prefixes
  const useGlobal =
    prompt.startsWith('@global') ||
    prompt.includes('cross-project') ||
    prompt.includes('all projects');
  const useGraph = hasGraphTrigger(prompt);

  if (useGlobal) {
    logHook('memory-context', 'Detected @global prefix - will suggest cross-project search');
  }

  if (useGraph) {
    logHook('memory-context', 'Detected graph-related query');
  }

  // Get agent context
  const agentContext = getAgentContext(projectDir);
  if (agentContext) {
    logHook('memory-context', `Agent context detected: ${agentContext}`);
  }

  // Check if memory search would be valuable
  if (!shouldSearchMemory(prompt)) {
    logHook('memory-context', 'No memory trigger keywords found, skipping');
    return outputSilentSuccess();
  }

  // Extract search terms
  const searchTerms = extractSearchTerms(prompt);
  if (!searchTerms) {
    logHook('memory-context', 'No search terms extracted, skipping');
    return outputSilentSuccess();
  }

  logHook('memory-context', `Search terms: ${searchTerms}`);

  // Build scope description
  const scopeDesc = useGlobal ? 'cross-project' : 'project';

  // Build context suggestion message
  // NOTE: We build the message but return silent success
  // The original bash hook did the same - built the message but returned silently
  // Claude already has access to memory tools

  const userIdDecisions = getMem0UserId('decisions', projectDir);

  let systemMsg = `[Memory Context] For relevant past ${scopeDesc} decisions, use mcp__memory__search_nodes with query="${searchTerms}"`;

  // Add relationship hint if graph-related query
  if (useGraph) {
    systemMsg +=
      ' | For relationships: mcp__memory__open_nodes on found entities | Graph traversal available';
  }

  // Add mem0 hint if available
  if (isMem0Available && userIdDecisions) {
    systemMsg += ` | [Enhanced] For semantic search: mcp__mem0__search_memories query="${searchTerms}" user_id="${userIdDecisions}" enable_graph=true`;

    if (!useGlobal) {
      systemMsg += ' | Cross-project: user_id="global:best-practices"';
    }
  }

  // Add agent context hint
  if (agentContext) {
    systemMsg += ` | Agent context: ${agentContext}`;
  }

  logHook('memory-context', `Memory context available for: ${searchTerms}`);

  // Silent operation - Claude already has access to memory tools
  return outputSilentSuccess();
}
