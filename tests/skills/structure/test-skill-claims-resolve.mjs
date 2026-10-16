#!/usr/bin/env node
// ============================================================================
// Skill claims must resolve (agents-skills-audit-2026-10-15, rows B5 to B8)
// ============================================================================
// Four ways a skill told the reader something the installed plugin cannot do:
//   B8  a relative `../` reference that resolves to no file
//   B7  doctor tells the model to read shared/cc-support.json, which the
//       build never copied into plugins/ork/shared/
//   B5  remember promises a zero-config memory graph, while ork ships no
//       .mcp.json and no memory server
//   B6  browser-tools promises URL blocklisting, rate limiting and robots.txt
//       enforcement, and documents env vars, after the hook that read them was
//       retired on 2026-08-31 (#3835)
// Each check reads the source tree only; no network, no build.
// ============================================================================
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SKILLS = join(ROOT, "src/skills");
const failures = [];
let checks = 0;
const check = (ok, msg) => {
  checks += 1;
  if (!ok) failures.push(msg);
};
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// B8: every backticked relative path with ../ in a SKILL.md resolves
let relRefs = 0;
for (const name of readdirSync(SKILLS)) {
  const file = join(SKILLS, name, "SKILL.md");
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/`([^`\s]*\.\.\/[^`\s]*\.(?:md|json|sh|mjs|py))`/g)) {
    const ref = m[1];
    if (ref.startsWith("http") || ref.startsWith("$")) continue;
    relRefs += 1;
    check(
      existsSync(normalize(join(SKILLS, name, ref))),
      `B8 ${name}/SKILL.md: relative reference does not resolve: ${ref}`,
    );
  }
}
check(relRefs > 0, "B8 scan found no relative references at all (scan is blind)");

// B7: doctor's single source must ship in the built plugin
const doctor = read("src/skills/doctor/SKILL.md");
if (doctor.includes("shared/cc-support.json")) {
  const built = join(ROOT, "plugins/ork/shared/cc-support.json");
  check(existsSync(built), "B7 doctor reads shared/cc-support.json but plugins/ork/shared/cc-support.json is missing");
  if (existsSync(built)) {
    check(
      readFileSync(built, "utf8") === read("shared/cc-support.json"),
      "B7 plugins/ork/shared/cc-support.json differs from shared/cc-support.json (rebuild)",
    );
  }
  check(
    /cc-support\.json/.test(read("scripts/build-plugins.sh")),
    "B7 scripts/build-plugins.sh never copies shared/cc-support.json into the plugin",
  );
}

// B5: no zero-config promise for a server the plugin does not ship
const remember = read("src/skills/remember/SKILL.md");
const shipsMemoryServer =
  existsSync(join(ROOT, "plugins/ork/.mcp.json")) &&
  /"memory"\s*:/.test(readFileSync(join(ROOT, "plugins/ork/.mcp.json"), "utf8"));
if (!shipsMemoryServer && /mcp__memory__/.test(remember)) {
  for (const phrase of [/zero-config/i, /always works/i, /works out of the box/i, /zero configuration required/i]) {
    check(!phrase.test(remember), `B5 remember promises "${phrase.source}" but ork ships no memory MCP server`);
  }
}

// B6: browser-tools claims only what something still enforces
const bt = read("src/skills/browser-tools/SKILL.md");
const desc = (bt.match(/^description:\s*(.*)$/m) || [, ""])[1];
for (const claim of [/blocklist/i, /rate limit/i, /robots\.txt enforcement/i]) {
  check(!claim.test(desc), `B6 browser-tools description claims "${claim.source}" with no hook enforcing it`);
}
// Env vars the upstream agent-browser CLI reads (agent-browser 0.39.1 --help).
const UPSTREAM = new Set(["AGENT_BROWSER_CONFIRM", "AGENT_BROWSER_IDLE_TIMEOUT_MS", "AGENT_BROWSER_ENGINE"]);
const srcHooks = join(ROOT, "src/hooks/src");
const hookText = existsSync(srcHooks)
  ? readdirSync(srcHooks, { recursive: true })
      .filter((f) => String(f).endsWith(".ts"))
      .map((f) => readFileSync(join(srcHooks, String(f)), "utf8"))
      .join("\n")
  : "";
for (const m of bt.matchAll(/^\|\s*`((?:ORCHESTKIT_)?AGENT_BROWSER_[A-Z_]+)`/gm)) {
  const v = m[1];
  check(UPSTREAM.has(v) || hookText.includes(v), `B6 browser-tools documents ${v}, which nothing reads`);
}

// B6, body: no line in the skill, its references or its rules says a hook still acts.
// The agent-browser-safety hook was retired 2026-08-31 (#3835). "hook" alone (React
// hooks, webhooks) is not a claim.
const RETIRED_VARS = [
  "AGENT_BROWSER_RATE_LIMIT_PER_MIN",
  "AGENT_BROWSER_RATE_LIMIT_PER_HOUR",
  "AGENT_BROWSER_BURST_LIMIT",
  "AGENT_BROWSER_ROBOTS_CACHE_TTL",
  "AGENT_BROWSER_IGNORE_ROBOTS",
  "ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST",
];
const btDir = join(SKILLS, "browser-tools");
const btFiles = ["SKILL.md"];
for (const sub of ["references", "rules"]) {
  if (existsSync(join(btDir, sub))) {
    for (const f of readdirSync(join(btDir, sub))) if (f.endsWith(".md")) btFiles.push(`${sub}/${f}`);
  }
}
// A hook doing something is a claim even next to the word "retired"; naming the hook
// ("the safety hook", "the hook") is only a claim when the line does not say it is retired.
const HOOK_ACTS =
  /\bhook(?:'s)? (?:treats|pipes|warns|still|allows|flags|checks|blocks|enforces|reads|applies|covers|url|rate|robots)\b|[,|] hook warns/i;
const HOOK_NAMED = /\b(?:safety[- ]hook|the hook|by the hook)\b/i;
const RETIRED = /retired/i;
// A retired variable may be named as history, never as something to set.
const VAR_USE = /\b(?:set|raise|export|increase|configure|use)\b/i;
// Automatic checks claimed without the word hook ("transcripts go through same safety checks").
const AUTO_CHECKS = /\b(?:go(?:es)?|pass(?:es)?|piped?|routed?) through (?:the )?same\b[^|.]*\bchecks?\b|\bsame (?:safety|url\/rate\/robots) checks\b/i;
const hookClaim = (line) =>
  HOOK_ACTS.test(line) || AUTO_CHECKS.test(line) || (!RETIRED.test(line) && HOOK_NAMED.test(line));
const varClaims = (line) =>
  RETIRED.test(line) && !VAR_USE.test(line) ? [] : RETIRED_VARS.filter((name) => line.includes(name));

// Planted lines: the word "retired" must not excuse a claim made in the same line.
for (const [line, want] of [
  ["The safety hook was retired 2026-08-31, but the hook still checks robots.txt.", true],
  ["Retired in August; the hook enforces the per-host rate limit.", true],
  ["The hook enforces robots.txt and is not retired.", true],
  ["| `chat` (single-shot / REPL) | v0.25 | NL driving; transcripts go through same safety checks |", true],
  ["The `agent-browser-safety` hook was retired 2026-08-31 and did nothing after that.", false],
  ["Nothing in OrchestKit blocks local URLs.", false],
  ["React DevTools integration via a vendored MIT-licensed hook embedded in the binary.", false],
]) {
  check(hookClaim(line) === want, `B6 classifier: hookClaim(${JSON.stringify(line)}) should be ${want}`);
}
for (const [line, want] of [
  ["The hook was retired; raise `AGENT_BROWSER_RATE_LIMIT_PER_MIN` if a sweep is blocked.", 1],
  ["The rate-limit variables were read by the hook, retired 2026-08-31, and did nothing after that.", 0],
]) {
  check(varClaims(line).length === want, `B6 classifier: varClaims(${JSON.stringify(line)}) should find ${want}`);
}

for (const f of btFiles) {
  readFileSync(join(btDir, f), "utf8")
    .split("\n")
    .forEach((line, i) => {
      check(!hookClaim(line), `B6 browser-tools/${f}:${i + 1} says the retired safety hook still acts`);
      for (const v of varClaims(line)) {
        check(false, `B6 browser-tools/${f}:${i + 1} documents ${v}, which nothing reads since the hook was retired`);
      }
    });
}

if (failures.length) {
  console.error(`FAIL test-skill-claims-resolve: ${failures.length} of ${checks} checks`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS test-skill-claims-resolve: ${checks} checks (${relRefs} relative references)`);
