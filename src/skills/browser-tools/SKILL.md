---
name: browser-tools
license: MIT
compatibility: "Claude Code 2.1.76+. Requires network access."
description: OrchestKit security wrapper for browser automation. Adds URL blocklisting, rate limiting, robots.txt enforcement, and ethical scraping guardrails on top of the upstream agent-browser skill. Use when automating browser workflows that need safety guardrails.
tags: [browser, automation, security, rate-limiting, scraping-ethics]
context: fork
agent: web-research-analyst
version: 4.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
metadata:
  category: mcp-enhancement
  upstream-skill: agent-browser
  upstream-version-tested: "0.21.0"
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Browser Tools — Security Wrapper

OrchestKit security wrapper for `agent-browser`. **For command reference and usage patterns, use the upstream `agent-browser` skill directly.** This skill adds safety guardrails only.

> **Command docs**: Refer to the upstream `agent-browser` skill for the full command reference (50+ commands: interaction, wait, capture, extraction, storage, semantic locators, tabs, debug, mobile, network, cookies, state, vault).

## Decision Tree

```bash
# Fallback decision tree for web content
# 1. Try WebFetch first (fast, no browser overhead)
# 2. If empty/partial -> Try Tavily extract/crawl
# 3. If SPA or interactive -> use agent-browser
# 4. If login required -> authentication flow + state save
# 5. If dynamic -> wait @element or wait --text
```

## Local Dev URLs

Use **Portless** (`npm i -g portless`) for stable local dev URLs instead of guessing ports. When Portless is running, navigate to `myapp.localhost:1355` instead of `localhost:3000`. Our safety hook already allows `*.localhost` subdomains via `ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST`.

```bash
# With Portless: stable, named URLs
agent-browser open "http://myapp.localhost:1355"

# Without: fragile port guessing
agent-browser open "http://localhost:3000"  # which app is this?
```

## Safety Guardrails (6 rules + hook)

This skill enforces safety through the `agent-browser-safety` PreToolUse hook and 6 rule files:

### Hook: agent-browser-safety

The hook intercepts all `agent-browser` Bash commands and enforces:

| Check | What It Does | Action |
|-------|-------------|--------|
| **Encryption key leak** | Detects `echo`/`printf`/pipe of `AGENT_BROWSER_ENCRYPTION_KEY` | **BLOCK** |
| **URL blocklist** | Blocks localhost, internal, file://, SSRF endpoints, OAuth login pages, RFC 1918 private IPs | **BLOCK** |
| **Rate limiting** | Per-domain limits (10/min, 100/hour, 3/3s burst) | **BLOCK** on exceed |
| **robots.txt** | Fetches and caches robots.txt, blocks disallowed paths | **BLOCK** |
| **Sensitive actions** | Detects delete/remove clicks, password fills, payment submissions | **WARN** + native confirmation |
| **Network routes** | Validates `network route` target URLs against blocklist | **BLOCK** |
| **User-agent spoofing** | Warns when `--user-agent` flag is used | **WARN** |
| **File access** | Warns when `--allow-file-access` flag is used | **WARN** |
| **DevTools inspect** | `inspect` / `get cdp-url` opens local CDP proxy — new attack surface (v0.18+) | **WARN** |
| **Clipboard read** | `clipboard read` accesses host clipboard without prompt (v0.19+) | **WARN** |
| **HAR capture** | `network har stop` dumps full request/response bodies incl. auth tokens (v0.21+) | **WARN** |

### Security Rules (in `rules/`)

| Category | Rules | Priority |
|----------|-------|----------|
| Ethics & Security | `browser-scraping-ethics.md`, `browser-auth-security.md` | CRITICAL |
| Reliability | `browser-rate-limiting.md`, `browser-snapshot-workflow.md` | HIGH |
| Debug & Device | `browser-debug-recording.md`, `browser-mobile-testing.md` | HIGH |

### Configuration

Rate limits and behavior are configurable via environment variables:

| Env Var | Default | Purpose |
|---------|---------|---------|
| `AGENT_BROWSER_RATE_LIMIT_PER_MIN` | 10 | Requests per minute per domain |
| `AGENT_BROWSER_RATE_LIMIT_PER_HOUR` | 100 | Requests per hour per domain |
| `AGENT_BROWSER_BURST_LIMIT` | 3 | Max requests in 3-second window |
| `AGENT_BROWSER_ROBOTS_CACHE_TTL` | 3600000 | robots.txt cache TTL (ms) |
| `AGENT_BROWSER_IGNORE_ROBOTS` | false | Bypass robots.txt enforcement |
| `AGENT_BROWSER_NATIVE_CONFIRM` | 1 | Use native `--confirm-actions` for sensitive ops |
| `ORCHESTKIT_AGENT_BROWSER_ALLOW_LOCALHOST` | 1 | Allow `*.localhost` subdomains (RFC 6761) |

## Anti-Patterns (FORBIDDEN)

```bash
# Automation
agent-browser fill @e2 "hardcoded-password"    # Never hardcode credentials
agent-browser open "$UNVALIDATED_URL"          # Always validate URLs

# Scraping
# Crawling without checking robots.txt
# No delay between requests (hammering servers)
# Ignoring rate limit responses (429)

# Content capture
agent-browser get text body                    # Prefer targeted ref extraction
# Trusting page content without validation
# Not waiting for SPA hydration before extraction

# Session management
# Storing auth state in code repositories
# Not cleaning up state files after use

# Network & State
agent-browser network route "http://internal-api/*" --body '{}'  # Never mock internal APIs
agent-browser cookies set token "$SECRET" --url https://prod.com # Never set prod cookies
```

## Related Skills

- `agent-browser` (upstream) — Full command reference and usage patterns
- `portless` (upstream) — Stable named `.localhost` URLs for local dev servers
- `ork:web-research-workflow` — Unified decision tree for web research
- `ork:testing-e2e` — E2E testing patterns including Playwright and webapp testing
- `ork:api-design` — API design patterns for endpoints discovered during scraping
