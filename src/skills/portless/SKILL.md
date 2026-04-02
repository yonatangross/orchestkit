---
name: portless
description: "Named .localhost URLs for local development with portless. Eliminates port collisions, enables stable URLs for agents, integrates with emulate for API emulation aliases and git worktrees for branch-named subdomains. Use when setting up local dev environments, configuring agent-accessible URLs, or running multi-service dev setups."
tags:
  - dev-server
  - localhost
  - https
  - portless
  - devops
version: 1.0.0
author: OrchestKit
user-invocable: false
complexity: low
---

# Portless Integration

Named `.localhost` URLs for local development. Replaces `localhost:3000` with `https://myapp.localhost`.

> **Full CLI reference**: Load `Read("${CLAUDE_SKILL_DIR}/references/upstream.md")` for complete command docs.

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
# → https://myapp.localhost (stable, named, HTTPS)

# Multi-service
portless run --name api npm run dev:api
portless run --name web npm run dev:web
# → https://api.localhost, https://web.localhost
```

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
