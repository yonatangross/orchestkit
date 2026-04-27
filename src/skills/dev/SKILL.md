---
name: dev
description: "One-command dev loop boot. Spins up portless (named HTTPS subdomain), emulate (stateful API mocks), the project's dev server, and an agent-browser session — all using the current git branch as the namespace key. Replaces the 4-terminal manual setup with a single `/ork:dev` invocation. Use when starting a new feature branch, switching worktrees, or returning to a project after a break. Skip silently when prerequisite binaries (portless, emulate, agent-browser) are missing — emits install hints."
tags: [dev-loop, portless, emulate, agent-browser, vercel-labs, lab-stack, m125]
version: 1.0.0
author: OrchestKit
user-invocable: true
disable-model-invocation: false
complexity: medium
context: inherit
persuasion-type: guidance
metadata:
  category: devops
  milestone: M125
  upstream-packages: ["portless", "emulate", "agent-browser"]
---

# /ork:dev — Lab-Stack Boot

One command boots the four moving parts of a Vercel-Labs-flavored dev loop:

1. **portless** → named HTTPS `https://<branch>.localhost` (no port collisions across worktrees)
2. **emulate** → stateful API emulators on the same origin via `@emulators/adapter-next`
3. **dev server** → `pnpm dev` / `npm run dev` / `yarn dev` (auto-detected)
4. **agent-browser** → pre-warmed session named after the branch

State lives in `.claude/state/dev-stack.json`. Teardown via `/ork:dev stop` reads the PIDs and signals SIGTERM in reverse boot order.

> **Paired with `/ork:expect`:** the agent-browser session that `/ork:dev` warms is the same one `/ork:expect` (and the M125 #2 auto-trigger) attach to — no second startup latency on the first UI test.

## When to invoke

| Situation | Command |
|---|---|
| Start work on a new branch | `/ork:dev` |
| Resume after a session break | `/ork:dev` (idempotent — skips already-live processes) |
| Tear down before deleting branch | `/ork:dev stop` |
| Inspect state | `/ork:dev status` |

## Boot sequence

The skill executes the steps below in strict order. Each step is a precondition for the next.

```
0. Detect package manager      pnpm > npm > yarn > bun  (read packageManager field, fall back to lockfile)
1. Resolve subdomain            <git branch slug>.localhost  (replace / with -, lowercase)
2. portless start --domain $SUBDOMAIN --tls --lan
3. emulate-seed --auto          (M125 #4 — only if emulators absent)
4. emulate up                   (services from auto-seed config)
5. <pkg-mgr> dev                (background; logs to .claude/state/dev.log)
6. wait-on https://$SUBDOMAIN   (TLS handshake confirms portless reachable)
7. agent-browser session start --name $SUBDOMAIN
8. write .claude/state/dev-stack.json with PIDs + subdomain
9. print summary table
```

For a worked example walking through each step on this repo, load `references/boot-sequence.md`.

## State file shape

```json
{
  "bootedAt": "2026-04-27T12:34:56Z",
  "branch": "feat/m125-lane-b",
  "subdomain": "feat-m125-lane-b.localhost",
  "baseUrl": "https://feat-m125-lane-b.localhost",
  "processes": {
    "portless":     { "pid": 12345, "command": "portless start --domain ..." },
    "emulate":      { "pid": 12346, "command": "emulate up" },
    "devServer":    { "pid": 12347, "command": "pnpm dev" },
    "agentBrowser": { "sessionName": "feat-m125-lane-b" }
  },
  "emulators": ["github", "stripe", "google-oauth"]
}
```

Full schema: `references/state-schema.md`.

## Prerequisites + graceful no-op

```
$ /ork:dev
✗ portless not found.   Install: npm i -g portless
✗ emulate not found.    Install: npm i -g emulate
✓ agent-browser  found  v0.26.0
✗ dev server     no `dev` script in package.json

Skipping boot — install missing tools and re-run.
```

The skill does **not** boot a partial stack. Either all 4 components are present or it exits 0 and prints install hints. Half-stacks confuse more than they help.

For non-Vercel projects (no portless/emulate), the skill suggests the closest analogues (e.g. `caddy` for HTTPS proxy) but does not auto-install them.

## Status + teardown

```
$ /ork:dev status
ork:dev — feat/m125-lane-b
  portless      pid 12345  https://feat-m125-lane-b.localhost   ✓ live
  emulate       pid 12346  3 services (github, stripe, google-oauth)  ✓ live
  dev server    pid 12347  next dev (port 3000)  ✓ live
  agent-browser session "feat-m125-lane-b"  ✓ connected
  Uptime: 2h 14m
  Booted from commit: ca73a6411

$ /ork:dev stop
Sending SIGTERM in reverse boot order…
  ✓ agent-browser session stopped
  ✓ next dev (pid 12347) stopped
  ✓ emulate (pid 12346) stopped
  ✓ portless (pid 12345) stopped
Cleared .claude/state/dev-stack.json
```

## Worktree behavior

Each git worktree gets its own subdomain — `feat-foo.localhost` and `feat-bar.localhost` coexist on the same machine. The state file lives under each worktree's `.claude/state/`, so `/ork:dev` from one worktree doesn't see the other's processes.

## Idempotency

Re-running `/ork:dev` while the stack is already live is a no-op:

```
$ /ork:dev
ork:dev — feat/m125-lane-b already running.
  https://feat-m125-lane-b.localhost  (uptime 2h 14m)
Run /ork:dev stop to tear down, or /ork:dev status for detail.
```

Liveness probe: `process.kill(pid, 0)` against each tracked PID. If any are dead, the skill prints which ones and offers to clean up state and reboot.

## How agent-browser composes

The session name **equals** the subdomain — agent-browser commands targeting that session don't need a `--session` flag if it's the only one connected:

```bash
agent-browser open "https://feat-m125-lane-b.localhost/dashboard"
# implicit session = "feat-m125-lane-b" because it's the only one
```

`/ork:expect` (M125 #2) reads the dev-stack state file and reuses this same session — no second handshake.

## Integration with /ork:expect (M125 #2)

When auto-expect fires after a `.tsx` edit, it:

1. Reads `.claude/state/dev-stack.json` to find the agent-browser session and base URL.
2. Computes the affected route from the file path (`app/dashboard/page.tsx` → `/dashboard`).
3. Drives agent-browser against `<baseUrl><route>` using the live session.
4. Records the ARIA snapshot to memory keyed by `(route, parentCommit)` (M125 #6).

If the dev stack isn't live, auto-expect skips silently — `/ork:dev` is the prerequisite, not a hard dep.

## When NOT to use

- **CI** — set `CI=1`; the skill exits 0 without booting.
- **Production deploys** — never; this is dev-loop only.
- **Non-Vercel-Labs stacks** — falls back to install hints; you can still run the underlying tools manually.
- **Inside a `tmux -CC` session** — agent-browser dashboard incompatible with iTerm2 tmux integration.

## References

| File | Purpose |
|---|---|
| `references/boot-sequence.md` | Step-by-step boot annotated with commands |
| `references/state-schema.md` | Full JSON shape + field semantics |

## Related skills

- `/ork:expect` — diff-aware browser tests; reuses the agent-browser session this skill warms
- `/ork:emulate-seed` — generates the emulator config that step 3 consumes
- `portless` (skill) — underlying tool docs
- `browser-tools` (skill) — agent-browser command reference
