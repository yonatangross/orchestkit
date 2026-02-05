/**
 * Issue Docs Requirement Hook
 * Reminds to update documentation for feature issues
 * CC 2.1.9: Injects documentation reminders via additionalContext
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputAllowWithContext,
  logHook,
  logPermissionFeedback,
} from '../../lib/common.js';

/**
 * Documentation checklist for features
 */
const DOCS_CHECKLIST = `Documentation checklist for features:
- [ ] Update README.md if public API changes
- [ ] Add/update JSDoc or docstrings
- [ ] Update CHANGELOG.md
- [ ] Add usage examples
- [ ] Update API documentation`;

/**
 * Remind about documentation for feature branches/issues
 */
export function issueDocsRequirement(input: HookInput): HookResult {
  const command = input.tool_input.command || '';

  // Only process gh issue close or gh pr merge for feature issues
  if (!/gh\s+(issue\s+close|pr\s+merge)/.test(command)) {
    return outputSilentSuccess();
  }

  // Check if this is a feature (look for feat/feature labels or branch names)
  const isFeature =
    /--label.*feat/i.test(command) ||
    /feat|feature/.test(command);

  if (!isFeature) {
    return outputSilentSuccess();
  }

  const context = `Feature completion detected. Ensure documentation is updated.

${DOCS_CHECKLIST}

Skip with --no-edit if docs are already complete.`;

  logPermissionFeedback('allow', 'Feature docs reminder', input);
  logHook('issue-docs-requirement', 'Feature completion - docs reminder');
  return outputAllowWithContext(context);
}
