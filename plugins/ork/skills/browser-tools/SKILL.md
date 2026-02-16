---
name: browser-tools
license: MIT
compatibility: "Claude Code 2.1.34+. Requires network access."
description: OrchestKit orchestration wrapper for browser automation. Adds security rules, rate limiting, and ethical scraping guardrails on top of the upstream agent-browser skill. Use when automating browser workflows, capturing web content, or extracting structured data from web pages.
tags: [browser, automation, playwright, puppeteer, scraping, content-capture]
context: fork
agent: web-research-analyst
version: 2.1.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: mcp-enhancement
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

# Session management
# Storing auth state in code repositories
# Not cleaning up state files after use
```

## Related Skills

- `agent-browser` (upstream) - Full command reference and usage patterns
- `web-research-workflow` - Unified decision tree for web research
- `testing-patterns` - Comprehensive testing patterns including E2E and webapp testing
- `api-design` - API design patterns for endpoints discovered during scraping
