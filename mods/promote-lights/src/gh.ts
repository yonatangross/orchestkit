/**
 * gh CLI wrapper for promote-lights.
 * Read-only calls only, using the operator's own auth.
 *
 * Commands used:
 * - gh pr list --base <base> --state open --json number,headRefName,headRefOid,title,labels,baseRefName
 * - gh pr list with a head filter for the promote branch (none for a head pattern ending in *)
 * - gh pr list with a label filter for the promote label
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
  /** The PR's own base; discovery tracks THIS base, not the one it queried. */
  baseRefName?: string;
  labels?: Array<{ name: string } | string>;
}

/**
 * Promote PR matching.
 *
 * A real promote PR is an open PR into a promote base (main by default,
 * PROMOTE_BASE when configured) whose head is the promote branch (dev by
 * default, PROMOTE_HEAD when configured, a trailing * is a prefix) or
 * which carries the promote label. Any other PR into that base is
 * ordinary work and must never match.
 */
export const DEFAULT_PROMOTE_HEAD = "dev";
/** The promote base: main unless PROMOTE_BASE names another (a dev, qa, main flow). */
export const DEFAULT_PROMOTE_BASE = "main";
export const PROMOTE_LABEL = "promote";

/**
 * PROMOTE_BASE may list several bases ("qa,main"), tried in order.
 * Empty or missing falls back to the default.
 */
export function parseBases(raw: string | undefined): string[] {
  const bases = (raw ?? "").split(",").map((b) => b.trim()).filter((b) => b !== "");
  return bases.length > 0 ? bases : [DEFAULT_PROMOTE_BASE];
}

/** A trailing * makes the pattern a prefix ("release/*"); anything else is exact. */
export function headMatches(headRefName: string, pattern: string): boolean {
  return pattern.endsWith("*") ? headRefName.startsWith(pattern.slice(0, -1)) : headRefName === pattern;
}

/**
 * Fields requested from the PR list endpoint.
 */
export const PR_LIST_FIELDS = "number,headRefName,headRefOid,title,labels,baseRefName";

/**
 * Page size for the filtered PR list queries. Each query is narrowed
 * server side (one by head branch, one by label) so promote PRs are
 * returned even when the repo has more open PRs than the gh default
 * page of 30. Without the filters a promote PR past position 30 is
 * silently missed.
 */
export const PR_LIST_LIMIT = "100";

/**
 * Query argv listing open PRs into the promote base from the promote branch.
 * gh --head is an exact name, so a pattern ending in * drops it and lists
 * the base's open PRs; the caller matches the prefix client side.
 */
export function buildHeadQueryArgs(
  promoteHead: string = DEFAULT_PROMOTE_HEAD,
  promoteBase: string = DEFAULT_PROMOTE_BASE
): readonly string[] {
  return [
    "gh",
    "pr",
    "list",
    "--base",
    promoteBase,
    ...(promoteHead.endsWith("*") ? [] : ["--head", promoteHead]),
    "--state",
    "open",
    "--json",
    PR_LIST_FIELDS,
    "--limit",
    PR_LIST_LIMIT,
  ];
}

/**
 * Query argv listing open PRs into the promote base carrying the promote label.
 * This covers promote PRs raised from a head other than the promote
 * branch, which the head query alone would miss.
 */
export function buildLabelQueryArgs(promoteBase: string = DEFAULT_PROMOTE_BASE): readonly string[] {
  return [
    "gh",
    "pr",
    "list",
    "--base",
    promoteBase,
    "--label",
    PROMOTE_LABEL,
    "--state",
    "open",
    "--json",
    PR_LIST_FIELDS,
    "--limit",
    PR_LIST_LIMIT,
  ];
}

/**
 * Merge PR list pages, deduped by PR number. Either query can return
 * the same PR (a dev head PR that also carries the label), so the
 * first occurrence wins.
 */
export function mergePRLists(...lists: PRInfo[][]): PRInfo[] {
  const seen = new Map<number, PRInfo>();
  for (const list of lists) {
    for (const pr of list) {
      if (!seen.has(pr.number)) seen.set(pr.number, pr);
    }
  }
  return [...seen.values()];
}

export function isPromotePR(pr: PRInfo, promoteHead: string = DEFAULT_PROMOTE_HEAD): boolean {
  if (pr.headRefName !== undefined && headMatches(pr.headRefName, promoteHead)) return true;
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
