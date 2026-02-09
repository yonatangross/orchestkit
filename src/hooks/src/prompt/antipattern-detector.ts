/**
 * Antipattern Detector - UserPromptSubmit Hook
 * Suggests checking mem0 for known failed patterns before implementation
 * CC 2.1.7 Compliant
 *
 * Part of mem0 Semantic Memory Integration (#49)
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook, getProjectDir } from '../lib/common.js';
import { basename } from 'node:path';

// Keywords that suggest implementation work where antipatterns matter
const IMPLEMENTATION_KEYWORDS = [
  'implement',
  'add',
  'create',
  'build',
  'set up',
  'configure',
  'pagination',
  'authentication',
  'caching',
  'database',
  'api',
  'endpoint',
];

/**
 * Detect best practice category from prompt
 */
function detectCategory(prompt: string): string {
  const promptLower = prompt.toLowerCase();

  if (/pagination|cursor|offset|page/i.test(promptLower)) return 'pagination';
  if (/auth|jwt|oauth|login|session/i.test(promptLower)) return 'authentication';
  if (/cache|redis|memo/i.test(promptLower)) return 'caching';
  if (/database|sql|postgres|query/i.test(promptLower)) return 'database';
  if (/api|endpoint|rest|graphql/i.test(promptLower)) return 'api';
  if (/error|exception|handling/i.test(promptLower)) return 'error-handling';
  if (/test|testing|spec/i.test(promptLower)) return 'testing';

  return 'general';
}

/**
 * Generate mem0 user ID for a scope
 */
function getMem0UserId(scope: string, projectDir: string): string {
  const projectName = basename(projectDir) || 'unknown';
  return `project:${projectName}:${scope}`;
}

/**
 * Generate global mem0 user ID
 */
function getGlobalUserId(scope: string): string {
  return `global:${scope}`;
}

/**
 * Antipattern detector - suggests mem0 search for known failures
 */
export function antipatternDetector(input: HookInput): HookResult {
  const prompt = input.prompt || '';
  const projectDir = input.project_dir || getProjectDir();

  // Skip if prompt too short
  if (prompt.length < 30) {
    return outputSilentSuccess();
  }

  // Check if prompt suggests implementation work
  const promptLower = prompt.toLowerCase();
  let matchedKeyword = '';

  for (const keyword of IMPLEMENTATION_KEYWORDS) {
    if (promptLower.includes(keyword)) {
      matchedKeyword = keyword;
      break;
    }
  }

  if (!matchedKeyword) {
    return outputSilentSuccess();
  }

  logHook('antipattern-detector', `Implementation keyword detected: ${matchedKeyword}`);

  // Get category and user IDs for search suggestion
  const category = detectCategory(prompt);
  const projectUserId = getMem0UserId('best-practices', projectDir);
  const globalUserId = getGlobalUserId('best-practices');

  logHook('antipattern-detector', `Suggesting antipattern check for: ${matchedKeyword} (category: ${category})`);

  // Build search suggestion message using CLI script
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || '${CLAUDE_PLUGIN_ROOT}';
  const scriptPath = `${pluginRoot}/src/skills/mem0-memory/scripts/crud/search-memories.py`;

  const systemMsg = `[Antipattern Check] Before implementing ${matchedKeyword}, check for known failures:
\`\`\`bash
python3 ${scriptPath} --query "${matchedKeyword} failed" --user-id "${projectUserId}" --limit 5
\`\`\`
Or check global: --user-id "${globalUserId}"`;

  return outputPromptContext(systemMsg);
}
