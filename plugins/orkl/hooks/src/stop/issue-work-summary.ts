/**
 * Issue Work Summary - Stop Hook
 * Posts consolidated progress comments to GitHub issues
 *
 * CC 2.1.7 Compliant: Uses suppressOutput for silent operation
 */

import { existsSync, readFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getSessionId, outputSilentSuccess } from '../lib/common.js';

interface IssueProgress {
  issues: {
    [issueNum: string]: {
      branch: string;
      commits: Array<{ sha: string; message: string }>;
      tasks_completed: string[];
    };
  };
}

/**
 * Check if gh CLI is available and authenticated
 */
function isGhAvailable(): boolean {
  try {
    execSync('which gh', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    execSync('gh auth status', { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if in a GitHub repository
 */
function isGitHubRepo(projectDir: string): boolean {
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return remote.includes('github');
  } catch {
    return false;
  }
}

/**
 * Generate markdown comment for an issue
 */
function generateComment(issueNum: string, data: IssueProgress['issues'][string], sessionId: string): string {
  const commits = data.commits || [];
  if (commits.length === 0) {
    return '';
  }

  const commitsSection = commits.map((c) => `- \`${c.sha}\`: ${c.message}`).join('\n');
  const tasksSection =
    data.tasks_completed?.length > 0
      ? `### Sub-tasks Completed\n${data.tasks_completed.map((t) => `- [x] ${t}`).join('\n')}`
      : '';

  return `## Claude Code Progress Update

**Session**: \`${sessionId.slice(0, 8)}...\`
**Branch**: \`${data.branch || 'unknown'}\`

### Commits (${commits.length})
${commitsSection}

${tasksSection}
---
*Automated by [OrchestKit](https://github.com/yonatangross/orchestkit)*`;
}

/**
 * Post comment to GitHub issue
 */
function postComment(issueNum: string, comment: string): boolean {
  try {
    execSync(`gh issue comment ${issueNum} --body "${comment.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Issue work summary hook
 */
export function issueWorkSummary(input: HookInput): HookResult {
  logHook('issue-work-summary', 'Session ending, checking for issue progress to post...');

  const projectDir = input.project_dir || getProjectDir();
  const sessionId = input.session_id || getSessionId();

  // Sanitize session ID to prevent path traversal
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
  const sessionDir = `/tmp/claude-session-${safeSessionId}`;
  const progressFile = `${sessionDir}/issue-progress.json`;

  // Check if progress file exists
  if (!existsSync(progressFile)) {
    logHook('issue-work-summary', `No progress file found at ${progressFile}`);
    return outputSilentSuccess();
  }

  // Check if gh CLI is available
  if (!isGhAvailable()) {
    logHook('issue-work-summary', 'gh CLI not available or not authenticated, skipping');
    return outputSilentSuccess();
  }

  // Check if we're in a GitHub repo
  if (!isGitHubRepo(projectDir)) {
    logHook('issue-work-summary', 'Not a GitHub repository, skipping');
    return outputSilentSuccess();
  }

  // Read progress file
  let progressJson: IssueProgress;
  try {
    progressJson = JSON.parse(readFileSync(progressFile, 'utf-8'));
  } catch {
    logHook('issue-work-summary', 'Failed to read progress file');
    return outputSilentSuccess();
  }

  const issues = progressJson.issues ? Object.keys(progressJson.issues) : [];
  if (issues.length === 0) {
    logHook('issue-work-summary', 'No issues to process');
    return outputSilentSuccess();
  }

  // Process each issue
  let postedCount = 0;
  for (const issueNum of issues) {
    const issueData = progressJson.issues[issueNum];
    const commits = issueData.commits || [];

    if (commits.length === 0) {
      logHook('issue-work-summary', `No commits for issue #${issueNum}, skipping`);
      continue;
    }

    // Verify issue exists
    try {
      execSync(`gh issue view ${issueNum} --json number`, {
        encoding: 'utf8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      logHook('issue-work-summary', `Issue #${issueNum} not found or not accessible, skipping`);
      continue;
    }

    // Generate and post comment
    const comment = generateComment(issueNum, issueData, sessionId);
    if (comment && postComment(issueNum, comment)) {
      postedCount++;
      logHook('issue-work-summary', `Successfully posted comment to issue #${issueNum}`);
    }
  }

  logHook('issue-work-summary', `Posted progress comments to ${postedCount} issue(s)`);

  // Clean up progress file
  try {
    unlinkSync(progressFile);
    // Remove session dir if empty
    try {
      rmdirSync(sessionDir);
    } catch {
      // Directory not empty, leave it
    }
    logHook('issue-work-summary', 'Cleaned up progress file');
  } catch {
    // Ignore cleanup errors
  }

  return outputSilentSuccess();
}
