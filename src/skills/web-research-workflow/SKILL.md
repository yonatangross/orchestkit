---
name: web-research-workflow
description: Unified decision tree for web research. Auto-selects WebFetch, Tavily, or agent-browser based on target site characteristics and available API keys. Use when researching web content, scraping, extracting raw markdown, or capturing documentation.
context: fork
agent: web-research-analyst
version: 1.2.0
author: OrchestKit AI Agent Hub
tags: [research, browser, webfetch, tavily, automation, scraping, content-extraction]
user-invocable: false
allowedTools: [Bash, Read, Write, WebFetch]
complexity: low
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

When `TAVILY_API_KEY` is set, Tavily provides a powerful middle tier between WebFetch and agent-browser. It returns raw markdown content, supports batch URL extraction, and offers semantic search with relevance scoring.

**When to use Tavily over WebFetch:**
- WebFetch returned <500 chars (likely incomplete)
- You need raw markdown content (not Haiku-summarized)
- Batch extracting content from multiple URLs
- Semantic search with relevance scoring
- Site discovery/crawling (map API)

**When to skip Tavily and go to agent-browser:**
- Content requires JavaScript rendering (SPAs)
- Authentication/login is required
- Interactive elements need clicking
- Content is behind CAPTCHAs

### Tavily Search (Semantic Web Search)

Returns relevance-scored results with raw markdown content:

```bash
curl -s -X POST 'https://api.tavily.com/search' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{
    "query": "your search query",
    "search_depth": "advanced",
    "max_results": 5,
    "include_raw_content": "markdown"
  }' | python3 -m json.tool
```

Options:
- `search_depth`: `"basic"` (fast) or `"advanced"` (thorough, 2x cost)
- `topic`: `"general"` (default) or `"news"` or `"finance"`
- `include_domains`: `["example.com"]` — restrict to specific sites
- `exclude_domains`: `["reddit.com"]` — filter out sites
- `days`: `3` — limit to recent results (news/finance)
- `include_raw_content`: `"markdown"` — get full page content

### Tavily Extract (Batch URL Content)

Extract raw content from up to 20 URLs at once:

```bash
curl -s -X POST 'https://api.tavily.com/extract' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{
    "urls": [
      "https://docs.example.com/guide",
      "https://competitor.com/pricing"
    ]
  }' | python3 -m json.tool
```

Returns markdown content for each URL. Use when you have specific URLs and need full content.

### Tavily Map (Site Discovery)

Discover all URLs on a site before extracting:

```bash
curl -s -X POST 'https://api.tavily.com/map' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{
    "url": "https://docs.example.com",
    "max_depth": 2,
    "limit": 50
  }' | python3 -m json.tool
```

Useful for documentation sites and competitor sitemaps. Combine with extract for full crawl.

### Tavily Crawl (Multi-Page Content Extraction)

Crawl an entire site and extract content from all discovered pages in one call. Replaces the manual map→extract two-step workflow:

```bash
curl -s -X POST 'https://api.tavily.com/crawl' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{
    "url": "https://docs.example.com",
    "max_depth": 2,
    "limit": 50,
    "include_raw_content": "markdown"
  }' | python3 -m json.tool
```

Options:
- `max_depth`: `2` — how many link-hops from the seed URL
- `limit`: `50` — max pages to crawl
- `include_raw_content`: `"markdown"` — get full page content (not just snippets)
- `exclude_paths`: `["/blog/*"]` — skip certain URL patterns
- `include_paths`: `["/docs/*"]` — restrict to certain URL patterns

**When to use Crawl vs Map+Extract:**
- Use **Crawl** when you want content from an entire site section (docs, changelog, pricing)
- Use **Map** when you only need URL discovery without content
- Use **Extract** when you already have specific URLs

### Tavily Research (Deep Research — Beta)

Multi-step research agent that searches, reads, and synthesizes across multiple sources. Returns a comprehensive report with citations:

```bash
curl -s -X POST 'https://api.tavily.com/research' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{
    "query": "comparison of vector databases for RAG in 2026",
    "max_results": 10,
    "report_type": "research_report"
  }' | python3 -m json.tool
```

Options:
- `report_type`: `"research_report"` (default) | `"outline_report"` | `"detailed_report"`
- `max_results`: number of sources to analyze (more = deeper but slower)

**Note:** The `/research` endpoint is in beta. Falls back gracefully to `/search` + `/extract` if unavailable. Best for deep competitive analysis, market research, and technical comparisons.

### Escalation Heuristic

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

### Cost Awareness

| API | Cost | Notes |
|-----|------|-------|
| Tavily Search | 1 credit/search | `advanced` depth = 2 credits |
| Tavily Extract | 1 credit/5 URLs | Batch up to 20 URLs |
| Tavily Map | 1 credit/10 pages | Good for site discovery |
| Tavily Crawl | 1 credit/5 pages | Full site extraction in one call |
| Tavily Research | 5 credits/query | Deep multi-source synthesis (beta) |
| WebFetch | Free | Always try first |
| agent-browser | Free (compute) | Slowest, most capable |

### Graceful Degradation

If `TAVILY_API_KEY` is not set, the 3-tier tree collapses to the original 2-tier (WebFetch → agent-browser). No configuration needed — agents check for the env var before attempting Tavily calls.

## When to Use What

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

## Pattern 1: Auto-Fallback

Try WebFetch first, fall back to browser if needed:

```bash
# Step 1: Try WebFetch
WebFetch(url="https://example.com", prompt="Extract main content")

# If result is empty, partial, or contains "Loading..." indicators:
# Step 2: Fall back to browser
agent-browser open https://example.com
agent-browser wait --load networkidle
agent-browser get text body
```

### Detection Heuristics

Content likely needs browser if WebFetch returns:
- Empty or very short content (< 500 chars)
- Contains `<noscript>` tags
- Contains "Loading...", "Please wait", "JavaScript required"
- Contains only `<div id="root"></div>` or `<div id="app"></div>`
- Returns 403/401 (may need auth)

## Pattern 2: SPA Detection

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

## Pattern 3: Authentication Flow

For login-protected content:

```bash
# 1. Navigate to login
agent-browser open https://app.example.com/login
agent-browser snapshot -i

# 2. Fill credentials (use refs from snapshot)
agent-browser fill @e1 "$EMAIL"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3  # Submit button

# 3. Wait for redirect
agent-browser wait --url "**/dashboard"

# 4. Save session for reuse
agent-browser state save /tmp/session-example.json

# 5. Later: restore session
agent-browser state load /tmp/session-example.json
agent-browser open https://app.example.com/protected-page
```

## Pattern 4: Multi-Page Research

For documentation sites or multi-page content:

```bash
# 1. Get navigation links
agent-browser open https://docs.example.com
agent-browser snapshot -i

# 2. Extract all doc links
LINKS=$(agent-browser eval "JSON.stringify(
  Array.from(document.querySelectorAll('nav a'))
    .map(a => a.href)
    .filter(h => h.includes('/docs/'))
)")

# 3. Iterate with rate limiting
for link in $(echo "$LINKS" | jq -r '.[]' | head -20); do
  agent-browser open "$link"
  agent-browser wait --load networkidle
  agent-browser get text article > "/tmp/doc-$(basename $link).txt"
  sleep 2  # Rate limit
done
```

## Best Practices

### 1. Always Try WebFetch First
```bash
# WebFetch is 10x faster and uses no browser resources
# Only fall back to browser when necessary
```

### 2. Use Appropriate Waits
```bash
# For SPAs with API calls
agent-browser wait --load networkidle

# For specific content
agent-browser wait --text "Expected content"

# For elements
agent-browser wait @e5
```

### 3. Respect Rate Limits
```bash
# Add delays between requests
sleep 2

# Use session isolation for parallel work
agent-browser --session site1 open https://site1.com
agent-browser --session site2 open https://site2.com
```

### 4. Cache Results
```bash
# Save extracted content to avoid re-scraping
agent-browser get text body > /tmp/cache/example-com.txt
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty content from WebFetch | Try Tavily extract, then agent-browser |
| WebFetch returns <500 chars | Escalate to Tavily extract if API key set |
| Partial content | Use `wait --text "Expected"` for specific content |
| Need batch URL extraction | Tavily extract (up to 20 URLs at once) |
| 403 Forbidden | May need authentication flow (agent-browser) |
| CAPTCHA | Manual intervention required |
| Rate limited | Add delays, reduce request frequency |
| Content in iframe | Use `agent-browser frame @e1` then extract |
| No TAVILY_API_KEY | Skip Tavily tier, use WebFetch → agent-browser |

## BrightData PRO_MODE (Optional Cloud Scraping)

When `BRIGHTDATA_API_TOKEN` is set and the BrightData MCP server is configured, PRO_MODE provides specialized tool groups for cloud-based scraping without running a local browser.

### Tool Groups

| Group | Use Case |
|-------|----------|
| `ecommerce` | Product pages, pricing, reviews (Amazon, Shopify, etc.) |
| `social` | Social media profiles, posts, metrics |
| `finance` | Financial data, stock quotes, SEC filings |
| `business` | Company info, job listings, reviews |
| `research` | Academic papers, patents, datasets |
| `browser` | General-purpose cloud browser (JS rendering) |

### Configuration

Set `GROUPS` or `TOOLS` env vars to control which tools are available:

```bash
# Enable specific groups
GROUPS=ecommerce,business npx @anthropic-ai/mcp brightdata

# Or enable specific tools
TOOLS=scraping_browser,web_data_amazon npx @anthropic-ai/mcp brightdata
```

### Alternative: @brightdata/browserai-mcp

For serverless/cloud environments where `agent-browser` is unavailable:

```bash
npx @brightdata/browserai-mcp
```

Provides the same browsing capabilities but runs in BrightData's cloud infrastructure. Use when:
- No local browser available (CI/CD, serverless)
- Need residential proxies for geo-restricted content
- High-volume scraping that would trigger rate limits locally

### Decision Tree: BrightData vs agent-browser

| Scenario | Recommended |
|----------|-------------|
| Local dev, occasional scraping | agent-browser |
| CI/CD pipeline, no browser | BrightData browserai-mcp |
| E-commerce price monitoring | BrightData PRO_MODE (ecommerce) |
| Geo-restricted content | BrightData (residential proxies) |
| High-volume parallel scraping | BrightData (cloud infrastructure) |
| Login-protected, custom flows | agent-browser (full control) |

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
- `competitive-monitoring` - Change tracking

---

**Version:** 1.2.0 (February 2026)
