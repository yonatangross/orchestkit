/**
 * GitHub Issue Creation Guide Hook
 * Provides guidance for creating GitHub issues
 * CC 2.1.9: Injects issue creation context via additionalContext
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputAllowWithContext,
  logHook,
  logPermissionFeedback,
} from '../../lib/common.js';

/**
 * Issue templates based on type
 */
const ISSUE_TEMPLATES: Record<string, string> = {
  bug: `## Description
<!-- Clear description of the bug -->

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
<!-- What should happen -->

## Actual Behavior
<!-- What actually happens -->

## Environment
- OS:
- Version:`,

  feature: `## Description
<!-- Clear description of the feature -->

## Motivation
<!-- Why is this feature needed? -->

## Proposed Solution
<!-- How should this be implemented? -->

## Alternatives Considered
<!-- Other approaches considered -->`,

  chore: `## Description
<!-- What maintenance task needs to be done? -->

## Impact
<!-- What does this affect? -->

## Checklist
- [ ] Task 1
- [ ] Task 2`,
};

/**
 * Detect issue type from command
 */
function detectIssueType(command: string): string | null {
  if (/--label.*bug|bug\s+report/i.test(command)) return 'bug';
  if (/--label.*feature|feature\s+request/i.test(command)) return 'feature';
  if (/--label.*chore|maintenance/i.test(command)) return 'chore';
  return null;
}

/**
 * Provide guidance for GitHub issue creation
 */
export function ghIssueCreationGuide(input: HookInput): HookResult {
  const command = input.tool_input.command || '';

  // Only process gh issue create commands
  if (!/gh\s+issue\s+create/.test(command)) {
    return outputSilentSuccess();
  }

  // Check if already has body/template
  if (/--body|--body-file|-b\s/.test(command)) {
    return outputSilentSuccess();
  }

  // Detect issue type
  const issueType = detectIssueType(command);

  if (issueType && ISSUE_TEMPLATES[issueType]) {
    const context = `Issue type detected: ${issueType}

Suggested template:
${ISSUE_TEMPLATES[issueType].slice(0, 200)}...

Add --body with template or use --web for interactive creation.`;

    logPermissionFeedback('allow', `Issue creation: ${issueType}`, input);
    logHook('gh-issue-creation-guide', `Type: ${issueType}`);
    return outputAllowWithContext(context);
  }

  // Generic guidance
  const context = `Creating GitHub issue. Consider:
- Clear, descriptive title
- Add appropriate labels (bug, feature, chore)
- Include reproduction steps for bugs
- Reference related issues/PRs

Use --web for interactive creation with templates.`;

  logPermissionFeedback('allow', 'Issue creation guidance', input);
  return outputAllowWithContext(context);
}
