/**
 * gh CLI wrapper for promote-lights.
 * Read-only calls only, using the operator's own auth.
 *
 * Commands used:
 * - gh pr list --base main --state open --json number,headRefName,headRefOid,title,labels
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
  headRefName?: string;
  labels?: Array<{ name: string } | string>;
}

/**
 * Promote PR matching.
 *
 * A real promote PR is an open PR with base main whose head is the
 * promote branch (dev by default, PROMOTE_HEAD when configured) or
 * which carries the promote label. Any other PR with base main is
 * ordinary work and must never match.
 */
export const DEFAULT_PROMOTE_HEAD = "dev";
export const PROMOTE_LABEL = "promote";

export function isPromotePR(pr: PRInfo, promoteHead: string = DEFAULT_PROMOTE_HEAD): boolean {
  if (pr.headRefName !== undefined && pr.headRefName === promoteHead) return true;
  const labels = pr.labels ?? [];
  return labels.some((label) => {
    const name = typeof label === "string" ? label : label.name;
    return name !== undefined && name.toLowerCase() === PROMOTE_LABEL;
  });
}

export interface PRDetails {
  headRefOid: string;
  state: string;
  mergeStateStatus: string;
  /** The PR's base branch; watch mode reads THIS branch's protection. */
  baseRefName?: string;
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
