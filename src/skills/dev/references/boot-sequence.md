# /ork:dev boot sequence — annotated walkthrough

Verified against real CLI surfaces (2026-04-27): `portless 0.10.x`, `emulate 0.4.x`, `agent-browser 0.25.x+`. The actual implementation lives at `scripts/boot.sh` — this doc explains *why* each step does what it does.

## Architecture

`portless` is a **wrapper**, not a sidecar: `portless <name> <cmd>` spawns `<cmd>` with `PORT=<auto>`, registers `https://<name>.localhost` against the portless proxy, and tears down the route when `<cmd>` exits. The `boot.sh` script runs `portless <slug> <pkg-mgr> run dev` as a single fused process and tracks the portless wrapper PID.

```
   ┌──────────────── shared, long-lived ───────────────┐
   │                                                    │
   │   portless proxy daemon  (HTTPS, port 443 or       │
   │                           custom -p, may already   │
   │                           be running for other     │
   │                           apps — never killed by   │
   │                           this script)             │
   │                                                    │
   └──────────────────┬─────────────────────────────────┘
                      │ TCP
                      ▼
        ┌─────────────────────────────────┐
        │  portless <slug> <pkg> run dev  │  ← wrap_pid (we track this)
        │  (forks the dev server with     │
        │   PORT=auto, registers route    │
        │   <slug>.localhost in the       │
        │   proxy)                        │
        └─────────────┬───────────────────┘
                      │ fork
                      ▼
              ┌───────────────┐
              │  next dev /    │  ← child of portless,
              │  vite / etc.   │    auto-killed by stop.sh's
              │  (random port  │    pgrep -P walk
              │   in 4000-4999)│
              └────────────────┘

   sidecars (independent, optional):
   ┌────────────────────────────────────────┐
   │  emulate --seed emulate.config.yaml    │  ← only if config present
   │  (sidecar, NOT wrapped in portless)    │
   └────────────────────────────────────────┘
```

## Step 0 — detect package manager

| Signal | Manager |
|---|---|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `bun.lockb` | bun |
| (else) | npm |

## Step 1 — resolve subdomain slug

```
git rev-parse --abbrev-ref HEAD                # feat/m125-lane-b
| tr '[:upper:]' '[:lower:]'
| tr '/' '-'                                    # feat-m125-lane-b
| tr -cd 'a-z0-9-'
| cut -c1-63                                    # DNS label limit
```

Detached HEAD → falls back to `dev`. No git repo → also `dev`.

## Step 2 — `portless proxy start`

```bash
portless list >/dev/null 2>&1 || portless proxy start
```

The proxy daemon is shared. If it's already running, leave it alone — don't pass `--lan` or `--no-tls` flags that would conflict with the existing settings (`portless` rejects starts with mismatched flags). Only start it if `portless list` fails.

The user is responsible for the proxy's flavor (TLS on/off, LAN mode, custom port). `boot.sh` only ensures it's *running*.

### Why no `portless start --domain`?

That syntax doesn't exist. The proxy doesn't take a domain — domains come from the wrapped commands.

## Step 3 — emulate (sidecar, optional)

```bash
[[ -f emulate.config.yaml ]] && ( exec emulate --seed emulate.config.yaml ) &
```

`emulate` runs in foreground by default; we shell-background. Real flags (verified):
- `emulate` — start all services
- `emulate --service vercel,github` — selective
- `emulate --seed config.yaml` — load seed config
- `emulate init` — generate starter
- `emulate list` — list available services

The `emulate up` subcommand from earlier docs **does not exist**.

## Step 4 — wrap the dev server in portless

```bash
( cd "${PROJECT_DIR}" && exec portless "${slug}" "${pkg_mgr}" run dev >>"${LOG_FILE}" 2>&1 ) &
wrap_pid=$!
```

**Critical**: the `exec` matters. Without it, `$!` captures the subshell PID, not portless's. When stop.sh later kills `wrap_pid`, it kills a dead subshell while portless + dev keep running orphaned. With `exec`, the subshell is replaced by portless and `$!` is the real wrapper.

portless gives the child:
- `PORT` — random port in 4000-4999
- `HOST` — usually 127.0.0.1
- `PORTLESS_URL` — public URL (`https://<slug>.localhost[:proxyport]`)
- `NODE_EXTRA_CA_CERTS` — path to portless CA (so node child trusts the local TLS)

## Step 5 — wait for portless to register the route, then wait-on the dev server

Two-stage wait:

1. Poll `portless get <slug>` for up to 30s — returns the canonical URL (with the proxy's actual port) once portless registers the route.
2. `npx wait-on <url>` for another 30s — confirms the dev server is responding through the proxy.

Skipping stage 1 risks racing portless's registration; skipping stage 2 races the dev server's startup.

## Step 6 — agent-browser session

```bash
AGENT_BROWSER_SESSION="${slug}" agent-browser open "${base_url}" >>"${LOG_FILE}" 2>&1 || true
```

Sessions in agent-browser 0.25.x are **lazy** — they don't have daemons, they're just isolation namespaces. Setting `AGENT_BROWSER_SESSION=<name>` is equivalent to `--session <name>` flag. The browser actually starts on first navigation. Pre-warming with `open <base_url>` registers the session as active, so subsequent `/ork:expect` runs reuse the same session by name.

## Step 7 — atomic state write

`jq -n` builds the JSON in one pass; we write to `<file>.tmp` and `mv` to the final path. If the script is killed mid-write, we don't leave a half-written state file.

State shape: see `references/state-schema.md`.

## Step 8 — summary

Plain stderr text — never JSON. The summary is consumed by humans only; the state file is the machine-readable record.

## Teardown order (`scripts/stop.sh`)

```
agent-browser session close (via AGENT_BROWSER_SESSION env)
                ↓
portless wrapper descendants  (pgrep -P walk, leaves-first SIGTERM)
                ↓
portless wrapper itself       (SIGTERM, then SIGKILL after 5s)
                ↓
emulate sidecar (SIGTERM)
                ↓
remove .claude/state/dev-stack.json
```

**The shared portless proxy daemon is intentionally left running.** It serves other projects on the same machine; `stop.sh` only tears down *this* branch's stack. Use `portless proxy stop` separately if you really want to kill the daemon.

### Why walk the process tree?

`portless` doesn't always propagate SIGTERM cleanly to its child. Tested on macOS: killing only the wrapper PID leaves the wrapped Next.js process orphaned, holding its port. `pgrep -P <wrap_pid>` enumerates immediate children; we recurse to grand-descendants and SIGTERM leaves-first so each parent sees its children gone before being killed itself.
