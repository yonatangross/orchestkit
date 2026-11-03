import { describe, expect, it } from "vitest";
import { COUNTS } from "@/lib/constants";
import { OPEN_PLACEHOLDER, fetchMergedPrs, fetchStars, formatOpenValue, openRows } from "@/lib/open-numbers";

const ok = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200 });

describe("open numbers", () => {
  it("reads stars and merged PR totals from the GitHub API", async () => {
    expect(await fetchStars(ok({ stargazers_count: 1234 }))).toBe(1234);
    expect(await fetchMergedPrs(ok({ total_count: 4321 }))).toBe(4321);
  });

  it("returns null (shown as ?) on an error status, a bad body, or a throw", async () => {
    expect(await fetchStars(async () => new Response("rate limited", { status: 403 }))).toBeNull();
    expect(await fetchStars(ok({ stargazers_count: "many" }))).toBeNull();
    expect(
      await fetchMergedPrs(async () => {
        throw new Error("offline");
      }),
    ).toBeNull();
    expect(formatOpenValue(null)).toBe("?");
  });

  it("asks the search API for merged PRs of this repo only", async () => {
    let seen = "";
    await fetchMergedPrs(async (url) => {
      seen = url;
      return new Response(JSON.stringify({ total_count: 1 }));
    });
    expect(decodeURIComponent(seen)).toContain("repo:yonatangross/orchestkit is:pr is:merged");
  });

  it("uses the build-time catalog counts and placeholders, never an invented number", () => {
    const rows = openRows({ stars: 10, mergedPrs: 20 });
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(byLabel.Skills).toBe(COUNTS.skills);
    expect(byLabel.Agents).toBe(COUNTS.agents);
    expect(byLabel.Hooks).toBe(COUNTS.hooks);
    expect(byLabel.Installs).toBe(OPEN_PLACEHOLDER);
    expect(byLabel["Cost to run per month"]).toBe(OPEN_PLACEHOLDER);
  });

  it("formats numbers with thousands separators", () => {
    expect(formatOpenValue(12345)).toBe("12,345");
  });
});
