---
title: "Browser Tools: the OrchestKit delta over agent-browser"
tags: [browser, security, sandbox, delta]
---

# OrchestKit delta: agent-browser

Commands, flags, snapshot and ref loops, Electron CDP attach, Slack navigation,
Vercel Sandbox wiring and the dogfood report workflow are upstream's job. See
the "Upstream coverage (do not restate)" table in `SKILL.md` for where each of
those lives. This file carries only what OrchestKit adds, contradicts, or has
to warn about.

## Nothing checks agent-browser any more: the rules are yours to follow

Why: the `agent-browser-safety` PreToolUse hook was retired on 2026-08-31
(#3835 purge wave 1). It never saw the MCP path (`--mcp`) or a Vercel Sandbox
run anyway. Nothing in OrchestKit now blocks a URL, counts requests or reads
robots.txt. The only enforced URL policy is the Claude Code sandbox network
allow list, and only when the operator turns it on (`sandbox.enabled` plus
`network.allowedDomains` in `.claude/settings.json`). It does not see the pages
a remote provider or a Vercel Sandbox microVM loads.
Upstream: `vercel:vercel-sandbox` skill, and
https://github.com/vercel-labs/agent-browser/blob/main/skill-data/vercel-sandbox/SKILL.md

## Windows (Git Bash) and piping: never pipe a command that may start the daemon

Why: reported in https://github.com/yonatangross/orchestkit/issues/5289 from a
native Windows desk running the Bash tool under Git Bash. An `agent-browser`
command that has to start the daemon (the first `open`, `snapshot` or
`screenshot` of a session, or any command after the daemon died) can hang
forever when its output is piped, for example `agent-browser open "$URL" 2>&1 |
tail -3`. The reported cause: the daemon is spawned from that command, inherits
the pipe's write end and keeps it open, so `tail` never sees end of file.
`timeout` does not help, because the pipe is still held after the command
itself ended.

Do this instead, whichever shell you are in:

```bash
agent-browser open "$URL" > ab.out 2>&1 < /dev/null; tail -c 300 ab.out
```

or start the daemon in a call of its own first (a bare `agent-browser open
about:blank`, no pipe), then pipe later commands freely. Redirect to a file and
read the file; do not use `| tail`, `| head`, `| grep` or `| jq` on the first
command of a session.

Scope, so nobody over-reads this note:
- It is written for native Windows with Git Bash. Claude Code uses Git Bash as
  the Bash tool only when Git for Windows is installed; otherwise PowerShell is
  the shell tool, and WSL is Linux. Source: https://code.claude.com/docs/en/setup
  (native Windows, Git for Windows and WSL sections).
- Not tested: PowerShell, WSL, and Windows itself. The hang is taken from the
  issue report; OrchestKit has not reproduced it, and the redirect form has not
  been run on Windows. A macOS or Linux run is not a Windows run.
- On macOS and Linux the redirect form is never worse than a pipe, so the same
  rule applies there.
Upstream: https://github.com/vercel-labs/agent-browser (the daemon spawn is its
code; this note is a workaround, not a fix).

## Pace requests per host across every session, by hand

Why: parallel sessions, worktrees and sub-agents can hit the same host at
once, and no limiter adds them up. A page-by-page sweep of one host (the
upstream dogfood workflow) should wait between navigations and stop on a 429
or a block page instead of retrying into it. See
`rules/browser-scraping-ethics.md` for the pacing rule.
Upstream: `dogfood` skill, and
https://github.com/vercel-labs/agent-browser/blob/main/skill-data/dogfood/SKILL.md

## Local targets: name them with portless, not a port

Why: a named `https://<app>.localhost` from portless survives a port change
and tells the next reader which app was under test. Nothing in OrchestKit blocks
local URLs. With the sandbox network allow list on, add the local host names
you use to `allowedDomains`. (Electron and desktop CDP attach carry no URL, so
a URL allow list does not apply to them.)
Upstream: `ork-extras:portless` skill, and https://github.com/vercel-labs/portless

## Keep page-derived output targeted, verified, and out of the repo

Why: house convention behind the anti-pattern list in `SKILL.md`. Extract
through a ref (`get text @e5`) rather than dumping `get text body`, confirm the
result is non-empty before saving it (a blank capture looks like a successful
one), and treat HAR captures, React fiber dumps and traces as credential
bearing: write them under /tmp and never `git add` them. Distilled from the
retired browser-snapshot-workflow rule; no traced incident.
Upstream: `agent-browser` skill (snapshot, get, network har, react commands), and
https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md
