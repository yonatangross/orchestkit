---
title: "Browser Tools: the OrchestKit delta over agent-browser"
tags: [browser, security, hook, delta]
---

# OrchestKit delta: agent-browser

Commands, flags, snapshot and ref loops, Electron CDP attach, Slack navigation,
Vercel Sandbox wiring and the dogfood report workflow are upstream's job. See
the "Upstream coverage (do not restate)" table in `SKILL.md` for where each of
those lives. This file carries only what OrchestKit adds, contradicts, or has
to warn about.

## Assume ZERO safety-hook coverage for any agent-browser run that is not a local Bash command

Why: `src/hooks/src/pretool/bash/agent-browser-safety.ts:471` returns silently
unless the Bash command string matches `agent-browser`. A Vercel Sandbox run
executes the CLI inside the microVM via `sandbox.runCommand(...)`, and `--mcp`
speaks stdio to an MCP client, so neither ever reaches the PreToolUse Bash hook.
URL blocklist, rate limiting and robots.txt enforcement are all absent on those
paths and have to be re-imposed at the sandbox or MCP-client layer. Distilled
from the retired upstream-sandbox reference; no traced incident.
Upstream: `vercel:vercel-sandbox` skill, and
https://github.com/vercel-labs/agent-browser/blob/main/skill-data/vercel-sandbox/SKILL.md

## Reach a new origin with open, goto or navigate if you want it policed

Why: `extractUrl` (same hook file, lines 417-420) matches only
`(navigate|goto|open) <url>`, and the blocklist, rate-limit and robots checks
(lines 489-544) each early-exit when it returns null. So `read <url>`,
`a11y <url>`, `vitals <url>`, `diff url <a> <b>`, `connect <port>` and
`--cdp <port>` skip all three checks: they are policy holes, not approvals.
Distilled from the retired browser-snapshot-workflow rule; no traced
incident.
Upstream: `agent-browser` skill, and
https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md

## Budget navigations per host: the rate limiter is machine-wide, not per session

Why: house limits are 10 per minute, 100 per hour and 3 per 3 seconds per
hostname (issue #318, "Add rate limiting to agent-browser-safety hook"), and
`checkRateLimit` persists timestamps to one `rate-limits.json` under the log
dir keyed only by domain (hook lines 122-215). Parallel sessions, worktrees and
sub-agents therefore draw from the same budget, and a page-by-page sweep of a
single host (the upstream dogfood workflow) hits the per-minute wall long
before it finishes. Raise `AGENT_BROWSER_RATE_LIMIT_PER_MIN` and
`AGENT_BROWSER_RATE_LIMIT_PER_HOUR` deliberately instead of retrying into a
block.
Upstream: `dogfood` skill, and
https://github.com/vercel-labs/agent-browser/blob/main/skill-data/dogfood/SKILL.md

## Local targets are allowed by default; name them with portless, not a port

Why: `ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST` defaults to on and clears
`localhost`, `127.0.0.1` and `*.localhost` before the blocklist runs (hook
lines 431-437, introduced by commit 48ab54b64, PR #950, the v7.1.0 agent-browser
CLI adoption). Local dev URLs therefore work out of the box, and setting the
variable to `0` re-blocks every one of them at once. (Electron and desktop CDP
attach are unaffected either way: `connect <port>` carries no URL to check.) A named
`https://<app>.localhost` from portless survives a port change and tells the
next reader which app was under test.
Upstream: `ork:portless` skill, and https://github.com/vercel-labs/portless

## Keep page-derived output targeted, verified, and out of the repo

Why: house convention behind the anti-pattern list in `SKILL.md`. Extract
through a ref (`get text @e5`) rather than dumping `get text body`, confirm the
result is non-empty before saving it (a blank capture looks like a successful
one), and treat HAR captures, React fiber dumps and traces as credential
bearing: write them under /tmp and never `git add` them. Distilled from the
retired browser-snapshot-workflow rule; no traced incident.
Upstream: `agent-browser` skill (snapshot, get, network har, react commands), and
https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md
