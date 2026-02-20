/**
 * Todo Enforcer - UserPromptSubmit Hook
 * Reminds about todo tracking for complex tasks
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

// Complex task indicators (regex patterns)
const COMPLEX_PATTERNS: Array<{ test: (s: string) => boolean }> = [
  { test: (s) => /implement/i.test(s) },
  { test: (s) => /refactor/i.test(s) },
  { test: (s) => /add feature/i.test(s) },
  { test: (s) => s.toLowerCase().includes('create') && s.toLowerCase().includes('component') },
  { test: (s) => s.toLowerCase().includes('build') && s.toLowerCase().includes('system') },
  { test: (s) => s.toLowerCase().includes('fix') && s.toLowerCase().includes('multiple') },
  { test: (s) => s.toLowerCase().includes('update') && s.toLowerCase().includes('across') },
  { test: (s) => /migrate/i.test(s) },
];

// Threshold for long prompts (often indicate complex tasks)
const LONG_PROMPT_THRESHOLD = 500;

/**
 * Todo enforcer hook - detects complex tasks
 */
export function todoEnforcer(input: HookInput): HookResult {
  const prompt = input.prompt || '';
  const promptLength = prompt.length;

  logHook('todo-enforcer', `Prompt length: ${promptLength} chars`);

  let isComplex = false;

  // Check for complex task patterns
  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(prompt)) {
      isComplex = true;
      break;
    }
  }

  // Long prompts often indicate complex tasks
  if (promptLength > LONG_PROMPT_THRESHOLD) {
    isComplex = true;
  }

  if (isComplex) {
    logHook('todo-enforcer', 'Complex task detected - todo tracking recommended');
  }

  // Output systemMessage for user visibility
  // Currently outputs silent success - could be enhanced to inject context
  return outputSilentSuccess();
}
