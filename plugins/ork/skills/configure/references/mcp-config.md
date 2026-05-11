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
| **stitch** | Official Google Stitch MCP — AI design → HTML/screenshots | Cloud (Google) | /ork:design-to-code, design-context-extractor |
| **21st-dev-magic** | React component registry (1.4M devs) | Cloud (21st.dev) | /ork:component-search, frontend-ui-developer |
| **storybook-mcp** | Project component discovery, testing, previews via Storybook 10.3+ | Local (localhost:6006) | /ork:design-to-code, component-curator, frontend-ui-developer |
| **notebooklm-mcp** | Google NotebookLM RAG | Cloud (Google) | External knowledge base, research synthesis, studio content |
| **fal** | AI inference (1000+ models: FLUX.2, Kling, LTX, TTS) | Cloud (fal.ai) | multimodal-specialist, demo-producer, design-to-code |

> **Subagent Model Note:** Sequential-thinking MCP is redundant for Opus 4.6+ (which has native adaptive thinking), but OrchestKit ships 30+ Sonnet/Haiku subagents that **do not** have native extended thinking. These subagents benefit from sequential-thinking for complex multi-step reasoning. Enable it for the subagent mix, not the parent model.

## Recommended MCPs by Project Type

Not sure which MCPs to enable? Match your project type:

| Project Type | Recommended MCPs | Why |
|---|---|---|
| **Full-stack React** | context7, memory, storybook-mcp, 21st-dev-magic, stitch | Component reuse, design extraction, latest API docs |
| **Backend Python/Node** | context7, memory, tavily | Library docs, decision persistence, web research |
| **Design system** | stitch, storybook-mcp, 21st-dev-magic, context7 | Figma extraction, component discovery, registry search |
| **AI/LLM project** | context7, memory, tavily, fal, sequential-thinking | API docs, pattern memory, research, image/video/TTS inference, structured reasoning |
| **Generative media** | fal, memory, stitch, 21st-dev-magic | Image/video/audio generation, design extraction, component registry |
| **Open source library** | context7, memory | Minimal footprint — docs + decision tracking |
| **Research/analysis** | tavily, memory, notebooklm-mcp | Web search, knowledge graph, RAG synthesis |

All MCPs are optional — OrchestKit works without any. Enable what fits your workflow. See setup instructions for each MCP in the Dependencies section below.

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
    },
    "21st-dev-magic": {
      "command": "npx",
      "args": ["-y", "@21st-dev/magic@latest"],
      "env": { "API_KEY": "${TWENTYFIRST_DEV_API_KEY}" },
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
| stitch | API key from [stitch.withgoogle.com/settings](https://stitch.withgoogle.com/settings). Add via: `claude mcp add stitch --transport http https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: YOUR-KEY" -s user` |
| 21st-dev-magic | API key from https://21st.dev (free tier available). Set `TWENTYFIRST_DEV_API_KEY` env var |
| storybook-mcp | Storybook 10.3+ with `@storybook/addon-mcp`. Setup: `npx storybook add @storybook/addon-mcp && npx mcp-add --type http --url "http://localhost:6006/mcp" --scope project`. Requires Vite builder + running Storybook |

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
| /ork:design-to-code, design-context-extractor | stitch | AI design → HTML, screenshot extraction, design context |
| /ork:component-search, component-curator | 21st-dev-magic | Search + retrieve production React components |
| /ork:design-to-code, component-curator, frontend-ui-developer | storybook-mcp | Component discovery, story previews, test verification |

## Without MCPs

Commands still work - MCPs just enhance them:
- `/ork:implement` works, but without latest library docs (context7)
- Web research works via WebFetch/WebSearch, but without raw markdown extraction (tavily)
- Session continuity works via local files and knowledge graph

## Browser Automation

For browser automation and testing, use the `agent-browser` skill instead of an MCP.

## CC 2.1.128/129 changes that affect `.mcp.json` and plugin manifests

We floor at `2.1.138`, so all of these apply by default.

### Reserved server name: `workspace` (CC 2.1.128)

`workspace` is a reserved MCP server name in CC 2.1.128+. Any `.mcp.json` entry using it is silently skipped with a warning. Pick any other identifier — none of OrchestKit's bundled servers use this name.

### `deniedMcpServers` is case-insensitive on hostnames (CC 2.1.129)

`deniedMcpServers` patterns with `*://` scheme wildcards now match hostnames case-insensitively (RFC-correct). You no longer need defensive case-variant duplication:

```jsonc
// before (CC ≤ 2.1.128 — both required to actually deny)
"deniedMcpServers": ["*://example.com", "*://EXAMPLE.com"]

// at our floor (one entry covers all case variants)
"deniedMcpServers": ["*://example.com"]
```

### `/mcp` shows tool counts and flags zero-tool servers (CC 2.1.128)

```
$ claude  /mcp
  github       connected · 12 tools
  notebooklm   connected · 24 tools
  myserver     connected · 0 tools  ⚠
```

A zero-tool count after a successful connection means `tools/list` failed silently — usually a stdio MCP server crashed during the handshake. CC 2.1.132+ retries `tools/list` once automatically, but if the count stays zero, the server is misconfigured.

### Plugin manifest `monitors` and `themes` move under `experimental` (CC 2.1.129)

CC 2.1.129+ expects plugin manifests to declare `monitors` and `themes` under an `"experimental"` block. Top-level still works but `claude plugin validate` warns. Future CC versions are expected to error on top-level entries.

```jsonc
// .claude-plugin/plugin.json (post-CC 2.1.129 shape)
{
  "name": "your-plugin",
  "version": "1.0.0",
  "skills": "./skills/",
  "experimental": {
    "monitors": "./monitors/monitors.json"
  }
}
```

OrchestKit's source manifest (`manifests/ork.json`) and built `plugins/ork/.claude-plugin/plugin.json` use the new shape as of v7.86.0 — see `scripts/build-plugins.sh` for the codegen.

### `CLAUDE_CODE_SHELL_PREFIX` no longer corrupts MCP stdio argv (CC 2.1.128)

If you wrap CC in `nix-shell --run`, `direnv exec`, or similar via `CLAUDE_CODE_SHELL_PREFIX`, stdio MCP servers used to receive corrupted argv when their command-line args contained spaces or shell metacharacters. CC 2.1.128 preserves quoting through the prefix wrap. No action required at our floor — just notable history.

## CC 2.1.132 changes

### `/mcp` shows `needs auth` instead of `failed` for unauthorized claude.ai connectors

Before 2.1.132, an unauthorized claude.ai MCP connector (HTTP 401) showed up in `/mcp` as `failed` — indistinguishable from a server that crashed during connect. CC 2.1.132 reports it as `needs auth`, so the user knows to run the connector's authorization flow.

```
$ claude  /mcp
  github       connected · 12 tools
  notion       needs auth                       ← run the connector's authorize flow
  brokensvr    failed                           ← genuinely broken — investigate
  flakysvr     connected · tools fetch failed   ← retried tools/list once and gave up (see below)
```

### Headless `-p` retries `tools/list` once then surfaces `connected · tools fetch failed`

Before 2.1.132, MCP servers that connected successfully but then failed `tools/list` (for example, a stdio server crashing right after the handshake) silently appeared as `0 tools` with no error surface. CC 2.1.132 retries `tools/list` exactly once and, if it still fails, displays `connected · tools fetch failed` in `/mcp`. In headless `-p` mode the same status string lands in stderr/output so CI scripts can detect it.

CC 2.1.132 also stops retrying non-transient 4xx connection failures in `-p` mode — auth-required connectors now fail fast instead of consuming the retry budget.

**OrchestKit impact**: `/ork:doctor`'s MCP check can branch on three concrete states (`needs auth`, `connected · tools fetch failed`, `failed`) instead of conflating all of them as "broken". No `.mcp.json` change needed at our floor.

## CC 2.1.133 changes

### MCP OAuth flow now respects `HTTP(S)_PROXY` / `NO_PROXY` / mTLS

Before 2.1.133, CC's MCP OAuth client opened HTTP connections directly to the OAuth endpoints regardless of `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, or mTLS client-cert settings. The MCP server itself was reachable via the proxy (because the MCP transport already respected it) but every OAuth step bypassed the proxy: discovery (`/.well-known/oauth-authorization-server`), **dynamic client registration (DCR)**, the initial token exchange, and every subsequent refresh.

CC 2.1.133 routes the entire MCP OAuth flow through the same proxy/mTLS configuration as the rest of CC's HTTP traffic.

```bash
# Enterprise behind a corporate proxy with mTLS to internal MCP servers
export HTTPS_PROXY=http://proxy.corp.example.com:3128
export NO_PROXY=localhost,127.0.0.1,.internal.example.com
export NODE_EXTRA_CA_CERTS=/etc/ssl/corp-ca-bundle.pem
# Optional mTLS client cert + key for the OAuth endpoint
export CLAUDE_CODE_MCP_CLIENT_CERT=/etc/ssl/claude-client.pem
export CLAUDE_CODE_MCP_CLIENT_KEY=/etc/ssl/claude-client.key
claude
```

**OrchestKit impact**: Enterprise deployments behind corporate proxies (Citrix/VDI, BYOK gateway, ZTNA) can connect to OAuth-protected MCP servers without per-flow workarounds. `.mcp.json` entries for OAuth-protected servers need no special config — the env-var-driven proxy/mTLS setup is honored end-to-end. The `mcp-patterns` SKILL.md and the `building-mcp-server-on-cloudflare` skill both reference this fix; if your customer skill warned users that "MCP OAuth bypasses HTTPS_PROXY", that caveat can be removed at our floor.

See the `agent-browser` skill for Vercel's headless browser CLI.