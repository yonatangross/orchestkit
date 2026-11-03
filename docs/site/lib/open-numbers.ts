import { COUNTS, SITE } from "@/lib/constants";

/**
 * Numbers for the public /open page (DRAFT). Only numbers with a public
 * source: build-time catalog counts, and two GitHub API reads cached for an
 * hour. A number with no public record is a placeholder, never a guess.
 */

const REPO = "yonatangross/orchestkit";
const GH_HEADERS = { Accept: "application/vnd.github+json" } as const;

type FetchLike = (input: string, init?: RequestInit & { next?: { revalidate: number } }) => Promise<Response>;

async function readNumber(
  url: string,
  pick: (data: Record<string, unknown>) => unknown,
  fetchImpl: FetchLike,
): Promise<number | null> {
  try {
    const res = await fetchImpl(url, { next: { revalidate: 3600 }, headers: GH_HEADERS });
    if (!res.ok) return null;
    const value = pick((await res.json()) as Record<string, unknown>);
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function fetchStars(fetchImpl: FetchLike = fetch): Promise<number | null> {
  return readNumber(`https://api.github.com/repos/${REPO}`, (d) => d.stargazers_count, fetchImpl);
}

export function fetchMergedPrs(fetchImpl: FetchLike = fetch): Promise<number | null> {
  const q = encodeURIComponent(`repo:${REPO} is:pr is:merged`);
  return readNumber(`https://api.github.com/search/issues?q=${q}&per_page=1`, (d) => d.total_count, fetchImpl);
}

export type OpenRow = {
  label: string;
  /** null = live read failed, shown as "?". A string = placeholder text. */
  value: number | string | null;
  source: string;
};

export const OPEN_PLACEHOLDER = "[PLACEHOLDER]";

export function openRows(live: { stars: number | null; mergedPrs: number | null }): OpenRow[] {
  return [
    { label: "GitHub stars", value: live.stars, source: "GitHub API, hourly" },
    { label: "Merged pull requests", value: live.mergedPrs, source: "GitHub search API, hourly" },
    { label: "Skills", value: COUNTS.skills, source: "plugin manifest, at build" },
    { label: "Agents", value: COUNTS.agents, source: "plugin manifest, at build" },
    { label: "Hooks", value: COUNTS.hooks, source: "plugin manifest, at build" },
    { label: "Current version", value: `v${SITE.version}`, source: "plugin manifest, at build" },
    { label: "Installs", value: OPEN_PLACEHOLDER, source: "no public source yet" },
    { label: "Cost to run per month", value: OPEN_PLACEHOLDER, source: "needs Yonatan's figure" },
  ];
}

export function formatOpenValue(value: OpenRow["value"]): string {
  if (value === null) return "?";
  return typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : value;
}
