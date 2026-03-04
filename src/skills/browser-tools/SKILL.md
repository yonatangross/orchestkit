---
name: browser-tools
license: MIT
compatibility: "Claude Code 2.1.59+. Requires network access."
description: OrchestKit orchestration wrapper for browser automation. Adds security rules, rate limiting, and ethical scraping guardrails on top of the upstream agent-browser skill. Use when automating browser workflows, capturing web content, or extracting structured data from web pages.
tags: [browser, automation, playwright, puppeteer, scraping, content-capture]
context: fork
agent: web-research-analyst
version: 2.1.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
metadata:
  category: mcp-enhancement
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Browser Tools

OrchestKit orchestration wrapper for browser automation. Delegates command documentation to the upstream `agent-browser` skill and adds security rules, rate limiting, and ethical scraping guardrails.

## Decision Tree

```bash
# Fallback decision tree for web content
# 1. Try WebFetch first (fast, no browser overhead)
# 2. If empty/partial -> Try Tavily extract/crawl
# 3. If SPA or interactive -> use agent-browser
# 4. If login required -> authentication flow + state save
# 5. If dynamic -> wait @element or wait --text
```

## Security Rules (4 rules)

This skill enforces 4 security and ethics rules in `rules/`:

| Category | Rules | Priority |
|----------|-------|----------|
| Ethics & Security | `browser-scraping-ethics.md`, `browser-auth-security.md` | CRITICAL |
| Reliability | `browser-rate-limiting.md`, `browser-snapshot-workflow.md` | HIGH |

These rules are enforced by the `agent-browser-safety` pre-tool hook.

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

# Diff verification
diff /tmp/before.txt /tmp/after.txt            # Use agent-browser diff snapshot instead

# Session management
# Storing auth state in code repositories
# Not cleaning up state files after use

# Network & State
agent-browser network route "http://internal-api/*" --body '{}'  # Never mock internal APIs
agent-browser cookies set token "$SECRET" --url https://prod.com # Never set prod cookies in automation
# Not cleaning up routes after mocking (leaves stale intercepts)
```

## Diff Commands (v0.13+)

Verify changes and detect regressions using native diff commands:

| Command | Use Case |
|---------|----------|
| `diff snapshot` | Verify a11y tree changes after actions |
| `diff snapshot --baseline <file>` | Compare against saved baseline |
| `diff screenshot --baseline <img>` | Visual pixel diff (red highlights) |
| `diff url <a> <b>` | Side-by-side URL comparison |
| `diff url <a> <b> --screenshot` | Visual comparison of two URLs |

## Network Control (v0.13)

Intercept, block, or mock network requests:

| Command | Use Case |
|---------|----------|
| `network route <url> --abort` | Block analytics/trackers for clean extraction |
| `network route <url> --body <json>` | Mock API responses for testing |
| `network unroute [url]` | Remove intercept routes (always clean up!) |
| `network requests --filter <str>` | Inspect captured network traffic |

## Cookie Management (v0.13)

Direct cookie manipulation for session setup:

| Command | Use Case |
|---------|----------|
| `cookies set <n> <v> --url <u>` | Set cookie for specific URL |
| `cookies set <n> <v> --httpOnly --secure` | Secure cookie flags |
| `cookies set <n> <v> --domain <d> --path <p>` | Scoped cookie |
| `cookies set <n> <v> --expires <ts>` | Time-limited cookie |

## State Management (v0.15)

Enhanced session lifecycle commands:

| Command | Use Case |
|---------|----------|
| `--session-name <name>` | Named sessions (replaces `--session`) |
| `state list` | List all saved session states |
| `state show <name>` | Inspect saved state details |
| `state clean --older-than <days>` | Garbage collect old states |

## Related Skills

- `agent-browser` (upstream) - Full command reference and usage patterns
- `ork:web-research-workflow` - Unified decision tree for web research
- `ork:testing-patterns` - Comprehensive testing patterns including E2E and webapp testing
- `ork:api-design` - API design patterns for endpoints discovered during scraping
