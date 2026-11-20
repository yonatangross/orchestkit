import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gitLastModified } from "@/lib/git-last-modified";

// A shallow clone reports its oldest fetched commit as the change for every
// file nobody touched since. That is how 264 of 359 live sitemap URLs came to
// share 2026-11-12T07:24:17Z: the deploy build cloned with a limited depth and
// commit 56f73ec was the boundary. The helper must leave such files undated.
//
// The fixture repo is hermetic: it ignores the global and system git config so
// the test behaves the same on any machine and in CI.
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};

function git(cwd: string, args: string[], date?: string): string {
  return execFileSync("git", args, {
    cwd,
    env: date ? { ...env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : env,
    encoding: "utf8",
  });
}

let base: string;
let full: string;
let shallow: string;

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "git-lastmod-"));
  full = join(base, "full");
  shallow = join(base, "shallow");
  git(base, ["init", "-q", "-b", "main", full]);
  const days = ["2020-01-01T00:00:00Z", "2021-01-01T00:00:00Z", "2022-01-01T00:00:00Z"];
  ["a.txt", "b.txt", "c.txt"].forEach((name, i) => {
    writeFileSync(join(full, name), name);
    git(full, ["add", name]);
    git(full, ["commit", "-q", "-m", name], days[i]);
  });
  git(base, ["clone", "-q", "--depth", "2", `file://${full}`, shallow]);
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("gitLastModified", () => {
  it("dates every file from a full history", () => {
    const m = gitLastModified(full, ["."]);
    expect(m.get(join(full, "a.txt"))?.toISOString()).toBe("2020-01-01T00:00:00.000Z");
    expect(m.get(join(full, "b.txt"))?.toISOString()).toBe("2021-01-01T00:00:00.000Z");
    expect(m.get(join(full, "c.txt"))?.toISOString()).toBe("2022-01-01T00:00:00.000Z");
  });

  it("leaves files whose last commit is a shallow boundary undated", () => {
    const m = gitLastModified(shallow, ["."]);
    expect(m.get(join(shallow, "c.txt"))?.toISOString()).toBe("2022-01-01T00:00:00.000Z");
    // a.txt last changed in 2020, but the depth-2 clone only sees the 2021
    // boundary commit. Reporting 2021 would be a made-up date.
    expect(m.has(join(shallow, "a.txt"))).toBe(false);
    expect(m.has(join(shallow, "b.txt"))).toBe(false);
  });

  it("returns an empty map outside a git work tree", () => {
    expect(gitLastModified(tmpdir(), ["."]).size).toBe(0);
  });
});
