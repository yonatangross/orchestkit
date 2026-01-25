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

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getField, getProjectDir, getSessionId, logHook } from '../lib/common.js';

// Edit pattern categories with detection patterns
const PATTERN_DEFINITIONS: Array<{ name: string; regex: RegExp }> = [
  // API/Backend patterns
  { name: 'add_pagination', regex: /limit.*offset|page.*size|cursor.*pagination|paginate|Paginated/i },
  { name: 'add_rate_limiting', regex: /rate.?limit|throttl|RateLimiter|requests.?per/i },
  { name: 'add_caching', regex: /@cache|cache_key|TTL|redis|memcache|@cached/i },
  { name: 'add_retry_logic', regex: /retry|backoff|max_attempts|tenacity|Retry/i },
  // Error handling patterns
  { name: 'add_error_handling', regex: /try.*catch|except|raise.*Exception|throw.*Error|error.*handler/i },
  { name: 'add_validation', regex: /validate|Validator|@validate|Pydantic|Zod|yup|schema/i },
  { name: 'add_logging', regex: /logger[.]|logging[.]|console[.]log|winston|pino|structlog/i },
  // Type safety patterns
  { name: 'add_types', regex: /: *(str|int|bool|List|Dict|Optional)|interface |type .*=/i },
  { name: 'add_type_guards', regex: /isinstance|typeof|is.*Type|assert.*type/i },
  // Code quality patterns
  { name: 'add_docstring', regex: /docstring|"""[^"]+"""|\/\*\*/i },
  { name: 'remove_comments', regex: /^-.*#|^-.*\/\/|^-.*\*/m },
  // Security patterns
  { name: 'add_auth_check', regex: /@auth|@require_auth|isAuthenticated|requiresAuth|@login_required/i },
  { name: 'add_input_sanitization', regex: /escape|sanitize|htmlspecialchars|DOMPurify/i },
  // Testing patterns
  { name: 'add_test_case', regex: /def test_|it\(|describe\(|expect\(|assert|@pytest/i },
  { name: 'add_mock', regex: /Mock|patch|jest[.]mock|vi[.]mock|MagicMock/i },
  // Import/dependency patterns
  { name: 'modify_imports', regex: /^[+-].*import|^[+-].*from.*import|^[+-].*require\(/m },
  // Async patterns
  { name: 'add_async', regex: /async |await |Promise|asyncio|async def/i },
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

  for (const { name, regex } of PATTERN_DEFINITIONS) {
    if (regex.test(diffContent)) {
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
    mkdirSync(require('path').dirname(editPatternsFile), { recursive: true });
    appendFileSync(editPatternsFile, JSON.stringify(entry) + '\n');
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
  const sessionStateFile = `${projectDir}/.claude/session/state.json`;
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
