---
title: Choose between WebFetch, Tavily, and browser tools using the decision matrix
impact: HIGH
impactDescription: "Decision matrix for choosing between WebFetch, Tavily, and agent-browser tools"
tags: tool-selection, tavily, webfetch
---

# Tool Selection Rules

## When to Use Tavily over WebFetch

- WebFetch returned <500 chars (likely incomplete)
- You need raw markdown content (not Haiku-summarized)
- Batch extracting content from multiple URLs
- Semantic search with relevance scoring
- Site discovery/crawling (map API)

## When to Skip Tavily and Go to agent-browser

- Content requires JavaScript rendering (SPAs)
- Authentication/login is required
- Interactive elements need clicking
- Content is behind CAPTCHAs

## Scenario-Based Selection

| Scenario | Tool | Why |
|----------|------|-----|
| Static HTML page | WebFetch | Fast, no browser needed |
| Public API docs | WebFetch | Usually server-rendered |
| GitHub README | WebFetch | Static content |
| Batch URL extraction (2-20 URLs) | Tavily Extract | Parallel, raw markdown |
| Semantic search with content | Tavily Search | Relevance-scored results |
| Site crawl/discovery (URLs only) | Tavily Map | Finds all URLs on a domain |
| Full site content extraction | Tavily Crawl | Crawl + extract in one call |
| Competitor page deep content | Tavily Extract | Full markdown, not summarized |
| Deep multi-source research | Tavily Research | Synthesized report with citations (beta) |
| React/Vue/Angular app | agent-browser | Needs JS execution |
| Interactive pricing page | agent-browser | Dynamic content |
| Login-protected content | agent-browser | Needs session state |
| Swagger UI | agent-browser | Client-rendered |
| Documentation with sidebar nav | agent-browser | Client-side routing |

## Detection Heuristics

Content likely needs browser if WebFetch returns:
- Empty or very short content (< 500 chars)
- Contains `<noscript>` tags
- Contains "Loading...", "Please wait", "JavaScript required"
- Contains only `<div id="root"></div>` or `<div id="app"></div>`
- Returns 403/401 (may need auth)

## SPA Detection

Known patterns that always need browser:

```bash
# URL patterns suggesting SPA
app.* | dashboard.* | portal.* | console.*

# Framework indicators in initial HTML
"__NEXT_DATA__"     → Next.js (may work with WebFetch)
"window.__NUXT__"   → Nuxt.js (may work with WebFetch)
"ng-app"            → Angular (needs browser)
"data-reactroot"    → React (needs browser)
"data-v-"           → Vue (needs browser)
```

## Escalation Heuristic

```bash
# Auto-escalate from WebFetch to Tavily
CONTENT=$(WebFetch url="$URL" prompt="Extract main content")
CHAR_COUNT=${#CONTENT}

if [ "$CHAR_COUNT" -lt 500 ] && [ -n "$TAVILY_API_KEY" ]; then
  # WebFetch returned thin content — try Tavily extract
  RESULT=$(curl -s -X POST 'https://api.tavily.com/extract' \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TAVILY_API_KEY" \
    -d "{\"urls\":[\"$URL\"]}")
  # Parse result...
fi
```

## Cost Awareness

| API | Cost | Notes |
|-----|------|-------|
| Tavily Search | 1 credit/search | `advanced` depth = 2 credits |
| Tavily Extract | 1 credit/5 URLs | Batch up to 20 URLs |
| Tavily Map | 1 credit/10 pages | Good for site discovery |
| Tavily Crawl | 1 credit/5 pages | Full site extraction in one call |
| Tavily Research | 5 credits/query | Deep multi-source synthesis (beta) |
| WebFetch | Free | Always try first |
| agent-browser | Free (compute) | Slowest, most capable |

## Graceful Degradation

If `TAVILY_API_KEY` is not set, the 3-tier tree collapses to the original 2-tier (WebFetch → agent-browser). No configuration needed — agents check for the env var before attempting Tavily calls.

**Incorrect — Always using browser for everything:**
```bash
agent-browser open https://github.com/owner/repo/blob/main/README.md
agent-browser wait --load networkidle
agent-browser get text body
# Slow, unnecessary - static content
```

**Correct — Use WebFetch for static content:**
```bash
WebFetch(
  url="https://github.com/owner/repo/blob/main/README.md",
  prompt="Extract README content"
)
# Fast, no browser needed
```
