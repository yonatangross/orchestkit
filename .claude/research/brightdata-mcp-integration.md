# BrightData MCP Integration Research

**Date:** 2026-02-06
**Researcher:** web-research-analyst (OrchestKit)
**Status:** Complete
**Confidence:** HIGH (direct documentation + benchmark data)

---

## 1. BrightData MCP Server

### Package & Installation

| Field | Value |
|-------|-------|
| **Package** | `@brightdata/mcp` (npm) |
| **GitHub** | [brightdata/brightdata-mcp](https://github.com/brightdata/brightdata-mcp) |
| **Transport** | SSE (Server-Sent Events) |
| **Hosted URL** | `https://mcp.brightdata.com/sse?token=<API_TOKEN>` |
| **Local run** | `npx @brightdata/mcp` |

### Claude Code Integration (One-Liner)

```bash
claude mcp add --transport sse brightdata "https://mcp.brightdata.com/sse?token=<your-api-token>"
```

Verify with: `claude mcp list`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_TOKEN` | Yes | Bright Data API credential |
| `PRO_MODE` | No | Set `true` to unlock 60+ tools (incurs charges) |
| `GROUPS` | No | Comma-separated tool groups: `ecommerce`, `browser`, `social`, `finance`, `business`, `research`, `app_stores`, `travel`, `advanced_scraping` |
| `TOOLS` | No | Individual tool names for granular selection |
| `RATE_LIMIT` | No | Custom throttle (e.g., `100/1h`) |
| `WEB_UNLOCKER_ZONE` | No | Custom Web Unlocker zone |
| `BROWSER_ZONE` | No | Custom browser automation zone |
| `POLLING_TIMEOUT` | No | Seconds to wait for results (default: 600) |

### MCP Tools Exposed

#### Free Tier (Rapid Mode) -- 4 Tools

| Tool | Description |
|------|-------------|
| `search_engine` | Web search (Google/Bing/Yandex) with AI-optimized JSON/Markdown |
| `search_engine_batch` | 10 parallel search queries |
| `scrape_as_markdown` | Any webpage to clean Markdown with bot-bypass |
| `scrape_batch` | 10 parallel page scrapes |

#### Pro Mode -- 60+ Tools

**Advanced Scraping:**
- `scrape_as_html` -- raw HTML extraction
- `extract` -- Markdown to structured JSON with custom prompts
- `session_stats` -- usage reporting

**Browser Automation (requires active scraping-browser session):**
- Navigation: `navigate`, `go_back`, `go_forward`
- Interaction: `click_ref`, `type_ref`, `scroll`, `scroll_to_ref`
- Content: `snapshot`, `screenshot`, `get_text`, `get_html`
- Monitoring: `wait_for_ref`, `network_requests`

**E-commerce (structured data):**
- `web_data_amazon_product`, `web_data_amazon_product_reviews`, `web_data_amazon_product_search`
- `web_data_walmart_product`, `web_data_walmart_seller`
- `web_data_ebay_product`, `web_data_homedepot_products`, `web_data_zara_products`
- `web_data_etsy_products`, `web_data_bestbuy_products`, `web_data_google_shopping`

**Social Media (structured data):**
- LinkedIn: person/company profiles, job listings, posts, people search
- Instagram: profiles, posts, reels, comments
- TikTok: profiles, posts, shop, comments
- Facebook: posts, marketplace, reviews, events
- YouTube: videos, profiles, comments
- Reddit posts, X (Twitter) posts

**Business Intelligence:**
- `web_data_crunchbase_company`, `web_data_zoominfo_company_profile`
- `web_data_google_maps_reviews`, `web_data_zillow_properties_listing`
- `web_data_yahoo_finance_business`

**Other:**
- `web_data_reuter_news`, `web_data_github_repository_file`
- `web_data_booking_hotel_listings`
- `web_data_google_play_store`, `web_data_apple_app_store`

---

## 2. Web Scraping Capabilities

### Supported Scraping Types

| Type | Tool/API | Output |
|------|----------|--------|
| **SERP** | `search_engine` / SERP API | JSON/Markdown search results (Google, Bing, Yandex) |
| **Custom URL** | `scrape_as_markdown` / Web Unlocker | Markdown or HTML |
| **E-commerce** | `web_data_amazon_*`, `web_data_walmart_*`, etc. | Structured JSON |
| **Social Media** | `web_data_linkedin_*`, `web_data_instagram_*`, etc. | Structured JSON |
| **Business Intel** | `web_data_crunchbase_*`, `web_data_zoominfo_*` | Structured JSON |
| **Browser Automation** | `scraping_browser.*` tools | Screenshots, text, HTML |

### Web Unlocker API

Single-request API that handles everything:
- Submit target URL, receive clean HTML or JSON
- Automatic proxy selection (residential, datacenter, ISP, mobile)
- CAPTCHA solving (automatic)
- Browser fingerprinting (mimics real user)
- Retry logic with alternative configurations
- **Pay only for successful requests**
- JavaScript rendering via built-in browser

### Scraping Browser API

Full headless browser with built-in unblocking:
- Controlled via Puppeteer or Playwright APIs
- Built-in CAPTCHA solving
- Automatic browser fingerprinting
- Manages retries and IP rotation
- Use when you need: form filling, JS execution, multi-step navigation

**Key difference:** Web Unlocker = single-request API (simpler). Scraping Browser = full browser automation (more powerful for interactive pages).

---

## 3. Key Differentiators Over Basic WebFetch

| Capability | WebFetch | BrightData MCP |
|------------|----------|----------------|
| Static HTML | Yes | Yes |
| JavaScript rendering | No | Yes (Scraping Browser) |
| Anti-bot bypass | No | Yes (residential proxies, fingerprinting) |
| CAPTCHA solving | No | Yes (automatic) |
| Residential proxies | No | Yes (150M+ IPs in 195 countries) |
| Structured data extraction | No | Yes (pre-built for Amazon, LinkedIn, etc.) |
| Geolocation targeting | No | Yes (country-level) |
| Batch operations | No | Yes (10 parallel) |
| Pay-for-success | N/A | Yes (charged only on success) |
| Success rate | ~60-70% (varies) | ~100% (claimed) / 90% browser (benchmarked) |
| Scalability (250 agents) | N/A | 76.8% success at load |

### When to Use BrightData vs WebFetch

| Scenario | Recommendation |
|----------|---------------|
| Static docs, public README | WebFetch (free, fast) |
| JS-rendered SPA | BrightData Scraping Browser |
| Competitor pricing behind bot protection | BrightData Web Unlocker |
| Amazon/Walmart product data | BrightData `web_data_*` tools |
| LinkedIn company research | BrightData `web_data_linkedin_*` |
| Social media monitoring | BrightData `web_data_*` social tools |
| SERP analysis at scale | BrightData `search_engine_batch` |
| Simple page-to-markdown | WebFetch first, BrightData fallback |

---

## 4. Pricing

### MCP Server Pricing

| Tier | Monthly Fee | Search/Scrape/Extract | Browser Navigation |
|------|------------|----------------------|-------------------|
| **Free** | $0 | 5,000 requests/month | Included |
| **Pay-As-You-Go** | $0 | $1.50 / 1K results | $8 / GB |
| **Starter** | $499 | $1.30 / 1K results | $7 / GB |
| **Professional** | $999 | $1.10 / 1K results | $6 / GB |
| **Business** | $1,999 | $1.00 / 1K results | $5 / GB |
| **Enterprise** | Custom | Custom | Custom (99.99% SLA) |

**Promotion:** New signups get dollar-for-dollar matching on first deposits (up to $500).

### Cost Per Request (Effective)

| Operation | Cost |
|-----------|------|
| Single search query | ~$0.0015 |
| Single page scrape | ~$0.0015 |
| Batch of 10 scrapes | ~$0.015 |
| Browser session (typical page) | ~$0.01-0.05 |

### Free Tier for OrchestKit Integration

The 5,000 free requests/month is significant:
- ~166 scrapes/day
- Enough for moderate competitive monitoring
- Covers typical developer/research workflow
- No credit card required initially

---

## 5. Developer Experience

### JavaScript SDK

| Field | Value |
|-------|-------|
| **Package** | `@brightdata/sdk` |
| **Install** | `npm install @brightdata/sdk` |
| **GitHub** | [brightdata/sdk-js](https://github.com/brightdata/sdk-js) |
| **TypeScript** | Full type declarations |
| **Module** | ESM + CommonJS |

#### SDK API Surface

```typescript
import { bdclient } from '@brightdata/sdk';

const client = new bdclient({
  apiKey: 'your_key',
  autoCreateZones: true,    // Auto-create missing zones
  webUnlockerZone: 'zone1', // Custom zone
  serpZone: 'serp_zone',    // Search zone
  logLevel: 'info',
});

// Scrape single URL
const result = await client.scrape('https://example.com');

// Scrape multiple URLs (parallel, concurrency: 10)
const results = await client.scrape([
  'https://site1.com',
  'https://site2.com'
]);

// Search
const search = await client.search('pizza restaurants');
const batchSearch = await client.search(['pizza', 'sushi']);

// Options
const mdResult = await client.scrape('https://example.com', {
  dataFormat: 'markdown',  // or 'html', 'screenshot'
  country: 'US',
  timeout: 30000,
  concurrency: 10,
});

// Save results
await client.saveResults(results, { format: 'json' });

// Zone management
const zones = await client.listZones();
```

### MCP Integration Patterns

**Pattern A: Hosted (Zero Setup)**
```bash
claude mcp add --transport sse brightdata \
  "https://mcp.brightdata.com/sse?token=YOUR_TOKEN"
```

**Pattern B: Local with Pro Mode**
```json
{
  "mcpServers": {
    "brightdata": {
      "command": "npx",
      "args": ["@brightdata/mcp"],
      "env": {
        "API_TOKEN": "your_token",
        "PRO_MODE": "true"
      }
    }
  }
}
```

**Pattern C: Selective Tool Groups**
```json
{
  "mcpServers": {
    "brightdata": {
      "command": "npx",
      "args": ["@brightdata/mcp"],
      "env": {
        "API_TOKEN": "your_token",
        "GROUPS": "ecommerce,social,research"
      }
    }
  }
}
```

---

## 6. Benchmark Data (Independent, AIMultiple 2026)

### Accuracy Rankings

| Provider | Web Search/Extract | Browser Automation |
|----------|-------------------|-------------------|
| **Bright Data** | **100%** | **90%** |
| Nimble | 93% | N/A |
| Firecrawl | 83% | N/A |
| Apify | 78% | 0% |
| Oxylabs | 75% | N/A |
| Hyperbrowser | 63% | 90% |
| Browserbase | 48% | 5% |

### Speed (seconds per correct result)

| Provider | Search/Extract | Browser |
|----------|---------------|---------|
| Firecrawl | 7s | N/A |
| Oxylabs | 14s | N/A |
| **Bright Data** | **30s** | **30s** |
| Apify | 32s | N/A |
| Browserbase | 51s | 104s |

### Scalability (250 concurrent agents)

| Provider | Success Rate | Avg Time |
|----------|-------------|----------|
| **Bright Data** | **76.8%** | 48.7s |
| Firecrawl | 64.8% | 77.6s |
| Oxylabs | 54.4% | 31.7s |
| Nimble | 51.2% | 182.3s |

**Key insight from benchmark:** "LLM costs exceeded browsing costs during these tasks" -- MCP server pricing is secondary to model costs in agent deployments.

---

## 7. Integration Recommendation for OrchestKit

### Proposed Architecture

```
OrchestKit Agent (web-research-analyst)
         |
         v
   Decision Layer (existing web-research-workflow skill)
         |
    +----+----+
    |         |
    v         v
WebFetch   BrightData MCP
(free,     (anti-bot, structured data,
 fast)      JS rendering, social/ecom)
```

### Integration Points

1. **MCP Server Registration**: Add BrightData as optional MCP server in OrchestKit config
2. **Skill Enhancement**: Update `web-research-workflow` decision tree to include BrightData as third tier
3. **Agent Tooling**: Give `web-research-analyst` and `market-intelligence` agents access to BrightData tools
4. **Competitive Monitoring**: Use `web_data_*` structured APIs for reliable competitor data extraction
5. **Fallback Chain**: WebFetch -> BrightData MCP (free tier) -> BrightData Pro (if needed)

### Recommended Decision Tree Update

```
URL to research
     |
     v
[1] Try WebFetch (free, fast, ~7s)
     |
  Content OK? --Yes--> Done
     |
     No
     v
[2] Try BrightData scrape_as_markdown (free tier, anti-bot)
     |
  Content OK? --Yes--> Done
     |
     No (JS-rendered, interactive)
     v
[3] Try BrightData Scraping Browser (Pro, full browser)
     |
  Content OK? --Yes--> Done
     |
     No
     v
[4] agent-browser local (full control, no rate limits)
```

### Tool Groups for OrchestKit Use Cases

| Use Case | Recommended Groups | Tools |
|----------|-------------------|-------|
| Competitive research | `research`, `ecommerce` | `scrape_as_markdown`, `web_data_*` |
| Market analysis | `business`, `finance` | `web_data_crunchbase_*`, `web_data_yahoo_finance_*` |
| Documentation capture | (free tier) | `scrape_as_markdown`, `scrape_batch` |
| Social monitoring | `social` | `web_data_linkedin_*`, `web_data_twitter_*` |
| SERP tracking | (free tier) | `search_engine`, `search_engine_batch` |

### Configuration for OrchestKit Plugin

```json
{
  "mcp_servers": {
    "brightdata": {
      "description": "Web scraping with anti-bot bypass, structured data extraction",
      "required": false,
      "setup": {
        "command": "claude mcp add --transport sse brightdata \"https://mcp.brightdata.com/sse?token=<API_TOKEN>\"",
        "env_vars": ["BRIGHTDATA_API_TOKEN"],
        "free_tier": "5,000 requests/month"
      },
      "recommended_groups": ["research", "ecommerce", "social"],
      "agents": ["web-research-analyst", "market-intelligence"]
    }
  }
}
```

---

## 8. Risks & Considerations

| Risk | Mitigation |
|------|-----------|
| API token exposure | Store in env var, never in code |
| Cost overrun with Pro mode | Use GROUPS to limit tools, set RATE_LIMIT |
| Rate limiting | Built-in RATE_LIMIT env var |
| Vendor lock-in | Keep WebFetch as primary, BrightData as enhancement |
| Free tier exhaustion | 5K/month is generous; monitor with `session_stats` |
| Latency (30s vs 7s) | Use for anti-bot scenarios only, not all scraping |

---

## Sources

- [BrightData MCP GitHub](https://github.com/brightdata/brightdata-mcp)
- [Claude Code Integration Docs](https://docs.brightdata.com/ai/mcp-server/integrations/claude-code)
- [MCP Server Pricing](https://brightdata.com/pricing/mcp-server)
- [MCP Tools Reference](https://docs.brightdata.com/mcp-server/tools)
- [JavaScript SDK](https://github.com/brightdata/sdk-js)
- [Web Unlocker Introduction](https://docs.brightdata.com/scraping-automation/web-unlocker/introduction)
- [AIMultiple MCP Benchmark 2026](https://research.aimultiple.com/browser-mcp/)
- [Firecrawl vs BrightData Comparison](https://www.claudemcp.com/blog/web-scraping-ai-data-battle)
