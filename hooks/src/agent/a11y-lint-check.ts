/**
 * A11y Lint Check - Runs accessibility linting on written files
 *
 * Used by: accessibility-specialist agent
 *
 * Purpose: Auto-lint written files for accessibility issues
 *
 * CC 2.1.7 compliant output format
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithContext } from '../lib/common.js';

/**
 * A11y lint check hook
 */
export function a11yLintCheck(input: HookInput): HookResult {
  const filePath = input.tool_input.file_path || '';
  const toolName = input.tool_name;

  // Only run on Write or Edit operations
  if (toolName !== 'Write' && toolName !== 'Edit') {
    return outputSilentSuccess();
  }

  // Check if file is a frontend file that should be linted
  if (/\.(tsx|jsx|html)$/.test(filePath)) {
    // Could integrate with axe-linter or eslint-plugin-jsx-a11y here
    // For now, just provide guidance
    return outputWithContext(
      'A11y reminder: Verify WCAG 2.2 compliance - check color contrast, ARIA labels, keyboard navigation, and focus management.'
    );
  }

  // Non-frontend files pass through
  return outputSilentSuccess();
}
