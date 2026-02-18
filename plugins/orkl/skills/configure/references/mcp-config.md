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
| **agentation** | UI annotation tool | Local daemon | UI feedback → automatic agent pickup |

> **Opus 4.6 Note:** Sequential-thinking MCP is optional when using Opus 4.6+, which has native adaptive thinking built-in. The MCP tool remains useful for non-Opus models.

## Default State

OrchestKit ships with `context7` and `memory` **enabled by default**. `tavily` and `agentation` ship **disabled** — they require an API key or local package install. `sequential-thinking` is also disabled (Opus 4.6 has native adaptive thinking built-in).

## Enabling/Disabling MCPs

Edit `.mcp.json` and set `"disabled": true` or `false` for each MCP. Defaults:

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
      "command": "sh",
      "args": ["-c", "TAVILY_API_KEY=${TAVILY_API_KEY} exec npx -y tavily-mcp@latest"],
      "disabled": true
    },
    "agentation": {
      "command": "npx",
      "args": ["-y", "agentation-mcp", "server"],
      "disabled": true
    }
  }
}
```

To enable `tavily`: set `TAVILY_API_KEY` in your shell profile, update the entry above to `"disabled": false`.
To enable `agentation`: run `npm install -D agentation-mcp` in your project, then set `"disabled": false`.

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

**Option A: Local MCP with 1Password (recommended)**
1. Get a free API key (1,000 credits/month): https://app.tavily.com
2. Store in 1Password: `op item create --category "API Credential" --title "Tavily API Key" "API Key=tvly-..."`
3. Use `op read` in `.mcp.json` (see example config above) — the `sh -c` wrapper fetches the key from 1Password at MCP startup
4. Set `"disabled": false` for the tavily entry

> **Note:** Claude Code's MCP `env` block only resolves `${ENV_VAR}` syntax, not `op://` references directly. Use the `sh -c "TAVILY_API_KEY=$(op read '...') exec npx ..."` wrapper pattern to read from 1Password at startup.

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

## MCP Dependencies

| MCP | Requirements |
|-----|-------------|
| context7 | None |
| sequential-thinking | None |
| memory | None (creates `.claude/memory/` automatically) |
| tavily | 1Password: `op read 'op://Private/Tavily API Key/API Key'` (free: https://app.tavily.com) |

## Plugin Integration

OrchestKit agents and skills integrate with these MCPs:

| Component | MCP Used | Purpose |
|-----------|----------|---------|
| /implement, /verify, /review-pr | context7 | Fetch current library docs |
| web-research-analyst, market-intelligence | tavily | Web search and content extraction |
| /remember, /memory | memory | Persist decisions across sessions |

## Without MCPs

Commands still work - MCPs just enhance them:
- `/implement` works, but without latest library docs (context7)
- Web research works via WebFetch/WebSearch, but without raw markdown extraction (tavily)
- Session continuity works via local files and knowledge graph

## Browser Automation

For browser automation and testing, use the `agent-browser` skill instead of an MCP.
See `/ork:agent-browser` for Vercel's headless browser CLI.