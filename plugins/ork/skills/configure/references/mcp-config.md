# MCP Configuration

MCPs (Model Context Protocol servers) enhance OrchestKit commands but are **NOT required**.
Commands work without them - MCPs just add extra capabilities.

## Available MCPs

| MCP | Purpose | Storage | Enhances |
|-----|---------|---------|----------|
| **context7** | Up-to-date library docs | Cloud (Upstash) | /ork:implement, /ork:verify, /ork:review-pr |
| **sequential-thinking** | Structured reasoning | None | Sonnet/Haiku subagents needing multi-step reasoning |
| **memory** | Knowledge graph | Local file | Decisions, patterns, entities |
| **tavily** | Web search, extract, crawl | Cloud (Tavily) | /ork:explore, /ork:implement, web-research agents |
| **agentation** | UI annotation tool | Local daemon | UI feedback → automatic agent pickup |
| **notebooklm-mcp** | Google NotebookLM RAG | Cloud (Google) | External knowledge base, research synthesis, studio content |

> **Subagent Model Note:** Sequential-thinking MCP is redundant for Opus 4.6+ (which has native adaptive thinking), but OrchestKit ships 30+ Sonnet/Haiku subagents that **do not** have native extended thinking. These subagents benefit from sequential-thinking for complex multi-step reasoning. Enable it for the subagent mix, not the parent model.

## Default State

OrchestKit ships **all 5 MCPs enabled** in `.mcp.json`. Tavily requires an API key (`TAVILY_API_KEY` via 1Password) — it connects but tools fail without the key. Agentation requires `npm install -D agentation-mcp`.

## Two-Layer MCP Control (CC 2.1.49)

CC uses two layers to determine which MCP servers are active. Understanding both prevents configuration contradictions.

**Layer 1: `.mcp.json`** — Server definitions and self-declaration
- `"disabled": false` (or omitted) → server process starts, tools load
- `"disabled": true` → server process does NOT start, 0 tokens consumed

**Layer 2: `settings.json` / `settings.local.json`** — User approval
- `enableAllProjectMcpServers: true` → **overrides** Layer 1's `disabled` flag for all servers
- `enabledMcpjsonServers: [...]` → allowlist of approved servers
- `disabledMcpjsonServers: [...]` → denylist (takes precedence over allowlist)

**Important:** `enableAllProjectMcpServers: true` overrides `disabled: true` in `.mcp.json`. If you want a server truly off, either remove it from `.mcp.json` entirely or add it to `disabledMcpjsonServers` in settings.

OrchestKit ships `.mcp.json` with all servers `disabled: false` and `settings.local.json` with an `enabledMcpjsonServers` allowlist. No contradictions.

## Per-Agent MCP Scoping (CC 2.1.49)

Agent frontmatter supports `mcpServers` to control which MCP servers a subagent can access:

```yaml
---
name: web-research-analyst
mcpServers: [tavily]
---
```

- **`mcpServers` omitted** → agent inherits ALL MCP tools from parent session
- **`mcpServers: [tavily]`** → agent ONLY sees tavily tools
- **`mcpServers: []`** → agent sees NO MCP tools

OrchestKit agents declare `mcpServers` explicitly to avoid inheriting unnecessary tool definitions into their smaller context windows (Sonnet: 128K vs Opus: 200K).

## Background Agent Limitation

**MCP tools are NOT available in background subagents.** This is a hard CC platform limitation.

Agents spawned with `run_in_background: true` or `background: true` cannot call any MCP tools (tavily, context7, memory, sequential-thinking, agentation). Design background agents to use only built-in CC tools (Read, Grep, Glob, Bash, etc.).

If a background agent needs MCP tools, run it in the foreground instead.

## Token Overhead & MCPSearch

Each connected MCP adds tool definitions to the context window:

| MCP | Tools | ~Tokens |
|-----|-------|---------|
| context7 | 2 | ~400 |
| memory | 8 | ~1200 |
| sequential-thinking | 1 | ~600 |
| tavily | 5 | ~2000 |
| agentation | 8 | ~1500 |
| **Total** | **24** | **~5700** |

**MCPSearch (default since CC 2.1.7):** When MCP tool schemas exceed 10% of the context window, CC automatically defers schema loading and uses an `MCPSearch` tool to discover tools on demand — reducing overhead by ~85%.

With 5 MCPs (~5.7K tokens = 2.8% of 200K), schemas load upfront. This is acceptable. If you add more MCPs and cross the 10% threshold, MCPSearch activates automatically.

**Tighten the threshold:** Set `ENABLE_TOOL_SEARCH=auto:5` in your shell profile to defer at 5% instead of 10%.

**Note:** MCPSearch requires Sonnet 4+ or Opus 4+ — Haiku agents cannot use it and always get full schema overhead. OrchestKit's 2 Haiku agents (ci-cd-engineer, release-engineer) use `mcpServers` scoping to minimize their MCP exposure.

## Enabling/Disabling MCPs

Edit `.mcp.json` and set `"disabled": true` or `false` for each MCP:

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
      "disabled": false
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": { "MEMORY_FILE": ".claude/memory/memory.json" },
      "disabled": false
    },
    "tavily": {
      "command": "sh",
      "args": ["-c", "TAVILY_API_KEY=$(op read 'op://Private/Tavily API Key/API Key') exec npx -y tavily-mcp@latest"],
      "disabled": false
    },
    "agentation": {
      "command": "npx",
      "args": ["-y", "agentation-mcp", "server"],
      "disabled": false
    }
  }
}
```

To disable a specific MCP, set `"disabled": true` in `.mcp.json`. Ensure `settings.local.json` does NOT have `enableAllProjectMcpServers: true` (which would override the disabled flag).

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
| agentation | `npm install -D agentation-mcp` in project |
| notebooklm-mcp | `uv tool install notebooklm-mcp-cli` + `nlm login` + `nlm setup add claude-code` |

## Plugin Integration

OrchestKit agents and skills integrate with these MCPs:

| Component | MCP Used | Purpose |
|-----------|----------|---------|
| /ork:implement, /ork:verify, /ork:review-pr | context7 | Fetch current library docs |
| web-research-analyst, market-intelligence | tavily | Web search and content extraction |
| /ork:remember, /ork:memory | memory | Persist decisions across sessions |
| ui-feedback | agentation | Browser UI annotations → code fixes |
| notebooklm (skill) | notebooklm-mcp | External RAG, research, studio content |
| Sonnet/Haiku subagents | sequential-thinking | Structured reasoning for non-Opus models |

## Without MCPs

Commands still work - MCPs just enhance them:
- `/ork:implement` works, but without latest library docs (context7)
- Web research works via WebFetch/WebSearch, but without raw markdown extraction (tavily)
- Session continuity works via local files and knowledge graph

## Browser Automation

For browser automation and testing, use the `agent-browser` skill instead of an MCP.
See `/ork:agent-browser` for Vercel's headless browser CLI.