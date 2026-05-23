---
name: portless
compatibility: "Claude Code 2.1.139+"
description: "Named HTTPS .localhost URLs for local development with portless (v0.13.x). Eliminates port collisions, enables stable URLs for agents, integrates with emulate for API emulation aliases, git worktrees for branch-named subdomains, LAN mode (--lan) for mDNS .local hostnames reachable across devices, Tailscale sharing (--tailscale / --funnel), and OS startup-service install for boot persistence. Use when setting up local dev environments, configuring agent-accessible URLs, running multi-service dev setups, or testing from phones/tablets on the same wifi. Do NOT use for production deployments, CI environments (set PORTLESS=0), or DNS/hosting configuration."
tags:
  - dev-server
  - localhost
  - https
  - portless
  - devops
  - mdns
  - lan
version: 1.2.0
author: OrchestKit
user-invocable: false
complexity: low
context: inherit
persuasion-type: guidance
metadata:
  upstream-package: portless
  upstream-version-tested: "0.13.0"
---

# Portless Integration

Named `.localhost` URLs for local development. Replaces `localhost:3000` with `https://myapp.localhost`.

> **Full CLI reference**: Load `Read("${CLAUDE_SKILL_DIR}/references/upstream.md")` for complete command docs.

## New in 2026-04 → 2026-05 (portless 0.10.x → 0.13.x)

- **OS startup service (0.13.0)** — `portless service install` / `service status` / `service uninstall` register a native startup service for the HTTPS proxy across macOS launchd, Linux systemd, and Windows Task Scheduler. `.localhost` URLs survive reboot without a manual `portless proxy start`. `portless clean` removes the service alongside CA + hosts cleanup.
- **Tailscale readiness preflight (0.13.0)** — `--tailscale` and `--funnel` now validate Tailscale HTTPS + Funnel prerequisites before starting the child process, surfacing actionable errors instead of hanging during registration.
- **Tailscale integration (0.12.0)** — `--tailscale` shares your app over your tailnet with automatic HTTPS on port 443; `--funnel` exposes it publicly via Tailscale Funnel. Apps receive `PORTLESS_TAILSCALE_URL` so they can reference their own public address. `portless list` now shows tailnet URLs.
- **Zero-config mode (0.11.0)** — bare `portless` auto-discovers dev scripts from `package.json`. Multi-app monorepos get automatic subdomain assignment; Turborepo task-graph integration is wired in. `portless.json` config file supported. `--script` overrides the default "dev" script.
- **`portless prune`** — removes orphaned dev servers and stale Tailscale registrations.
- **`portless clean` (extended)** — now also tears down Tailscale registrations alongside CA + hosts cleanup.
- **Rsbuild + VitePlus auto-port injection** — same auto-wiring as Vite/Next.
- **State directory** moved to `~/.portless` (was scattered).
- **HTTPS on 443 by default** (breaking from 0.9.x http:1355). Valid cert, no setup. `--no-tls` reverts.
- **`NODE_EXTRA_CA_CERTS` auto-injected (0.10.2)** into child processes — node HTTPS calls trust portless CA with zero setup.
- **`--wildcard` subdomains** — `https://*.myapp.localhost` for multi-tenant / preview routing.
- **`portless alias <name> <port>`** — map a docker-compose / emulate port to a named URL without a long-running `run` process.
- **`portless clean`** — full teardown: stops proxy, removes CA, wipes state, cleans `/etc/hosts`.
- **`--lan` mode** — mDNS `.local` hostnames reachable across wifi (phone, tablet, other machines) without router config.
- **Fixed app ports** — `--app-port 3000` / `PORTLESS_APP_PORT` for tools that need a known port (debuggers, docker).
- **hosts-sync on by default** for Safari compat (disable with `PORTLESS_SYNC_HOSTS=0`).
- **HTTP/2 HMR fixes** for Vite/VitePlus/Next.js dev — websocket upgrades no longer break under h2.
- **Expo / React Native** support — `portless run expo start` gives Metro a stable URL for device QR codes.

## When to Use

- Starting a dev server that agents or browser tests will target
- Running multiple services locally (API + frontend + docs)
- Working in git worktrees (branch-named subdomains)
- Local OAuth flows (stable callback URLs)
- Connecting emulate API mocks to named URLs

## Quick Start

```bash
# Instead of: npm run dev (random port)
portless run npm run dev
# → https://myapp.localhost (stable, named, HTTPS on 443 — default in 0.10+)

# Multi-service
portless run --name api npm run dev:api
portless run --name web npm run dev:web
# → https://api.localhost, https://web.localhost

# LAN mode (0.10.0) — reachable from phone/tablet via mDNS
portless proxy start --lan
portless run npm run dev
# → https://myapp.local (resolves across the local network, no router config)

# Full teardown (0.10.1) — stops proxy, removes CA, wipes state, cleans /etc/hosts
portless clean

# Boot persistence (0.13.0) — install native startup service (launchd / systemd / Task Scheduler)
portless service install
portless service status
# Removed automatically by `portless clean`, or explicitly:
portless service uninstall
```

> **0.10.x breaking change:** default switched from `http://app.localhost:1355` to `https://app.localhost` on port 443. Use `--no-tls` to revert. `NODE_EXTRA_CA_CERTS` is injected into child processes automatically (0.10.2) — no manual cert setup. `/etc/hosts` is synced automatically for Safari; disable with `PORTLESS_SYNC_HOSTS=0`.

## Framework-Specific Setup

> Load `Read("${CLAUDE_SKILL_DIR}/references/framework-integration.md")` for full framework recipes.

Most frameworks (Next.js, Vite, Express) work with `portless run <cmd>`. Some need explicit flags:

| Framework | Auto-detected? | Extra flags needed |
|-----------|:-:|---|
| Next.js | Yes | None |
| Vite / Astro | Yes | None |
| Express / Fastify / Hono | Yes | None (reads `PORT` env var) |
| Ruby on Rails | Yes | None |
| FastAPI / uvicorn | **No** | `--port $PORT --host $HOST` |
| Django | **No** | `$HOST:$PORT` positional arg |

## Why `.localhost`?

| Feature | `.localhost` (RFC 6761) | `127.0.0.1:PORT` | `/etc/hosts` hack |
|---------|:-:|:-:|:-:|
| No `/etc/hosts` editing | Yes | Yes | No |
| HTTPS with valid cert | Yes | No | Manual |
| Wildcard subdomains | Yes | No | No |
| Works in all browsers | Yes | Yes | Varies |
| Cookie isolation per service | Yes | No | Yes |
| No port conflicts | Yes | No | Yes |

## Key Environment Variables

When portless runs your command, it injects:

| Variable | Value | Use in agents |
|----------|-------|---------------|
| `PORT` | Assigned ephemeral port (4000-4999) | Internal only |
| `HOST` | `127.0.0.1` | Internal only |
| `PORTLESS_URL` | `https://myapp.localhost` | **Use this in agent prompts** |
| `NODE_EXTRA_CA_CERTS` | Path to portless CA *(auto-injected 0.10.2)* | Child node processes trust portless certs without setup |

### Toggle env vars

| Variable | Effect |
|----------|--------|
| `PORTLESS=0` | Bypass portless entirely (CI) |
| `PORTLESS_SYNC_HOSTS=0` | Disable auto `/etc/hosts` sync (default: on in 0.10.1+) |
| `PORTLESS_STATE_DIR` | Override state dir (default: `~/.portless` or `/tmp/portless` for privileged ports) |

## OrchestKit Integration Patterns

### 1. Agent-Accessible Dev Server

```bash
# Start with portless, then agents can target PORTLESS_URL
portless run npm run dev

# In ork:expect or agent-browser:
agent-browser open $PORTLESS_URL
```

### 2. Emulate + Portless (Named API Mocks)

```bash
# Register emulate ports as named aliases
portless alias github-api 4001
portless alias vercel-api 4000
portless alias google-api 4002

# Now agents can target:
#   https://github-api.localhost — GitHub emulator
#   https://vercel-api.localhost — Vercel emulator
```

### 3. Git Worktree Dev

```bash
# In worktree for feature/auth-flow:
portless run npm run dev
# → https://auth-flow.myapp.localhost (auto branch prefix)
```

### 4. Bypass in CI

```bash
# Disable portless in CI — direct port access
PORTLESS=0 npm run dev
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Hardcode `localhost:3000` in tests | Use `PORTLESS_URL` or `process.env.PORTLESS_URL` |
| Run portless in CI | Set `PORTLESS=0` in CI environments |
| Use numeric ports in AGENTS.md | Document the portless URL |

## References

| File | Content |
|------|---------|
| `references/upstream.md` | Full portless CLI reference (synced from Vercel) |
| `references/upstream-oauth.md` | OAuth callback patterns with stable URLs |
| `references/framework-integration.md` | Framework recipes (FastAPI, Django, Docker, gotchas) |
| `checklists/new-project-setup.md` | Step-by-step: add portless to a new project |
