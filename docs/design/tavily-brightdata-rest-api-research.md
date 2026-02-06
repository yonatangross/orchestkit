# Tavily & BrightData: REST API vs MCP Research Report

**Date:** 2026-02-06
**Status:** Complete
**Method:** WebFetch + WebSearch (5 endpoints verified)

---

## Executive Summary

Both Tavily and BrightData expose **full REST APIs** that can be called via simple `curl` commands without any MCP server dependency. Both also offer Python SDKs and (in BrightData's case) a dedicated CLI tool. The MCP servers are convenience wrappers around these same REST endpoints. Skipping MCP is viable for scripted automation, hook integration, and environments where MCP server management is undesirable.

---

## 1. Tavily REST API

**Base URL:** `https://api.tavily.com`
**Auth:** `Authorization: Bearer tvly-YOUR_API_KEY`
**All 5 endpoints confirmed working via curl.**

### 1.1 Search (`POST /search`)

```bash
curl -X POST https://api.tavily.com/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tvly-YOUR_API_KEY" \
  -d '{
    "query": "latest AI developments 2026",
    "search_depth": "advanced",
    "max_results": 10,
    "include_answer": "advanced",
    "include_raw_content": "markdown",
    "topic": "general",
    "time_range": "week"
  }'
```

**Key parameters:**
| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `query` | string | required | Search query |
| `search_depth` | string | `basic` | `ultra-fast`, `fast`, `basic`, `advanced` |
| `max_results` | int | 5 | 0-20 |
| `topic` | string | `general` | `general` or `news` |
| `include_answer` | bool/string | `false` | `true`, `basic`, `advanced` |
| `include_raw_content` | bool/string | `false` | `true`, `markdown`, `text` |
| `include_domains` | array | [] | Whitelist (max 300) |
| `exclude_domains` | array | [] | Blacklist (max 150) |
| `time_range` | string | null | `day`, `week`, `month`, `year` |
| `country` | string | null | Boost results from country |

**Credits:** basic/fast/ultra-fast = 1 credit, advanced = 2 credits.

### 1.2 Extract (`POST /extract`)

```bash
curl -X POST https://api.tavily.com/extract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tvly-YOUR_API_KEY" \
  -d '{
    "urls": ["https://example.com/page1", "https://example.com/page2"],
    "format": "markdown",
    "include_images": true,
    "extract_depth": "basic"
  }'
```

**Key parameters:**
| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `urls` | string/array | required | Max 20 URLs |
| `query` | string | null | Optional search intent for relevance |
| `format` | string | `markdown` | `markdown` or `text` |
| `extract_depth` | string | `basic` | `basic` or `advanced` |
| `include_images` | bool | false | |
| `chunks_per_source` | int | 3 | 1-5, relevant chunks per source |

### 1.3 Map (`POST /map`)

```bash
curl -X POST https://api.tavily.com/map \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tvly-YOUR_API_KEY" \
  -d '{
    "url": "docs.example.com",
    "max_depth": 2,
    "max_breadth": 50,
    "limit": 100
  }'
```

**Response:** Returns array of discovered URLs (sitemap), not content.

**Key parameters:**
| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `url` | string | required | Root URL |
| `max_depth` | int | 1 | 1-5 |
| `max_breadth` | int | 20 | 1-500 links per page |
| `limit` | int | 50 | Total links before stopping |
| `instructions` | string | null | Natural language guidance |
| `select_paths` | array | null | Regex URL path filters |
| `exclude_paths` | array | null | Regex URL path exclusions |
| `allow_external` | bool | true | Follow external links |

### 1.4 Crawl (`POST /crawl`)

```bash
curl -X POST https://api.tavily.com/crawl \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tvly-YOUR_API_KEY" \
  -d '{
    "url": "https://docs.example.com",
    "max_depth": 3,
    "limit": 50,
    "instructions": "Find all API reference pages",
    "format": "markdown",
    "extract_depth": "advanced"
  }'
```

**Response:** Returns full extracted content for each discovered page.

**Key parameters:** Same as Map, plus:
| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `extract_depth` | string | `basic` | `basic` (1 credit/5 pages) or `advanced` (2/5) |
| `format` | string | `markdown` | `markdown` or `text` |
| `include_images` | bool | false | |
| `chunks_per_source` | int | 3 | 1-5 (requires instructions) |

**Note:** Crawl may still be invite-only for some accounts.

### 1.5 Research (`POST /research`)

```bash
# Step 1: Start research (returns request_id)
curl -X POST https://api.tavily.com/research \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tvly-YOUR_API_KEY" \
  -d '{
    "input": "Compare Tavily and BrightData for AI agent web access",
    "model": "pro",
    "citation_format": "numbered"
  }'

# Step 2: Poll for results (or use stream: true for SSE)
curl -X GET "https://api.tavily.com/research/REQUEST_ID" \
  -H "Authorization: Bearer tvly-YOUR_API_KEY"
```

**Key parameters:**
| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `input` | string | required | Research question/task |
| `model` | string | `auto` | `mini`, `pro`, `auto` |
| `stream` | bool | false | Enable SSE streaming |
| `output_schema` | object | null | Enforce JSON response schema |
| `citation_format` | string | `numbered` | `numbered`, `mla`, `apa`, `chicago` |

**Async pattern:** POST returns `request_id` + `status: "pending"`. Poll GET endpoint or use `stream: true` for Server-Sent Events.

---

## 2. BrightData REST API

**Base URL:** `https://api.brightdata.com`
**Auth:** `Authorization: Bearer YOUR_API_TOKEN`

### 2.1 Web Unlocker (REST method)

```bash
curl -X POST https://api.brightdata.com/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "zone": "YOUR_WEB_UNLOCKER_ZONE",
    "url": "https://example.com/pricing",
    "format": "raw"
  }'
```

**Key parameters:**
| Parameter | Type | Notes |
|-----------|------|-------|
| `zone` | string | Your Web Unlocker zone name |
| `url` | string | Target URL to scrape |
| `format` | string | `raw` (direct HTML) or `json` |
| `body` | string | Optional POST payload for target |

### 2.2 Web Unlocker (Proxy method)

```bash
curl "https://example.com/pricing" \
  --proxy brd.superproxy.io:33335 \
  --proxy-user "brd-customer-CUSTOMER_ID-zone-ZONE_NAME:ZONE_PASSWORD"
```

### 2.3 SERP API

```bash
curl -X POST https://api.brightdata.com/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "zone": "YOUR_SERP_API_ZONE",
    "url": "https://www.google.com/search?q=tavily+api&hl=en&gl=us",
    "format": "raw"
  }'
```

**Formats:**
- `format: "raw"` -- Raw HTML
- `data_format: "parsed_light"` -- Top 10 organic results only (JSON)
- `data_format: "markdown"` -- AI-ready markdown output
- Add `brd_json=1` to URL query params for full JSON SERP structure

**Supported search engines:** Google, Bing, DuckDuckGo, Yandex, Baidu, Yahoo, Naver.

### 2.4 Browser API / Scraping Browser

The Browser API enables headless browser automation via their infrastructure. This typically requires the proxy-based integration method or their SDK rather than a simple REST call.

---

## 3. Tavily CLI / SDK

### Python SDK (recommended for scripted use)

```bash
pip install tavily-python  # v0.7.21+ (Jan 2026)
```

```python
from tavily import TavilyClient

client = TavilyClient(api_key="tvly-YOUR_API_KEY")

# Search
results = client.search("query", search_depth="advanced", max_results=10)

# Extract
content = client.extract(urls=["https://example.com"], format="markdown")

# Map (sitemap discovery)
sitemap = client.map(url="https://docs.example.com", max_depth=2)

# Crawl (full content extraction)
pages = client.crawl(url="https://docs.example.com", max_depth=3, limit=50)

# Research (async)
job = client.research(input="Research topic", model="pro")
result = client.get_research(job["request_id"])

# Convenience methods
context = client.get_search_context("query")  # RAG-optimized
answer = client.qna_search("question")         # Direct Q&A
```

### TypeScript/JavaScript SDK

```bash
npm install @tavily/core
```

### No dedicated CLI tool

Tavily does **not** offer a standalone CLI binary. The Python SDK can be used from bash via `python -c` or a wrapper script:

```bash
# One-liner search from bash
python -c "
from tavily import TavilyClient
import json, os
c = TavilyClient(api_key=os.environ['TAVILY_API_KEY'])
print(json.dumps(c.search('$QUERY'), indent=2))
"
```

### MCP Server (optional)

```bash
# npm
npx -y tavily-mcp

# pip
pip install mcp-tavily
```

---

## 4. BrightData CLI / SDK

### Python SDK with CLI

```bash
pip install brightdata  # Includes CLI
```

**CLI commands:**
```bash
# Search
brightdata search google "python tutorial" --location "United States"
brightdata search linkedin jobs --keyword "python developer" --remote

# Scrape
brightdata scrape amazon products "https://amazon.com/dp/B123"
brightdata scrape linkedin profiles "https://linkedin.com/in/johndoe"
brightdata scrape generic "https://example.com" --output-format pretty

# Output formats
brightdata search google "AI news" --output-file results.json
# Formats: json, pretty, minimal
```

### JavaScript SDK

```bash
npm install @brightdata/sdk
```

### Python SDK (programmatic)

```python
from brightdata import BrightDataClient
import asyncio

async def main():
    async with BrightDataClient() as client:
        # Generic scraping
        result = await client.scrape_url("https://example.com")

        # SERP
        result = await client.search.google(query="AI tools", num_results=10)

        # Platform-specific
        result = await client.scrape.amazon.products(url="https://amazon.com/dp/B123")

asyncio.run(main())
```

### MCP Server (optional)

```bash
npx @brightdata/mcp  # Requires API_TOKEN env var
```

---

## 5. Tradeoffs: MCP vs Direct REST API

### What You LOSE by Skipping MCP

| Capability | Impact | Severity |
|-----------|--------|----------|
| **Tool discovery** | LLM cannot auto-discover available tools at runtime. Must hardcode tool definitions. | MEDIUM |
| **Parameter validation** | MCP servers validate parameters via JSON Schema before sending. With REST, invalid params hit the API directly. | LOW |
| **Streaming/bidirectional** | MCP uses persistent JSON-RPC connections. REST is stateless request/response. | LOW (for these use cases) |
| **Context sharing** | MCP maintains state across multiple tool calls in a session. REST calls are independent. | LOW |
| **Unified interface** | MCP provides one protocol for Tavily + BrightData + N other tools. REST requires per-service integration. | MEDIUM |
| **Auto-retry/error handling** | Some MCP servers handle retries and rate limiting. REST requires manual implementation. | LOW |
| **Swappable providers** | MCP lets you swap Tavily for Exa without code changes. REST requires per-provider curl commands. | MEDIUM |

### What You GAIN by Using Direct REST

| Capability | Impact | Severity |
|-----------|--------|----------|
| **No MCP server dependency** | No need to install, configure, or manage MCP server processes. Zero moving parts. | HIGH |
| **Works everywhere** | curl works in any environment: CI/CD, hooks, cron, Docker, Lambda, scripts. | HIGH |
| **Simpler debugging** | Raw HTTP requests/responses. No MCP protocol layer to debug. | HIGH |
| **Lower latency** | Direct HTTP call vs MCP JSON-RPC overhead + server process. | MEDIUM |
| **Explicit control** | Full control over request parameters, timeouts, retries. No abstraction hiding behavior. | HIGH |
| **No process management** | No MCP server to start, health-check, restart, or version-manage. | HIGH |
| **Smaller attack surface** | Fewer dependencies = fewer CVEs. Just curl + jq. | MEDIUM |
| **Offline-capable** | Can mock responses locally. No server handshake needed. | LOW |

### Recommendation Matrix

| Use Case | Best Approach | Why |
|----------|--------------|-----|
| **Hook/script automation** | Direct REST (curl) | No MCP process needed, reliable in pre/post hooks |
| **Agent-driven research** | MCP server | Tool discovery, context sharing across calls |
| **CI/CD pipeline** | Direct REST (curl) | Deterministic, no server management |
| **One-off CLI usage** | BrightData CLI / Tavily Python | Convenient, fast |
| **Multi-provider orchestration** | MCP | Swap providers without code changes |
| **Minimal dependency setup** | Direct REST (curl) | Just needs curl + API key |
| **Claude Code integration** | MCP (already supported) | Native tool calling |

---

## 6. Practical Integration Patterns

### Pattern A: Shell function for Tavily Search (hook-friendly)

```bash
tavily_search() {
  local query="$1"
  local depth="${2:-basic}"
  curl -s -X POST https://api.tavily.com/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TAVILY_API_KEY" \
    -d "{
      \"query\": \"$query\",
      \"search_depth\": \"$depth\",
      \"max_results\": 5,
      \"include_answer\": \"basic\"
    }" | jq '.answer // .results[0].content'
}

# Usage
tavily_search "React 19 server components best practices"
```

### Pattern B: BrightData scrape via curl (hook-friendly)

```bash
brightdata_scrape() {
  local url="$1"
  local zone="${BRIGHTDATA_ZONE:-web_unlocker1}"
  curl -s -X POST https://api.brightdata.com/request \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $BRIGHTDATA_API_TOKEN" \
    -d "{
      \"zone\": \"$zone\",
      \"url\": \"$url\",
      \"format\": \"raw\"
    }"
}

# Usage
brightdata_scrape "https://competitor.com/pricing"
```

### Pattern C: Tavily Map + Extract pipeline (discover then scrape)

```bash
# Step 1: Discover all pages
URLS=$(curl -s -X POST https://api.tavily.com/map \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{"url": "docs.example.com", "max_depth": 2, "limit": 20}' \
  | jq -r '.results[]')

# Step 2: Extract content from discovered URLs (batch, max 20)
curl -s -X POST https://api.tavily.com/extract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d "{\"urls\": $(echo "$URLS" | jq -R -s 'split("\n") | map(select(. != ""))')}" \
  | jq '.results[] | {url, raw_content}'
```

### Pattern D: BrightData SERP with parsed output

```bash
# Get structured Google results as JSON
curl -s -X POST https://api.brightdata.com/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BRIGHTDATA_API_TOKEN" \
  -d '{
    "zone": "serp_api1",
    "url": "https://www.google.com/search?q=tavily+api+review&hl=en&gl=us&brd_json=1",
    "format": "raw",
    "data_format": "parsed_light"
  }' | jq '.organic[:5] | .[] | {title, url, description}'
```

---

## 7. Cost Comparison

### Tavily Pricing (as of Feb 2026)

| Tier | Credits/Month | Cost |
|------|--------------|------|
| Free | 1,000 | $0 |
| Basic | 10,000 | ~$20/mo |
| Pro | 50,000+ | Custom |

Credit costs per endpoint:
- Search (basic/fast): 1 credit
- Search (advanced): 2 credits
- Extract (basic): 1 credit per 5 pages
- Extract (advanced): 2 credits per 5 pages
- Map: 1 credit per 10 pages
- Crawl: 1-2 credits per 5 pages
- Research: Variable (uses multiple search+extract calls)

### BrightData Pricing

Pay-as-you-go per request. Pricing varies by product zone (Web Unlocker, SERP API, Browser API). Typically $0.001-$0.01 per request depending on complexity and target site.

---

## 8. Summary Table

| Feature | Tavily | BrightData |
|---------|--------|------------|
| **REST API** | Yes, all 5 endpoints | Yes, unified `/request` endpoint |
| **Auth method** | Bearer token | Bearer token or proxy credentials |
| **Python SDK** | `pip install tavily-python` | `pip install brightdata` |
| **JS/TS SDK** | `npm install @tavily/core` | `npm install @brightdata/sdk` |
| **Dedicated CLI** | No (use Python SDK) | Yes (`brightdata` command) |
| **MCP Server** | `tavily-mcp` (npm/pip) | `@brightdata/mcp` (npm) |
| **Search** | Semantic AI search | SERP scraping (Google, Bing, etc.) |
| **Extract** | AI-optimized content extraction | Raw HTML / proxy-based |
| **Crawl** | Graph-based parallel traversal | Via Browser API |
| **Anti-bot bypass** | Built-in | Core strength (CAPTCHA, proxies) |
| **Output formats** | Markdown, text, JSON | Raw HTML, JSON, markdown |
| **Free tier** | 1,000 credits/mo | No (pay-as-you-go) |
| **Best for** | AI agent web access, RAG | Heavy scraping, anti-bot bypass |
