/**
 * Skill Edit Pattern Tracker - PostToolUse Hook
 * Tracks edit patterns after skill usage to enable skill evolution
 *
 * Part of: #58 (Skill Evolution System)
 * Triggers on: Write|Edit after skill usage
 * Action: Categorize and log edit patterns for evolution analysis
 * CC 2.1.7 Compliant
 *
 * Version: 1.0.2 - TypeScript port
 */

import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { bufferWrite } from '../lib/analytics-buffer.js';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getField, getProjectDir, getSessionId, logHook, lineContainsAllCI } from '../lib/common.js';

// Edit pattern categories with detection patterns
// Uses test functions instead of RegExp to avoid ReDoS-vulnerable polynomial patterns
const PATTERN_DEFINITIONS: Array<{ name: string; test: (s: string) => boolean }> = [
  // API/Backend patterns
  { name: 'add_pagination', test: (s) => lineContainsAllCI(s, 'limit', 'offset') || lineContainsAllCI(s, 'page', 'size') || lineContainsAllCI(s, 'cursor', 'pagination') || /paginate|Paginated/i.test(s) },
  { name: 'add_rate_limiting', test: (s) => /rate.?limit|throttl|RateLimiter|requests.?per/i.test(s) },
  { name: 'add_caching', test: (s) => /[@]cache|cache_key|TTL|redis|memcache|[@]cached/i.test(s) },
  { name: 'add_retry_logic', test: (s) => /retry|backoff|max_attempts|tenacity|Retry/i.test(s) },
  // Error handling patterns
  { name: 'add_error_handling', test: (s) => lineContainsAllCI(s, 'try', 'catch') || /except/i.test(s) || lineContainsAllCI(s, 'raise', 'Exception') || lineContainsAllCI(s, 'throw', 'Error') || lineContainsAllCI(s, 'error', 'handler') },
  { name: 'add_validation', test: (s) => /validate|Validator|[@]validate|Pydantic|Zod|yup|schema/i.test(s) },
  { name: 'add_logging', test: (s) => /logger[.]|logging[.]|console[.]log|winston|pino|structlog/i.test(s) },
  // Type safety patterns
  { name: 'add_types', test: (s) => /: *(str|int|bool|List|Dict|Optional)|interface |type .*=/i.test(s) },
  { name: 'add_type_guards', test: (s) => /isinstance|typeof/i.test(s) || lineContainsAllCI(s, 'is', 'Type') || lineContainsAllCI(s, 'assert', 'type') },
  // Code quality patterns
  { name: 'add_docstring', test: (s) => /docstring|"""[^"]+"""|\/\*\*/i.test(s) },
  { name: 'remove_comments', test: (s) => s.split('\n').some(line => /^-.*#|^-.*\/\/|^-.*\*/.test(line)) },
  // Security patterns
  { name: 'add_auth_check', test: (s) => /[@]auth|[@]require_auth|isAuthenticated|requiresAuth|[@]login_required/i.test(s) },
  { name: 'add_input_sanitization', test: (s) => /escape|sanitize|htmlspecialchars|DOMPurify/i.test(s) },
  // Testing patterns
  { name: 'add_test_case', test: (s) => /def test_|it\(|describe\(|expect\(|assert|[@]pytest/i.test(s) },
  { name: 'add_mock', test: (s) => /Mock|patch|jest[.]mock|vi[.]mock|MagicMock/i.test(s) },
  // Import/dependency patterns
  { name: 'modify_imports', test: (s) => s.split('\n').some(line => /^[+-].*import/.test(line) || /^[+-].*require\(/.test(line)) },
  // Async patterns
  { name: 'add_async', test: (s) => /async |await |Promise|asyncio|async def/i.test(s) },
];

/**
 * Get recent skill usage from session state
 */
function getRecentSkill(sessionStateFile: string): string {
  if (!existsSync(sessionStateFile)) {
    return '';
  }

  try {
    const content = JSON.parse(readFileSync(sessionStateFile, 'utf8'));
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - 300; // 5 minutes

    const recentSkills = (content.recentSkills || [])
      .filter((s: { timestamp: number }) => s.timestamp > cutoff)
      .sort((a: { timestamp: number }, b: { timestamp: number }) => b.timestamp - a.timestamp);

    return recentSkills[0]?.skillId || '';
  } catch {
    return '';
  }
}

/**
 * Detect edit patterns in content diff
 */
function detectPatterns(diffContent: string): string[] {
  const detected: string[] = [];

  for (const { name, test } of PATTERN_DEFINITIONS) {
    if (test(diffContent)) {
      detected.push(name);
    }
  }

  return detected;
}

/**
 * Log edit pattern to JSONL file
 */
function logEditPattern(
  skillId: string,
  filePath: string,
  patterns: string[],
  editPatternsFile: string
): void {
  const sessionId = getSessionId();
  const timestamp = new Date().toISOString();

  const entry = {
    timestamp,
    skill_id: skillId,
    file_path: filePath,
    session_id: sessionId,
    patterns,
  };

  try {
    mkdirSync(require('node:path').dirname(editPatternsFile), { recursive: true });
    bufferWrite(editPatternsFile, `${JSON.stringify(entry)}\n`);
  } catch {
    // Ignore write errors
  }
}

/**
 * Track skill edit patterns
 */
export function skillEditTracker(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Only process Write/Edit tools
  if (toolName !== 'Write' && toolName !== 'Edit') {
    return outputSilentSuccess();
  }

  // Get file path from tool input
  const filePath = getField<string>(input, 'tool_input.file_path') || '';

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Get recently used skill
  const projectDir = getProjectDir();
  const sessionStateFile = `${projectDir}/.claude/context/session/state.json`;
  const skillId = getRecentSkill(sessionStateFile);

  if (!skillId) {
    // No recent skill usage - nothing to track
    return outputSilentSuccess();
  }

  // Get the diff/edit content
  let editContent = '';

  if (toolName === 'Edit') {
    // For Edit tool, analyze old_string -> new_string diff
    const oldString = getField<string>(input, 'tool_input.old_string') || '';
    const newString = getField<string>(input, 'tool_input.new_string') || '';

    if (oldString && newString) {
      // Create pseudo-diff (+ for added, - for removed lines)
      const oldLines = oldString.split('\n');
      const newLines = newString.split('\n');
      editContent = oldLines.map(l => `-${l}`).join('\n') + '\n' +
                   newLines.map(l => `+${l}`).join('\n');
    }
  } else {
    // For Write tool, analyze the new content
    editContent = getField<string>(input, 'tool_input.content') || '';
  }

  if (!editContent) {
    return outputSilentSuccess();
  }

  // Detect patterns
  const patterns = detectPatterns(editContent);

  // Only log if patterns detected
  if (patterns.length > 0) {
    const editPatternsFile = `${projectDir}/.claude/feedback/edit-patterns.jsonl`;
    logEditPattern(skillId, filePath, patterns, editPatternsFile);

    // Debug log
    if (process.env.CLAUDE_HOOK_DEBUG) {
      logHook('skill-edit-tracker', `Detected ${patterns.length} patterns for ${skillId}: ${JSON.stringify(patterns)}`);
    }
  }

  return outputSilentSuccess();
}
