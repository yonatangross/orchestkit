/**
 * Issue Progress Commenter - Queue commit progress for GitHub issue updates
 * Part of OrchestKit Plugin - Issue Progress Tracking
 *
 * Triggers: After successful git commit commands
 * Function: Extracts issue number from branch name or commit message and queues
 *           progress for batch commenting at session end
 *
 * CC 2.1.9 Compliant: Uses suppressOutput for silent operation
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { HookInput, HookResult , HookContext} from '../../types.js';
import { outputSilentSuccess, getField, getSessionId, logHook } from '../../lib/common.js';
import { getSessionTempDir } from '../../lib/paths.js';

interface ProgressFile {
  session_id: string;
  issues: Record<string, IssueProgress>;
}

interface IssueProgress {
  commits: CommitInfo[];
  tasks_completed: string[];
  pr_url: string | null;
  branch: string;
}

interface CommitInfo {
  sha: string;
  message: string;
  timestamp: string;
}

/**
 * Extract issue number from branch name (e.g., issue/123-description, fix/123-bug)
 */
function extractIssueFromBranch(branch: string): string | null {
  // Pattern: issue/123-*, fix/123-*, feature/123-*, etc.
  let match = branch.match(/^(issue|fix|feature|bug|feat)\/(\d+)/);
  if (match) {
    return match[2];
  }

  // Pattern: 123-description (issue number at start)
  match = branch.match(/^(\d+)-/);
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Extract issue number from commit message (e.g., "fix(#123): message" or "closes #123")
 */
function extractIssueFromCommit(message: string): string | null {
  // Pattern: (#123) or #123 in message
  let match = message.match(/#(\d+)/);
  if (match) {
    return match[1];
  }

  // Pattern: fixes/closes/resolves #123
  match = message.match(/(fix|fixes|close|closes|resolve|resolves)\s+#?(\d+)/i);
  if (match) {
    return match[2];
  }

  return null;
}

/**
 * Get current branch name
 */
function getCurrentBranch(): string {
  try {
    try {
      return execFileSync('git', ['branch', '--show-current'], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch {
      return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    }
  } catch {
    return '';
  }
}

/**
 * Get latest commit info
 */
function getLatestCommit(): CommitInfo | null {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const message = execFileSync('git', ['log', '-1', '--pretty=%s'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const timestamp = execFileSync('git', ['log', '-1', '--pretty=%cI'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim() || new Date().toISOString();

    return { sha, message, timestamp };
  } catch {
    return null;
  }
}

/**
 * Initialize progress file if needed
 */
function initProgressFile(progressFile: string, sessionId: string): void {
  if (!existsSync(progressFile)) {
    try {
      const lastSlash = progressFile.lastIndexOf('/');
      const dirPath = lastSlash > 0 ? progressFile.substring(0, lastSlash) : '.';
      mkdirSync(dirPath, { recursive: true });
      writeFileSync(progressFile, JSON.stringify({
        session_id: sessionId,
        issues: {},
      }));
    } catch {
      // Ignore init errors
    }
  }
}

/**
 * Add commit to issue progress queue
 */
function queueCommitProgress(
  issueNum: string,
  commit: CommitInfo,
  branch: string,
  progressFile: string,
  sessionId: string
): boolean {
  initProgressFile(progressFile, sessionId);

  try {
    const data: ProgressFile = JSON.parse(readFileSync(progressFile, 'utf8'));

    if (!data.issues[issueNum]) {
      data.issues[issueNum] = {
        commits: [],
        tasks_completed: [],
        pr_url: null,
        branch,
      };
    }

    data.issues[issueNum].commits.push(commit);
    data.issues[issueNum].branch = branch;

    writeFileSync(progressFile, JSON.stringify(data, null, 2));
    logHook('issue-progress-commenter', `Queued commit for issue #${issueNum}`);
    return true;
  } catch {
    logHook('issue-progress-commenter', `Error queuing commit for issue #${issueNum}`);
    return false;
  }
}

/**
 * Queue commit progress for GitHub issue updates
 */
export function issueProgressCommenter(input: HookInput, ctx?: HookContext): HookResult {
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

  (ctx?.log ?? logHook)('issue-progress-commenter', 'Processing git commit command...');

  // Check if gh CLI is available
  try {
    execFileSync('which', ['gh'], { stdio: 'ignore', timeout: 2000 });
  } catch {
    (ctx?.log ?? logHook)('issue-progress-commenter', 'gh CLI not available, skipping issue progress tracking');
    return outputSilentSuccess();
  }

  // Check if we're in a git repo with GitHub remote
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (!remote.includes('github')) {
      (ctx?.log ?? logHook)('issue-progress-commenter', 'Not a GitHub repository, skipping');
      return outputSilentSuccess();
    }
  } catch {
    return outputSilentSuccess();
  }

  // Get branch and commit info
  const branch = getCurrentBranch();
  if (!branch) {
    (ctx?.log ?? logHook)('issue-progress-commenter', 'Could not determine current branch');
    return outputSilentSuccess();
  }

  // Try to extract issue number
  let issueNum = extractIssueFromBranch(branch);

  // If not found in branch, try commit message
  if (!issueNum) {
    try {
      const commitMsg = execFileSync('git', ['log', '-1', '--pretty=%s'], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      issueNum = extractIssueFromCommit(commitMsg);
    } catch {
      // Ignore
    }
  }

  // If no issue number found, skip silently
  if (!issueNum) {
    (ctx?.log ?? logHook)('issue-progress-commenter', `No issue number found in branch '${branch}' or commit message`);
    return outputSilentSuccess();
  }

  (ctx?.log ?? logHook)('issue-progress-commenter', `Found issue #${issueNum}`);

  // Verify issue exists (quick check)
  try {
    execFileSync('gh', ['issue', 'view', issueNum, '--json', 'number'], { stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
  } catch {
    (ctx?.log ?? logHook)('issue-progress-commenter', `Issue #${issueNum} not found or not accessible`);
    return outputSilentSuccess();
  }

  // Get commit info and queue it
  const commit = getLatestCommit();
  if (!commit) {
    (ctx?.log ?? logHook)('issue-progress-commenter', 'Could not get commit info');
    return outputSilentSuccess();
  }

  // Sanitize session ID - prefer input.session_id, fallback to getSessionId()
  const sessionId = (input.session_id || (ctx?.sessionId ?? getSessionId())).replace(/[^a-zA-Z0-9_-]/g, '');
  const progressFile = `${getSessionTempDir(sessionId)}/issue-progress.json`;

  queueCommitProgress(issueNum, commit, branch, progressFile, sessionId);

  return outputSilentSuccess();
}
