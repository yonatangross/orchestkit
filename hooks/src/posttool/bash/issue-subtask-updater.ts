/**
 * Issue Subtask Updater - Auto-update issue checkboxes based on commit messages
 * Part of OrchestKit Plugin - Issue Progress Tracking
 *
 * Triggers: After successful git commit commands
 * Function: Parses commit message for task completion keywords and updates
 *           corresponding checkboxes in the GitHub issue body
 *
 * CC 2.1.9 Compliant: Uses suppressOutput for silent operation
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, getField, getSessionId, logHook } from '../../lib/common.js';

interface ProgressFile {
  session_id: string;
  issues: Record<string, IssueProgress>;
}

interface IssueProgress {
  commits: unknown[];
  tasks_completed: string[];
  pr_url: string | null;
}

/**
 * Extract action and subject from commit message
 * e.g., "feat(#123): Add input validation" -> "Add input validation"
 */
function extractTaskFromCommit(message: string): string {
  // Remove conventional commit prefix: type(scope):
  let task = message.replace(/^[a-z]+(\([^)]*\))?:\s*/i, '');

  // Remove issue references like (#123)
  task = task.replace(/\(#\d+\)/g, '');

  return task.trim();
}

/**
 * Normalize text for comparison (lowercase, remove extra spaces)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Check if commit task matches a checkbox item
 */
function matchesCheckbox(commitTask: string, checkboxText: string): boolean {
  const normCommit = normalizeText(commitTask);
  const normCheckbox = normalizeText(checkboxText);

  // Exact match (after normalization)
  if (normCommit === normCheckbox) {
    return true;
  }

  // Commit task contains checkbox text
  if (normCommit.includes(normCheckbox)) {
    return true;
  }

  // Checkbox text contains commit task
  if (normCheckbox.includes(normCommit)) {
    return true;
  }

  // Check if they share significant words (at least 2 words matching)
  const commitWords = new Set(normCommit.split(' ').filter(w => w.length >= 3));
  const checkboxWords = normCheckbox.split(' ').filter(w => w.length >= 3);
  let matchingWords = 0;

  for (const word of checkboxWords) {
    if (commitWords.has(word)) {
      matchingWords++;
    }
  }

  return matchingWords >= 2;
}

/**
 * Extract issue number from branch name
 */
function extractIssueFromBranch(branch: string): string | null {
  let match = branch.match(/^(issue|fix|feature|bug|feat)\/(\d+)/);
  if (match) {
    return match[2];
  }

  match = branch.match(/^(\d+)-/);
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Extract issue number from commit message
 */
function extractIssueFromCommit(message: string): string | null {
  const match = message.match(/#(\d+)/);
  return match ? match[1] : null;
}

/**
 * Get unchecked tasks from issue body
 */
function getUncheckedTasks(issueNum: string): string[] {
  try {
    const body = execSync(`gh issue view ${issueNum} --json body -q '.body' 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 10000,
    });

    // Extract unchecked checkbox items: - [ ] text
    const lines = body.split('\n');
    const unchecked: string[] = [];

    for (const line of lines) {
      const match = line.match(/^\s*-\s*\[\s*\]\s+(.+)/);
      if (match) {
        unchecked.push(match[1].trim());
      }
    }

    return unchecked;
  } catch {
    return [];
  }
}

/**
 * Update a checkbox from unchecked to checked
 */
function updateCheckbox(issueNum: string, checkboxText: string): boolean {
  logHook('issue-subtask-updater', `Attempting to update checkbox: '${checkboxText}' in issue #${issueNum}`);

  try {
    // Get current body
    const body = execSync(`gh issue view ${issueNum} --json body -q '.body' 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 10000,
    });

    // Escape special regex characters in checkbox text
    const escapedText = checkboxText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace unchecked with checked
    const updatedBody = body.replace(
      new RegExp(`(^\\s*-\\s*)\\[\\s*\\](\\s+${escapedText})`, 'm'),
      '$1[x]$2'
    );

    // Check if anything changed
    if (body === updatedBody) {
      logHook('issue-subtask-updater', `No change needed for checkbox: '${checkboxText}'`);
      return false;
    }

    // Get repo info
    const repo = execSync(`gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    // Update issue body via API
    const bodyJson = JSON.stringify(updatedBody);
    execSync(`gh api -X PATCH "repos/${repo}/issues/${issueNum}" -f body=${bodyJson}`, {
      stdio: 'ignore',
      timeout: 10000,
    });

    logHook('issue-subtask-updater', `Successfully updated checkbox: '${checkboxText}'`);
    return true;
  } catch (error) {
    logHook('issue-subtask-updater', `Failed to update issue body: ${error}`);
    return false;
  }
}

/**
 * Record completed task in progress file
 */
function recordTaskCompletion(issueNum: string, taskText: string, progressFile: string): void {
  if (!existsSync(progressFile)) {
    return;
  }

  try {
    const data: ProgressFile = JSON.parse(readFileSync(progressFile, 'utf8'));

    if (!data.issues[issueNum]) {
      data.issues[issueNum] = {
        commits: [],
        tasks_completed: [],
        pr_url: null,
      };
    }

    if (!data.issues[issueNum].tasks_completed.includes(taskText)) {
      data.issues[issueNum].tasks_completed.push(taskText);
      writeFileSync(progressFile, JSON.stringify(data, null, 2));
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Update issue subtasks based on commit
 */
export function issueSubtaskUpdater(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Only process Bash tool
  if (toolName !== 'Bash') {
    return outputSilentSuccess();
  }

  const command = getField<string>(input, 'tool_input.command') || '';
  const exitCode = input.exit_code ?? 0;

  // Only process successful git commit commands
  if (!/git\s+commit/i.test(command) || exitCode !== 0) {
    return outputSilentSuccess();
  }

  logHook('issue-subtask-updater', 'Processing git commit for subtask updates...');

  // Check if gh CLI is available
  try {
    execSync('which gh', { stdio: 'ignore', timeout: 2000 });
  } catch {
    logHook('issue-subtask-updater', 'gh CLI not available, skipping subtask updates');
    return outputSilentSuccess();
  }

  // Check if we're in a git repo with GitHub remote
  try {
    const remote = execSync('git remote get-url origin 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000,
    });
    if (!remote.includes('github')) {
      logHook('issue-subtask-updater', 'Not a GitHub repository, skipping');
      return outputSilentSuccess();
    }
  } catch {
    return outputSilentSuccess();
  }

  // Get branch and commit message
  let branch = '';
  let commitMsg = '';

  try {
    branch = execSync('git branch --show-current 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    commitMsg = execSync('git log -1 --pretty=%s 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
  } catch {
    return outputSilentSuccess();
  }

  // Extract issue number
  let issueNum = extractIssueFromBranch(branch);
  if (!issueNum) {
    issueNum = extractIssueFromCommit(commitMsg);
  }

  if (!issueNum) {
    logHook('issue-subtask-updater', 'No issue number found');
    return outputSilentSuccess();
  }

  logHook('issue-subtask-updater', `Found issue #${issueNum}, checking for matching subtasks...`);

  // Extract task from commit message
  const commitTask = extractTaskFromCommit(commitMsg);
  if (!commitTask) {
    logHook('issue-subtask-updater', 'Could not extract task from commit message');
    return outputSilentSuccess();
  }

  logHook('issue-subtask-updater', `Commit task: '${commitTask}'`);

  // Get unchecked tasks from issue
  const uncheckedTasks = getUncheckedTasks(issueNum);
  if (uncheckedTasks.length === 0) {
    logHook('issue-subtask-updater', `No unchecked tasks in issue #${issueNum}`);
    return outputSilentSuccess();
  }

  // Check each unchecked task for a match
  let matched = false;
  const sessionId = (input.session_id || getSessionId()).replace(/[^a-zA-Z0-9_-]/g, '');
  const progressFile = `/tmp/claude-session-${sessionId}/issue-progress.json`;

  for (const checkboxText of uncheckedTasks) {
    if (matchesCheckbox(commitTask, checkboxText)) {
      logHook('issue-subtask-updater', `Found matching checkbox: '${checkboxText}'`);

      if (updateCheckbox(issueNum, checkboxText)) {
        recordTaskCompletion(issueNum, checkboxText, progressFile);
        matched = true;
      }
    }
  }

  if (!matched) {
    logHook('issue-subtask-updater', `No matching checkboxes found for task: '${commitTask}'`);
    return outputSilentSuccess();
  }

  // Provide additionalContext to Claude when tasks are updated (CC 2.1.9)
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `Issue #${issueNum}: Automatically marked sub-task as complete based on commit.`,
    },
  };
}
