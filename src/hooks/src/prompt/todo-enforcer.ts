/**
 * Todo Enforcer - UserPromptSubmit Hook
 * Reminds about todo tracking for complex tasks
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

// Complex task indicators (keyword pairs checked via includes)
const COMPLEX_KEYWORDS: string[][] = [
  ['implement'],
  ['refactor'],
  ['add feature'],
  ['create', 'component'],
  ['build', 'system'],
  ['fix', 'multiple'],
  ['update', 'across'],
  ['migrate'],
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

  // Check for complex task patterns (ReDoS-safe string checks)
  const lowerPrompt = prompt.toLowerCase();
  for (const keywords of COMPLEX_KEYWORDS) {
    if (keywords.every(k => lowerPrompt.includes(k))) {
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
