---
name: dev
compatibility: "Claude Code 2.1.183+"
description: "One-command dev loop boot. Spins up portless (named HTTPS subdomain), emulate (stateful API mocks), the project's dev server, and an agent-browser session — all using the current git branch as the namespace key. Replaces the 4-terminal manual setup with a single `/ork:dev` invocation. Use when starting a new feature branch, switching worktrees, or returning to a project after a break. Skip silently when prerequisite binaries (portless, emulate, agent-browser) are missing — emits install hints."
argument-hint: "[start|stop|status] [--share|--funnel|--live H]"
tags: [dev-loop, portless, emulate, agent-browser, vercel-labs, lab-stack, m125, m127]
version: 1.1.0
author: OrchestKit
user-invocable: true
disable-model-invocation: false
complexity: medium
context: inherit
persuasion-type: guidance
metadata:
  category: devops
  milestone: M127
  upstream-packages: ["portless", "emulate", "agent-browser", "tailscale"]
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
| Share preview with stakeholder | `/ork:dev --share` (tailnet) or `/ork:dev --funnel` (public) |
| Time-boxed live demo | `/ork:dev --live 4` (public funnel, 4-hour expiry) |

> **Resuming a backgrounded dev session (CC 2.1.144+):** Sessions started via `claude --bg` now appear in `/resume` alongside interactive ones, marked `bg` — use `/resume` as the direct recovery path after a crash or session end instead of navigating the agent view.
>
> **Background shell sessions (CC 2.1.154+):** In `claude agents`, type `! <command>` to run a shell command as a backgrounded session you can attach to and detach from — also available as `claude --bg --exec '<command>'`. Useful for long dev-loop processes (watchers, builds, servers) you want to monitor without holding a terminal.

## Modes (M127)

| Flag | Wraps | Reach | Tailscale CLI |
|---|---|---|---|
| (none) | `portless <slug> <pkg-mgr> run dev` | `https://<branch>.localhost` only | not required |
| `--share` | `portless --tailscale ...` | tailnet members on `https://*.ts.net` | required |
| `--funnel` | `portless --funnel ...` | **public on the internet** | required |
| `--live N` | `portless --funnel ...` + N-hour expiry | **public**, tracked in `live-demos.jsonl` | required |

Tailscale is **optional** — required only behind `--share`/`--funnel`/`--live`. Default `/ork:dev` is unchanged for users who don't share.

When `turbo.json` or `package.json` workspaces is detected (#1562), the boot uses
**bare `portless`** (zero-config) which auto-discovers each workspace's dev
script and assigns subdomains via the task graph. State file shows `mode: "monorepo"`;
list subdomains via `portless list` or `/ork:dev status`.

## Boot sequence

`portless` is a **wrapper**, not a sidecar — `portless <slug> <pkg-mgr> run dev` is one fused command that owns the dev server's lifecycle. `boot.sh` tracks the wrapper PID; `stop.sh` walks its process tree to clean up children.

```
0. Detect package manager      pnpm > yarn > bun > npm   (lockfile-based)
1. Resolve subdomain slug      <branch> → lower → / to - → DNS-safe → ≤63 chars
2. portless proxy start         (idempotent — skipped if `portless list` already responds)
3. emulate --seed <yaml>        (sidecar, optional — only if emulate.config.yaml exists)
4. portless <slug> <pkg-mgr> run dev   (FUSED — wrapper owns dev server's lifecycle)
5. portless get <slug>          (poll up to 30s for the route to register)
6. wait-on <baseUrl>            (poll up to 30s for the dev server through the proxy)
7. AGENT_BROWSER_SESSION=<slug> agent-browser open <baseUrl>   (warm + register session)
8. atomic state write           (.claude/state/dev-stack.json via jq + temp + mv)
9. print summary
```

The full annotated walkthrough: `references/boot-sequence.md`.

## State file shape

```json
{
  "bootedAt": "2026-04-27T12:34:56Z",
  "branch": "feat/m125-lane-b",
  "subdomain": "feat-m125-lane-b.localhost",
  "baseUrl": "https://feat-m125-lane-b.localhost:1355",
  "mode": "single",
  "processes": {
    "portlessWrapper": {
      "pid": 86104,
      "command": "portless feat-m125-lane-b pnpm run dev"
    },
    "agentBrowser": { "sessionName": "feat-m125-lane-b" },
    "emulate":      { "pid": 86200, "command": "emulate --seed emulate.config.yaml" }
  },
  "emulators": ["github", "stripe"],
  "share": null,
  "notes": "portless proxy daemon is shared and not tracked here — stop.sh leaves it running."
}
```

When `--share` / `--funnel` / `--live` is used (M127 #1561 / #1565), `share` becomes:

```json
"share": {
  "mode": "tailscale",
  "tailscaleUrl": "https://app.your-tailnet.ts.net",
  "expiresAt": "2026-05-03T20:00:00Z"
}
```

`mode` is `"single"` (default) or `"monorepo"` (when `turbo.json`/workspaces detected). Note `portlessWrapper` (not `portless` + `devServer`) — portless owns the dev server. Full schema: `references/state-schema.md`.

## Auto-surfaced hints (M127)

When `/ork:dev` boots, it inspects `package.json` and emits hints:

- **`@json-render/*` detected** (#1560) → prints the devtools adapter import line so the inspector panel (Spec / State / Actions / Stream / Catalog / Pick) can be enabled in dev. Tree-shakes from production builds.
- **`@clerk/*` detected** (#1563) → if `clerk` is in `emulate.config.yaml`, prints the mock login URL (`http://localhost:4012`); otherwise warns to run `/ork:emulate-seed --auto`.

## Prerequisites + graceful no-op

```
$ /ork:dev
✓ portless     found
✓ agent-browser     found
✓ jq     found
[1] slug       feat-m125-lane-b

# OR with a missing prereq:
✗ portless not found.   Install: npm i -g portless

Skipping boot — install missing tools and re-run.
```

`portless`, `agent-browser`, and `jq` are required. `emulate` is **optional** — required only if `emulate.config.yaml` exists. The boot is all-or-nothing on the required set; with no emulate config the boot proceeds without emulators.

`CI=1` short-circuits the boot (exits 0 immediately).

## Status + teardown

```
$ /ork:dev status
ork:dev — feat/m125-lane-b
  ✓ portlessWrapper    portless feat-m125-lane-b pnpm run dev
  ✓ agentBrowser       feat-m125-lane-b
  base url:  https://feat-m125-lane-b.localhost:1355
  booted:    2026-04-27T19:36:54Z
  portless:  route registered ✓

$ /ork:dev stop
ork:dev — sending SIGTERM in reverse boot order…
  ✓ agent-browser session "feat-m125-lane-b" closed
  ✓ portless wrapper (pid 86104) + 21 descendant(s) stopped
Cleared .claude/state/dev-stack.json

Note: portless proxy daemon left running (shared). Run `portless proxy stop` if you really mean to stop the daemon.
```

Stop walks the wrapper's process tree (`pgrep -P` recursively) and SIGTERMs descendants leaves-first because portless doesn't always propagate signals cleanly. The portless proxy daemon itself is shared infrastructure and is **never killed** by `/ork:dev stop`.

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

## Scripts

| Script | What it does |
|---|---|
| `scripts/boot.sh` | All-or-nothing prereq check, then 9-step boot. Idempotent (no-ops if already live). Honors `CI=1` to skip in CI. |
| `scripts/stop.sh` | SIGTERM in reverse boot order with 5-second SIGKILL fallback. Removes state file last. |
| `scripts/status.sh` | Pretty status. `--quiet` for liveness-only (exit 0 live, 1 down). Used by boot for idempotency. |

`/ork:dev` invokes `scripts/boot.sh`; `stop` → `stop.sh`; `status` → `status.sh`. The shell scripts are the source of truth.

## References

| File | Purpose |
|---|---|
| `references/boot-sequence.md` | Step-by-step boot annotated with commands |
| `references/state-schema.md` | Full JSON shape + field semantics |

## Rules

| Rule | Impact | When it applies |
|---|---|---|
| `rules/lab-stack-prerequisites.md` | CRITICAL | Every boot |
| `rules/branch-named-subdomain.md` | HIGH | Subdomain resolution |
| `rules/idempotent-boot.md` | HIGH | Re-running while live |
| `rules/teardown-order.md` | MEDIUM | `stop` invocations |

## Running unattended with /goal

Set a completion condition with `/goal` (CC 2.1.139+) and this skill will keep working across turns until the condition is met. Works in interactive, `-p`, and Remote Control. The overlay panel shows live elapsed / turns / tokens.

**Example completion condition for this skill:**

```
/goal until services.running == 4
```

Stops when: all 4 dev-loop services (portless + emulate + dev-server + agent-browser) report healthy on their respective ports/sockets. Compatible with claude.ai Remote Control runs.

## Related skills

- `/ork:expect` — diff-aware browser tests; reuses the agent-browser session this skill warms
- `/ork:emulate-seed` — generates the emulator config that step 3 consumes
- `portless` (skill) — underlying tool docs
- `browser-tools` (skill) — agent-browser command reference
