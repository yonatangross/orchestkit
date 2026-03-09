# T1/T2/T3 Graceful Degradation

Every skill MUST work at T1 (zero MCP servers). T2 and T3 enhance but are never required.

## Tier Definitions

| Tier | MCP Servers | Install | Who Has It |
|------|-----------|---------|-----------|
| T1: Core | None | Built into CC | Every CC user |
| T2: Enhanced | memory, context7, sequential-thinking | `npm install` (free) | Most CC users |
| T3: Power | tavily, agent-browser | API keys required | Power users |

## Fallback Matrix

| MCP Tool | T2/T3 Behavior | T1 Fallback |
|----------|----------------|-------------|
| `mcp__memory__search_nodes` | Search past decisions | Skip — rely on codebase Grep |
| `mcp__memory__create_entities` | Save patterns | Skip — patterns not persisted |
| `mcp__context7__query-docs` | Live library docs | `WebFetch` docs URL directly |
| `mcp__sequential-thinking__*` | Structured reasoning | Use inline evaluation rubric |
| `mcp__tavily__tavily_search` | Deep web search | `WebSearch` (CC built-in) |

## Implementation Pattern

```python
# Read capabilities (written by MCP probe at skill start)
caps = JSON.parse(Read(".claude/chain/capabilities.json"))

# Pattern: check before every MCP call
if caps.memory:
    results = mcp__memory__search_nodes(query="auth error patterns")
    # Use results to enrich analysis
else:
    # T1 path: search codebase directly
    Grep(pattern="auth.*error", glob="**/*.ts")
    # Slightly less context, but still functional
```

## Rules

1. **Never assume MCP exists** — always check `capabilities.json`
2. **Never error on missing MCP** — skip gracefully with fallback
3. **T1 must produce useful output** — reduced quality is OK, failure is not
4. **Log which tier is active** — include in handoff files (`mcps_used` field)
