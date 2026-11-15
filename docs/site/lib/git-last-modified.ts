import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { posix, resolve, sep } from "node:path";

// Build-time only (node:child_process): the sitemap reads each URL's real
// change date from git once, instead of stamping the build time.
//
// A shallow clone reports its oldest fetched commit (the shallow boundary) as
// the change for every file nobody touched since. That is how 264 of 359 live
// sitemap URLs came to share 2026-11-12T07:24:17Z (commit 56f73ec was the
// boundary of the deploy clone). A file whose newest visible commit is a
// boundary has no known date, so it is left out of the map and the caller
// omits lastmod for it rather than claim a date that is not real.

function run(cwd: string, args: string[]): string {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function shallowBoundaries(cwd: string): Set<string> {
  const gitPath = run(cwd, ["rev-parse", "--git-path", "shallow"]).trim();
  const file = resolve(cwd, gitPath);
  if (!existsSync(file)) return new Set();
  return new Set(
    readFileSync(file, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );
}

/**
 * Last commit date of every file under `paths` (relative to `cwd`), keyed by
 * absolute path. Empty outside a git work tree. Files whose newest visible
 * commit is a shallow boundary are absent.
 */
export function gitLastModified(cwd: string, paths: readonly string[]): Map<string, Date> {
  const dates = new Map<string, Date>();
  // git prints paths relative to the work tree root; key them by `cwd` so
  // callers can join their own paths without resolving symlinks.
  let prefix: string;
  let log: string;
  let boundaries: Set<string>;
  try {
    prefix = run(cwd, ["rev-parse", "--show-prefix"]).trim().replace(/\/$/, "");
    boundaries = shallowBoundaries(cwd);
    log = run(cwd, ["log", "--no-renames", "--format=%x1e%H %cI", "--name-only", "--", ...paths]);
  } catch {
    return dates;
  }
  const seen = new Set<string>();
  for (const chunk of log.split("\x1e")) {
    const [head, ...files] = chunk.split("\n");
    const space = head.indexOf(" ");
    if (space < 0) continue;
    const sha = head.slice(0, space);
    const when = new Date(head.slice(space + 1));
    const known = !boundaries.has(sha) && !Number.isNaN(when.getTime());
    for (const f of files) {
      if (!f || seen.has(f)) continue;
      seen.add(f);
      if (known) dates.set(resolve(cwd, posix.relative(prefix, f)), when);
    }
  }
  return dates;
}

/** Newest date among `dates` for files at or under `absPath`. */
export function newestUnder(dates: Map<string, Date>, absPath: string): Date | undefined {
  const prefix = absPath.endsWith(sep) ? absPath : absPath + sep;
  let newest: Date | undefined;
  for (const [file, when] of dates) {
    if (file !== absPath && !file.startsWith(prefix)) continue;
    if (!newest || when > newest) newest = when;
  }
  return newest;
}
