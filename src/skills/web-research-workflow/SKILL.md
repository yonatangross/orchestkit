---
name: web-research-workflow
license: MIT
compatibility: "Claude Code 2.1.59+. Requires network access."
description: Unified decision tree for web research and competitive monitoring. Auto-selects WebFetch, Tavily, or agent-browser based on target site characteristics and available API keys. Includes competitor page tracking, snapshot diffing, and change alerting. Use when researching web content, scraping, extracting raw markdown, capturing documentation, or monitoring competitor changes.
context: fork
agent: web-research-analyst
version: 1.3.0
author: OrchestKit AI Agent Hub
tags: [research, browser, webfetch, tavily, automation, scraping, content-extraction, competitive-intelligence, monitoring]
user-invocable: false
allowed-tools: [Bash, Read, Write, WebFetch]
complexity: low
model: haiku
metadata:
  category: mcp-enhancement
---

# Web Research Workflow

Unified approach for web content research that automatically selects the right tool for each situation.

## Quick Decision Tree

```
URL to research
     │
     ▼
┌─────────────────┐
│ 1. Try WebFetch │ ← Fast, free, no overhead
│    (always try) │
└─────────────────┘
     │
Content OK? ──Yes──► Parse and return
     │
     No (empty/partial/<500 chars)
     │
     ▼
┌───────────────────────┐
│ 2. TAVILY_API_KEY set?│
└───────────────────────┘
     │          │
    Yes         No ──► Skip to step 3
     │
     ▼
┌───────────────────────────┐
│ Tavily search/extract/    │ ← Raw markdown, batch URLs
│ crawl/research            │
└───────────────────────────┘
     │
Content OK? ──Yes──► Parse and return
     │
     No (JS-rendered/auth-required)
     │
     ▼
┌─────────────────────┐
│ 3. Use agent-browser │ ← Full browser, last resort
└─────────────────────┘
     │
├─ SPA (react/vue/angular) ──► wait --load networkidle
├─ Login required ──► auth flow + state save
├─ Dynamic content ──► wait --text "Expected"
└─ Multi-page ──► crawl pattern
```

## Tavily Enhanced Research

When `TAVILY_API_KEY` is set, Tavily provides a powerful middle tier between WebFetch and agent-browser. It returns raw markdown content, supports batch URL extraction, and offers semantic search with relevance scoring. If `TAVILY_API_KEY` is not set, the 3-tier tree collapses to 2-tier (WebFetch → agent-browser) automatically.

See [Tool Selection](rules/tool-selection.md) for when-to-use-what tables, escalation heuristics, SPA detection patterns, and cost awareness.

See [Tavily API Reference](references/tavily-api.md) for Search, Extract, Map, Crawl, and Research endpoint examples and options.

## Browser Patterns

For content requiring JavaScript rendering, authentication, or multi-page crawling, fall back to agent-browser.

See [Browser Patterns](rules/browser-patterns.md) for auto-fallback, authentication flow, multi-page research patterns, best practices, and troubleshooting.

## Competitive Monitoring

Track competitor websites for changes in pricing, features, positioning, and content.

See [Competitor Page Monitoring](rules/monitoring-competitor.md) for snapshot capture, structured data extraction, and change classification.

See [Change Detection & Discovery](rules/monitoring-change-detection.md) for diff detection, structured comparison, Tavily site discovery, and CI automation.

### Change Classification

| Severity | Examples | Action |
|----------|----------|--------|
| Critical | Price increase/decrease, major feature change | Immediate alert |
| High | New feature added, feature removed | Review required |
| Medium | Copy changes, positioning shift | Note for analysis |
| Low | Typos, minor styling | Log only |

## Integration with Agents

This skill is used by:
- `web-research-analyst` - Primary user
- `market-intelligence` - Competitor research
- `product-strategist` - Deep competitive analysis
- `ux-researcher` - Design system capture
- `documentation-specialist` - API doc extraction

## Related Skills

- `browser-content-capture` - Detailed browser patterns
- `agent-browser` - CLI reference

---

**Version:** 1.3.0 (February 2026)
