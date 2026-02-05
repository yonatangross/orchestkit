/**
 * Unified Error Handler - Consolidated error handling hook
 * Combines: error-collector + error-tracker + error-solution-suggester
 *
 * Hook: PostToolUse (*)
 *
 * Purpose:
 * 1. Detect errors from any tool (exit code, tool_error, output patterns)
 * 2. Log structured errors to JSONL for analysis
 * 3. Suggest solutions via additionalContext when patterns match
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext
 * Version: 2.0.0 - Consolidated from 3 hooks (~500 LOC → ~200 LOC)
 */

import { existsSync, appendFileSync, readFileSync, writeFileSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getProjectDir, getPluginRoot, getSessionId, getField, logHook } from '../lib/common.js';

// =============================================================================
// CONSTANTS
// =============================================================================

// Error detection regex (shared across all detection)
const ERROR_PATTERN = /error:|Error:|ERROR|FATAL|exception|failed|denied|not found|does not exist|connection refused|timeout|ENOENT|EACCES|EPERM/i;

// Trivial commands that don't need tracking
const TRIVIAL_COMMANDS = /^(echo |ls |ls$|pwd|cat |head |tail |wc |date|whoami)/;

// Configuration
const MAX_CONTEXT_CHARS = 2000;
const DEDUP_PROMPT_THRESHOLD = 10;
const MAX_SKILLS = 3;
const MAX_LOG_BYTES = 1000 * 1024; // 1MB

// =============================================================================
// TYPES
// =============================================================================

interface ErrorPattern {
  id: string;
  regex: string;
  category?: string;
  severity?: string;
  skills?: string[];
  solution?: {
    brief?: string;
    steps?: string[];
  };
}

interface SolutionsFile {
  patterns: ErrorPattern[];
  categories?: Record<string, { related_skills?: string[] }>;
}

interface DedupFile {
  suggestions: Record<string, { pattern_id: string; prompt_count: number }>;
  prompt_count: number;
}

interface ErrorInfo {
  isError: boolean;
  errorType: string;
  errorMessage: string;
  errorText: string;
}

// =============================================================================
// ERROR DETECTION (from error-collector + error-tracker)
// =============================================================================

function detectError(input: HookInput): ErrorInfo {
  const toolOutput = String(getField<unknown>(input, 'tool_output') || input.tool_output || '');
  const toolError = String(input.tool_error || getField<string>(input, 'error') || '');
  const exitCode = input.exit_code ?? 0;

  let isError = false;
  let errorType = '';
  let errorMessage = '';

  // Signal 1: Explicit non-zero exit code
  if (exitCode !== 0 && exitCode !== undefined) {
    isError = true;
    errorType = 'exit_code';
    errorMessage = `Exit code: ${exitCode}`;
  }

  // Signal 2: Error field present
  if (toolError) {
    isError = true;
    errorType = errorType || 'tool_error';
    errorMessage = errorMessage || toolError;
  }

  // Signal 3: Error patterns in output
  if (ERROR_PATTERN.test(toolOutput)) {
    isError = true;
    errorType = errorType || 'output_pattern';
    const errorLines = toolOutput.split('\n').filter(line => ERROR_PATTERN.test(line));
    errorMessage = errorMessage || errorLines[0] || '';
  }

  return {
    isError,
    errorType,
    errorMessage,
    errorText: toolError || toolOutput,
  };
}

// =============================================================================
// ERROR LOGGING (from error-collector)
// =============================================================================

function rotateLogFile(logFile: string): void {
  if (!existsSync(logFile)) return;
  try {
    const stats = statSync(logFile);
    if (stats.size > MAX_LOG_BYTES) {
      renameSync(logFile, `${logFile}.old.${Date.now()}`);
    }
  } catch {
    // Ignore rotation errors
  }
}

function logError(input: HookInput, errorInfo: ErrorInfo): void {
  const projectDir = getProjectDir();
  const errorLog = `${projectDir}/.claude/logs/errors.jsonl`;
  const metricsFile = '/tmp/claude-session-errors.json';

  try {
    mkdirSync(`${projectDir}/.claude/logs`, { recursive: true });
    rotateLogFile(errorLog);

    const inputHash = createHash('md5').update(JSON.stringify(input.tool_input || {})).digest('hex');

    const errorRecord = {
      timestamp: new Date().toISOString(),
      tool: input.tool_name,
      session_id: getSessionId(),
      error_type: errorInfo.errorType,
      error_message: errorInfo.errorMessage.substring(0, 500),
      input_hash: inputHash,
      tool_input: input.tool_input,
      output_preview: errorInfo.errorText.substring(0, 1000),
    };

    appendFileSync(errorLog, JSON.stringify(errorRecord) + '\n');

    // Update session metrics
    try {
      let metrics = { error_count: 0, last_error_tool: '', last_error_time: '' };
      if (existsSync(metricsFile)) {
        metrics = JSON.parse(readFileSync(metricsFile, 'utf8'));
      }
      metrics.error_count = (metrics.error_count || 0) + 1;
      metrics.last_error_tool = input.tool_name || '';
      metrics.last_error_time = new Date().toISOString();
      writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
    } catch {
      // Ignore metrics errors
    }

    logHook('unified-error-handler', `ERROR: ${input.tool_name} - ${errorInfo.errorType}`);
  } catch {
    logHook('unified-error-handler', `ERROR (fallback): ${input.tool_name}`);
  }
}

// =============================================================================
// SOLUTION SUGGESTIONS (from error-solution-suggester)
// =============================================================================

function matchErrorPattern(errorText: string, solutionsFile: string): ErrorPattern | null {
  if (!existsSync(solutionsFile)) return null;

  try {
    const content: SolutionsFile = JSON.parse(readFileSync(solutionsFile, 'utf8'));
    const errorLower = errorText.toLowerCase();

    for (const pattern of content.patterns || []) {
      if (pattern.regex) {
        try {
          if (new RegExp(pattern.regex, 'i').test(errorLower)) {
            return pattern;
          }
        } catch {
          // Invalid regex
        }
      }
    }
  } catch {
    // Parse error
  }
  return null;
}

function shouldSuggest(patternId: string, errorContext: string, dedupFile: string): boolean {
  if (!existsSync(dedupFile)) {
    try {
      mkdirSync(require('path').dirname(dedupFile), { recursive: true });
      writeFileSync(dedupFile, JSON.stringify({ suggestions: {}, prompt_count: 0 }));
    } catch {
      return true;
    }
  }

  try {
    const dedup: DedupFile = JSON.parse(readFileSync(dedupFile, 'utf8'));
    const suggestionHash = createHash('md5')
      .update(`${patternId}|${errorContext.substring(0, 100)}`)
      .digest('hex');

    const currentCount = (dedup.prompt_count || 0) + 1;
    dedup.prompt_count = currentCount;

    const lastSuggestedAt = dedup.suggestions[suggestionHash]?.prompt_count || 0;

    if (lastSuggestedAt === 0 || (currentCount - lastSuggestedAt) >= DEDUP_PROMPT_THRESHOLD) {
      dedup.suggestions[suggestionHash] = { pattern_id: patternId, prompt_count: currentCount };
      writeFileSync(dedupFile, JSON.stringify(dedup, null, 2));
      return true;
    }

    writeFileSync(dedupFile, JSON.stringify(dedup, null, 2));
    return false;
  } catch {
    return true;
  }
}

function getSkillDescription(skillName: string, skillsDir: string): string {
  const skillFile = `${skillsDir}/${skillName}/SKILL.md`;
  if (!existsSync(skillFile)) return '';

  try {
    const content = readFileSync(skillFile, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const descMatch = frontmatterMatch[1].match(/description:\s*(.+)/);
      if (descMatch) return descMatch[1].trim();
    }
  } catch {
    // Ignore
  }
  return '';
}

function buildSuggestionMessage(pattern: ErrorPattern, solutionsFile: string, skillsDir: string): string {
  const brief = pattern.solution?.brief || 'An error was detected.';
  const steps = pattern.solution?.steps || [];

  let msg = '## Error Solution\n\n';
  msg += `**${brief}**\n\n`;

  if (steps.length > 0) {
    msg += '### Quick Fixes\n\n';
    steps.forEach((step, i) => {
      msg += `  ${i + 1}. ${step}\n`;
    });
    msg += '\n';
  }

  // Get skills
  const patternSkills = pattern.skills || [];
  let categorySkills: string[] = [];
  if (pattern.category && existsSync(solutionsFile)) {
    try {
      const content: SolutionsFile = JSON.parse(readFileSync(solutionsFile, 'utf8'));
      categorySkills = content.categories?.[pattern.category]?.related_skills || [];
    } catch {
      // Ignore
    }
  }

  const allSkills = [...new Set([...patternSkills, ...categorySkills])].slice(0, MAX_SKILLS);

  if (allSkills.length > 0) {
    msg += '### Related Skills\n\n';
    for (const skill of allSkills) {
      const desc = getSkillDescription(skill, skillsDir);
      msg += desc ? `- **${skill}**: ${desc}\n` : `- **${skill}**\n`;
    }
    msg += '\nUse `/ork:<skill-name>` or `Read skills/<skill-name>/SKILL.md`';
  }

  return msg.length > MAX_CONTEXT_CHARS ? msg.substring(0, MAX_CONTEXT_CHARS - 20) + '...\n\n(truncated)' : msg;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function unifiedErrorHandler(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Self-guard: Skip trivial bash commands
  if (toolName === 'Bash') {
    const command = getField<string>(input, 'tool_input.command') || '';
    if (TRIVIAL_COMMANDS.test(command)) {
      return outputSilentSuccess();
    }
  }

  // Detect if this was an error
  const errorInfo = detectError(input);

  if (!errorInfo.isError) {
    return outputSilentSuccess();
  }

  // Log the error (always)
  logError(input, errorInfo);

  // Try to suggest solutions (Bash only, with dedup)
  if (toolName === 'Bash') {
    const pluginRoot = getPluginRoot();
    const solutionsFile = `${pluginRoot}/.claude/rules/error_solutions.json`;
    const skillsDir = `${pluginRoot}/skills`;
    const dedupFile = `/tmp/claude-error-suggestions-${getSessionId()}.json`;

    const matchedPattern = matchErrorPattern(errorInfo.errorText.substring(0, 2000), solutionsFile);

    if (matchedPattern && shouldSuggest(matchedPattern.id, errorInfo.errorText, dedupFile)) {
      const suggestionMessage = buildSuggestionMessage(matchedPattern, solutionsFile, skillsDir);

      if (suggestionMessage) {
        logHook('unified-error-handler', `Suggesting solution for pattern: ${matchedPattern.id}`);
        return {
          continue: true,
          hookSpecificOutput: {
            additionalContext: suggestionMessage,
          },
        };
      }
    }
  }

  return outputSilentSuccess();
}
