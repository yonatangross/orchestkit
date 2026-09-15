/**
 * gh CLI wrapper for promote-lights.
 * Read-only calls only, using the operator's own auth.
 *
 * Commands used:
 * - gh pr list --base main --state open --json number,headRefOid,title
 * - gh api repos/{owner}/{repo}/branches/main/protection
 * - gh api repos/{owner}/{repo}/rules/branches/main
 * - gh api repos/{owner}/{repo}/commits/{head}/check-runs?per_page=100
 * - gh api repos/{owner}/{repo}/commits/{head}/status
 * - gh pr view N --json headRefOid,state,mergeStateStatus
 *
 * Also reads .github/branch-protection.json via fs.
 */

export interface PRInfo {
  number: number;
  headRefOid: string;
  title: string;
}

export interface PRDetails {
  headRefOid: string;
  state: string;
  mergeStateStatus: string;
}

export interface CheckRunsResponse {
  total_count: number;
  check_runs: Array<{
    name: string;
    status: string;
    conclusion: string | null;
  }>;
}

export interface StatusResponse {
  statuses: Array<{
    context: string;
    state: string;
  }>;
}

/**
 * Parse PR list JSON output.
 */
export function parsePRList(stdout: string): PRInfo[] {
  if (!stdout.trim()) return [];
  try {
    return JSON.parse(stdout);
  } catch {
    return [];
  }
}

/**
 * Parse PR view JSON output.
 */
export function parsePRView(stdout: string): PRDetails | null {
  if (!stdout.trim()) return null;
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

/**
 * Parse check-runs API response.
 */
export function parseCheckRuns(body: string): CheckRunsResponse {
  try {
    return JSON.parse(body);
  } catch {
    return { total_count: 0, check_runs: [] };
  }
}

/**
 * Parse status API response.
 */
export function parseStatus(body: string): StatusResponse {
  try {
    return JSON.parse(body);
  } catch {
    return { statuses: [] };
  }
}

/**
 * Parse .github/branch-protection.json.
 */
export function parseBranchProtectionConfig(content: string): {
  dev?: string[];
  main?: string[];
} | null {
  if (!content.trim()) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
