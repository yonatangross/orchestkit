// Deepen a shallow clone before `next build`, so sitemap lastmod and the docs
// "last updated" dates come from real history.
//
// The deploy build clones with a limited depth. Its oldest fetched commit then
// looks like the last change of every file nobody touched since, which put
// 264 of 359 sitemap URLs on one date (2026-11-12T07:24:17Z, commit 56f73ec).
// The old build step ran `git fetch --unshallow 2>/dev/null || true`, which
// failed with no trace. This one tries origin, then the public repository
// URL, and prints what happened. It never fails the build: when the clone
// stays shallow, lib/git-last-modified.ts leaves boundary-dated pages without
// a lastmod instead of claiming a false date.
import { execFileSync } from "node:child_process";

const PUBLIC_URL = "https://github.com/yonatangross/orchestkit.git";

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

// git errors can echo a remote URL; drop any credentials in it before logging.
function firstLine(err) {
  const text = String(err?.stderr || err?.message || err);
  return text.split("\n")[0].replace(/\/\/[^/@\s]+@/g, "//***@");
}

let shallow;
try {
  shallow = git(["rev-parse", "--is-shallow-repository"]) === "true";
} catch {
  console.log("[git-unshallow] not a git work tree; sitemap lastmod will be omitted");
  process.exit(0);
}
if (!shallow) {
  console.log("[git-unshallow] full history present");
  process.exit(0);
}

for (const remote of ["origin", PUBLIC_URL]) {
  try {
    git(["fetch", "--unshallow", "--quiet", remote]);
    console.log(`[git-unshallow] full history fetched from ${remote === "origin" ? "origin" : PUBLIC_URL}`);
    process.exit(0);
  } catch (err) {
    console.warn(`[git-unshallow] fetch from ${remote === "origin" ? "origin" : PUBLIC_URL} failed: ${firstLine(err)}`);
  }
}
console.warn(
  "[git-unshallow] clone is still shallow; pages last changed before the clone boundary get no sitemap lastmod",
);
