# MCP Detection via ToolSearch

Probe MCP server availability before using any MCP tool. This prevents hard crashes when a user doesn't have a specific MCP server configured.

## Probe Pattern

```python
# Run ALL probes in ONE message (parallel, ~50ms each):
ToolSearch(query="select:mcp__memory__search_nodes")
ToolSearch(query="select:mcp__context7__resolve-library-id")
ToolSearch(query="select:mcp__sequential-thinking__sequentialthinking")

# Write capability map (read by all subsequent phases):
Write(".claude/chain/capabilities.json", JSON.stringify({
  "memory": true,        // or false if ToolSearch returned no results
  "context7": true,
  "sequential": false,   // not installed
  "timestamp": "2026-03-07T16:30:00Z"
}))
```

## Usage in Skill Phases

```python
# Read capabilities (already written at skill start):
caps = Read(".claude/chain/capabilities.json")

# BEFORE any MCP call, check capability:
if caps.memory:
    mcp__memory__search_nodes(query="past fixes for auth errors")
else:
    # T1 fallback: skip memory search, rely on codebase grep
    Grep(pattern="auth.*error", glob="**/*.ts")

if caps.context7:
    mcp__context7__query-docs(libraryId="...", query="...")
else:
    # T1 fallback: WebFetch docs directly
    WebFetch("https://docs.example.com/api")

if caps.sequential:
    mcp__sequential-thinking__sequentialthinking(thought="...", ...)
else:
    # T1 fallback: use inline evaluation rubric
    # (the skill's own SKILL.md scoring instructions)
```

## 3-Tier Model

| Tier | Servers | Who Has It |
|------|---------|-----------|
| T1: Core | None (CC built-in tools only) | Every CC user |
| T2: Enhanced | memory, context7, sequential-thinking | Most CC users (free npm MCPs) |
| T3: Power | tavily, agent-browser | Power users (API keys required) |

**Rule:** T1 MUST always work. T2/T3 enhance but never required.

## Important Notes

- ToolSearch is fast (~50ms) — probe overhead is negligible
- Probe ONCE at skill start, not before every MCP call
- Store in `.claude/chain/capabilities.json` so all phases can read it
- If a probe fails (tool not found), treat as `false` — never error
