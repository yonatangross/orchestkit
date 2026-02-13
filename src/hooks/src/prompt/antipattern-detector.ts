/**
 * Antipattern Detector - UserPromptSubmit Hook
 * Suggests checking graph memory for known failed patterns before implementation
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook, getProjectDir } from '../lib/common.js';

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
 * Antipattern detector - suggests checking graph memory for known failures
 */
export function antipatternDetector(input: HookInput): HookResult {
  const prompt = input.prompt || '';
  const _projectDir = input.project_dir || getProjectDir();

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

  // Get category for search suggestion
  const category = detectCategory(prompt);

  logHook('antipattern-detector', `Suggesting antipattern check for: ${matchedKeyword} (category: ${category})`);

  // Build search suggestion using graph memory MCP
  const systemMsg = `[Antipattern Check] Before implementing ${matchedKeyword}, check for known failures:
Use \`mcp__memory__search_nodes\` with query: "${matchedKeyword} failed ${category}"`;

  return outputPromptContext(systemMsg);
}
