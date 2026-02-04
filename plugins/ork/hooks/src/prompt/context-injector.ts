/**
 * Context Injector - UserPromptSubmit Hook
 * Injects relevant context hints based on user prompt keywords
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir } from '../lib/common.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Context injector hook - adds helpful hints based on prompt content
 */
export function contextInjector(input: HookInput): HookResult {
  const prompt = input.prompt || '';
  const projectDir = input.project_dir || getProjectDir();

  logHook('context-injector', `User prompt received (${prompt.length} chars)`);

  const contextHints: string[] = [];

  // If prompt mentions issues or bugs, remind about issue docs
  if (/issue|bug|fix|#[0-9]+/.test(prompt)) {
    const issueDocsDir = join(projectDir, 'docs', 'issues');
    if (existsSync(issueDocsDir)) {
      contextHints.push('Check docs/issues/ for issue documentation.');
    }
  }

  // If prompt mentions testing, remind about test patterns
  if (/test|testing|pytest|jest/.test(prompt.toLowerCase())) {
    contextHints.push("Remember to use 'tee' for visible test output.");
  }

  // If prompt mentions deployment or CI/CD
  if (/deploy|ci|cd|pipeline|github.actions/.test(prompt.toLowerCase())) {
    contextHints.push('Check .github/workflows/ for CI configuration.');
  }

  // Log context hints if any
  if (contextHints.length > 0) {
    logHook('context-injector', `Context hints: ${contextHints.join(' ')}`);
  }

  // Currently outputs silent success - hints are logged only
  // Could be enhanced to use additionalContext in the future
  return outputSilentSuccess();
}
