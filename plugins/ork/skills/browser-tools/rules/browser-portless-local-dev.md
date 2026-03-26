---
title: Use Portless named URLs instead of raw port numbers for local dev
category: browser
impact: HIGH
impactDescription: "Port guessing causes ECONNREFUSED failures, wrong-app confusion, and fragile reproduction steps in debug reports"
tags: [portless, localhost, browser, debugging, local-dev]
---

## Browser: Portless Local Dev URLs

Use Portless named `.localhost:1355` URLs instead of guessing port numbers. Named URLs are stable across restarts, self-documenting, and eliminate the #1 source of local dev connection failures.

**Incorrect:**
```bash
# Guessing ports — fragile, ambiguous, breaks across restarts
agent-browser open "http://localhost:3000"        # which app is this?
agent-browser open "http://localhost:8080"        # API? frontend? storybook?
curl http://localhost:5173/api/health             # port changed after restart

# Hardcoding ports in reproduction steps
agent-browser screenshot /tmp/bug.png             # of which service?
agent-browser network log                         # on which port?
```

**Correct:**
```bash
# Discover services first
portless list
# api    → api.localhost:1355    (port 8080)
# app    → app.localhost:1355    (port 3000)
# docs   → docs.localhost:1355   (port 3001)

# Use named URLs — stable, self-documenting
agent-browser open "http://app.localhost:1355"
agent-browser screenshot /tmp/app-bug.png

# API calls with named URLs
curl http://api.localhost:1355/api/health

# Visual debugging with agent-browser + Portless
agent-browser open "http://app.localhost:1355/settings"
agent-browser console                             # check JS errors
agent-browser network log                         # inspect API calls
agent-browser screenshot /tmp/settings-broken.png # evidence for report

# E2E testing with stable base URL
PLAYWRIGHT_BASE_URL="http://app.localhost:1355" npx playwright test
```

## Portless v0.5+ Features

```bash
# portless run — auto-infer project name, inject --port flag
portless run npm run dev
# Starts dev server AND assigns it a named URL automatically

# portless alias — assign named URLs to existing services (not started by portless)
portless alias redis 6379

# portless get — retrieve the URL for a named service
portless get app  # → http://app.localhost:1355

# PORTLESS_URL env var — injected automatically in portless run
# Your app can read process.env.PORTLESS_URL to know its own named URL

# HTTPS support (v0.4+) — auto-generated TLS certs
# Portless can serve HTTPS on port 443 with HTTP/2
```

**Key rules:**
- Always run `portless list` before constructing any localhost URL
- Use `*.localhost:1355` URLs in all agent-browser commands, curl calls, and test configs
- Include the Portless service name in screenshots and debug reports for clarity
- Prefer `portless run` (v0.5+) over manual port management — it injects `--port` and `PORTLESS_URL` automatically
- Use `portless alias` (v0.5+) for services not started by portless (databases, queues)
- Use `portless get <name>` (v0.6+) to programmatically retrieve URLs in scripts
- If Portless is not installed, fall back to `lsof -iTCP -sTCP:LISTEN -nP` to discover ports
- The OrchestKit safety hook allows `*.localhost` subdomains via `ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST`
- Install Portless globally: `npm i -g portless`
