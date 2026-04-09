---
name: browser-tools
license: MIT
compatibility: "Claude Code 2.1.76+. Requires network access."
description: OrchestKit security wrapper for browser automation. Adds URL blocklisting, rate limiting, robots.txt enforcement, and ethical scraping guardrails on top of the upstream agent-browser skill. Use when automating browser workflows that need safety guardrails.
tags: [browser, automation, security, rate-limiting, scraping-ethics]
context: fork
agent: web-research-analyst
version: 5.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
persuasion-type: discipline
metadata:
  category: mcp-enhancement
  upstream-skill: agent-browser
  upstream-version-tested: "0.22.2"
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

## What's New (v0.17 → v0.22.2)

**Breaking changes** — update scripts now:
- `--full` / `-f` moved from global to command-level (v0.21): use `screenshot --full`, NOT `--full screenshot`
- Auth encryption format changed (v0.17): saved auth states from v0.16.x may not load
- Auto-dialog dismissal (v0.23.1): alert/beforeunload dialogs are auto-dismissed by default, opt out with `--no-auto-dialog`

**New commands:**

| Command | Version | Security Note |
|---------|---------|---------------|
| `clipboard read/write/copy/paste` | v0.19 | `read` accesses host clipboard — hook warns |
| `inspect` / `get cdp-url` | v0.18 | Opens local DevTools proxy — hook warns |
| `batch --json [--bail]` | v0.21 | Batch execute commands from stdin |
| `network har start/stop [file]` | v0.21 | HAR captures auth tokens — hook warns, treat output as sensitive |
| `network request <id>` | v0.22 | View full request/response detail |
| `network requests --type/--method/--status` | v0.22 | Filter network requests |
| `dialog dismiss` / `dialog status` | v0.17/v0.22 | Dismiss or check browser dialogs |
| `upgrade` | v0.21.1 | Self-update (auto-detects npm/Homebrew/Cargo) |

**New flags:**

| Flag | Scope | Version |
|------|-------|---------|
| `--engine lightpanda` | global | v0.17 |
| `--screenshot-dir/quality/format` | screenshot | v0.19 |
| `--provider browserless` | global | v0.19 |
| `--idle-timeout <duration>` | global | v0.20.14 |
| `--user-data-dir <path>` | Chrome | v0.21 |
| `set viewport W H [scale]` | viewport | v0.17.1 (retina) |

**Platform support:** Brave auto-discovery (v0.20.7), Alpine Linux musl (v0.20.2), Lightpanda engine (v0.17), Browserless.io provider (v0.19), cross-origin iframe traversal (v0.22).

**Performance (v0.20):** 99x smaller install (710→7 MB), 18x less memory (143→8 MB), 1.6x faster cold start.

## Safety Guardrails (7 rules + 11-check hook)

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
| Local Dev | `browser-portless-local-dev.md` | HIGH |
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
| `AGENT_BROWSER_CONFIRM` | 1 | Use `--confirm-actions` for sensitive ops |
| `AGENT_BROWSER_IDLE_TIMEOUT_MS` | — | Auto-shutdown daemon after inactivity (ms) |
| `AGENT_BROWSER_ENGINE` | chrome | Browser engine (`chrome` or `lightpanda`) |
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

# Deprecated / removed
agent-browser --full screenshot                # BREAKING: --full is now command-level (v0.21)
agent-browser screenshot --full                # Correct: flag after subcommand

# Sensitive data leaks
agent-browser network har stop auth-dump.har   # HAR files contain auth tokens — gitignore!
git add *.har                                  # NEVER commit HAR captures
```

## Related Skills

- `agent-browser` (upstream) — Full command reference and usage patterns
- `portless` (upstream) — Stable named `.localhost` URLs for local dev servers
- `ork:web-research-workflow` — Unified decision tree for web research
- `ork:testing-e2e` — E2E testing patterns including Playwright and webapp testing
- `ork:api-design` — API design patterns for endpoints discovered during scraping
