# MCP Configuration

MCPs (Model Context Protocol servers) enhance OrchestKit commands but are **NOT required**.
Commands work without them - MCPs just add extra capabilities.

## Available MCPs

| MCP | Purpose | Storage | Enhances |
|-----|---------|---------|----------|
| **context7** | Up-to-date library docs | Cloud (Upstash) | /implement, /verify, /review-pr |
| **sequential-thinking** | Structured reasoning | None | /brainstorm, /implement |
| **memory** | Knowledge graph | Local file | Decisions, patterns, entities |
| **tavily** | Web search, extract, crawl | Cloud (Tavily) | /explore, /implement, web-research agents |
| **brightdata** | Anti-bot scraping, structured data | Cloud (BrightData) | web-research agents, /explore |

> **Opus 4.6 Note:** Sequential-thinking MCP is optional when using Opus 4.6+, which has native adaptive thinking built-in. The MCP tool remains useful for non-Opus models.

## Default State

**All MCPs are disabled by default.** Enable only the ones you need.

## Enabling MCPs

Edit `.mcp.json` and set `"disabled": false` for selected MCPs:

```json
{
  "$schema": "https://raw.githubusercontent.com/anthropics/claude-code/main/schemas/mcp.schema.json",
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "disabled": false
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "disabled": true
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": { "MEMORY_FILE": ".claude/memory/memory.json" },
      "disabled": false
    },
    "tavily": {
      "command": "npx",
      "args": ["-y", "tavily-mcp@latest"],
      "env": { "TAVILY_API_KEY": "op://Private/Tavily API Key/API Key" },
      "disabled": true
    },
    "brightdata": {
      "command": "npx",
      "args": ["-y", "@brightdata/mcp"],
      "env": { "API_TOKEN": "op://Private/BrightData API Key/API Key" },
      "disabled": true
    }
  }
}
```

## Tavily MCP

When `TAVILY_API_KEY` is set and the Tavily MCP is enabled, agents gain access to production-grade web research tools.

### Tools

| Tool | Purpose | Credits |
|------|---------|---------|
| `tavily_search` | AI-optimized semantic web search with relevance scoring | 1 (basic) / 2 (advanced) |
| `tavily_extract` | Extract markdown content from up to 20 URLs | 1 per 5 pages |
| `tavily_map` | Discover all URLs on a site (sitemap) | 1 per 10 pages |
| `tavily_crawl` | Full site crawl with content extraction | 1-2 per 5 pages |
| `tavily_research` | Deep multi-source research with citations (async) | Variable |

### Which agents and skills use Tavily?

| Component | Type | How it uses Tavily |
|-----------|------|-------------------|
| `web-research-analyst` | Agent | Primary research tool — search, extract, crawl |
| `market-intelligence` | Agent | Market analysis with `"topic": "finance"` search |
| `product-strategist` | Agent | Competitive landscape with `include_domains` filtering |
| `ai-safety-auditor` | Agent | Content extraction with injection detection |
| `web-research-workflow` | Skill | 3-tier decision tree: WebFetch → Tavily → agent-browser |
| `rag-retrieval` | Skill | CRAG workflow web search fallback |

### Setup

**Option A: Local MCP (npx)**
1. Get a free API key (1,000 credits/month): https://app.tavily.com
2. Store in 1Password: `op item create --category "API Credential" --title "Tavily API Key" "API Key=tvly-..."`
3. Reference in `.mcp.json`: `"TAVILY_API_KEY": "op://Private/Tavily API Key/API Key"`
4. Set `"disabled": false` for the tavily entry

**Option B: Remote MCP (hosted, no npx)**

Tavily offers a hosted MCP server — no local process needed. Generate the URL at https://app.tavily.com → "Remote MCP" → "Generate MCP Link":

```json
"tavily": {
  "type": "url",
  "url": "https://mcp.tavily.com/mcp/?tavilyApiKey=YOUR_KEY",
  "disabled": false
}
```

### Without Tavily

Agents fall back to WebFetch (Haiku-summarized) → agent-browser (full headless). Tavily fills the middle tier with raw markdown extraction and semantic search.

## BrightData MCP

When `API_TOKEN` is set and the BrightData MCP is enabled, agents gain anti-bot web scraping and structured data extraction.

### Tools

| Tool | Purpose | Free Tier |
|------|---------|-----------|
| `search_engine` | Web search via BrightData proxy network | 5,000 req/month |
| `scrape_as_markdown` | Scrape any URL as clean markdown (anti-bot) | 5,000 req/month |
| `scrape_as_markdown_batch` | Batch scrape multiple URLs | 5,000 req/month |
| `search_engine_batch` | Batch web search | 5,000 req/month |

Pro mode unlocks 60+ tools for ecommerce (Amazon, Walmart), social (LinkedIn, Instagram), and full browser automation.

### Setup

**Option A: Local MCP (npx)**
1. Get a free API key (5,000 requests/month): https://brightdata.com/products/web-scraper/mcp
2. Store in 1Password: `op item create --category "API Credential" --title "BrightData API Key" "API Key=..."`
3. Reference in `.mcp.json`: `"API_TOKEN": "op://Private/BrightData API Key/API Key"`
4. Set `"disabled": false` for the brightdata entry

**Option B: Remote MCP (SSE)**
```bash
claude mcp add --transport sse brightdata "https://mcp.brightdata.com/sse?token=YOUR_TOKEN"
```

### Without BrightData

Agents fall back to Tavily (if enabled) → WebFetch (Haiku-summarized). BrightData adds anti-bot scraping for sites that block standard HTTP clients.

## MCP Dependencies

| MCP | Requirements |
|-----|-------------|
| context7 | None |
| sequential-thinking | None |
| memory | None (creates `.claude/memory/` automatically) |
| tavily | `TAVILY_API_KEY` env var (free: https://app.tavily.com) |
| brightdata | `API_TOKEN` env var (free: https://brightdata.com/products/web-scraper/mcp) |

## Plugin Integration

OrchestKit agents and skills integrate with these MCPs:

| Component | MCP Used | Purpose |
|-----------|----------|---------|
| /implement, /verify, /review-pr | context7 | Fetch current library docs |
| web-research-analyst, market-intelligence | tavily | Web search and content extraction |
| web-research-analyst | brightdata | Anti-bot scraping for blocked sites |
| /remember, /memory | memory | Persist decisions across sessions |

## Without MCPs

Commands still work - MCPs just enhance them:
- `/implement` works, but without latest library docs (context7)
- Web research works via WebFetch/WebSearch, but without raw markdown extraction (tavily) or anti-bot scraping (brightdata)
- Session continuity works via local files and knowledge graph

## Browser Automation

For browser automation and testing, use the `agent-browser` skill instead of an MCP.
See `/ork:agent-browser` for Vercel's headless browser CLI.