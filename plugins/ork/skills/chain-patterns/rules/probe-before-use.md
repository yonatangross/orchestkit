---
title: Probe Before Use
impact: HIGH
impactDescription: Prevents crashes when MCP servers are not configured
tags: [mcp, resilience, toolsearch]
---

# Probe Before Use

Always run ToolSearch probes before calling any MCP tool.

## Incorrect

```python
# BAD: Assumes memory MCP exists — crashes if not installed
mcp__memory__search_nodes(query="past auth fixes")
```

## Correct

```python
# GOOD: Probe first, use conditionally
ToolSearch(query="select:mcp__memory__search_nodes")
# → if found: call it
# → if not found: skip or use Grep fallback

caps = Read(".claude/chain/capabilities.json")
if caps.memory:
    mcp__memory__search_nodes(query="past auth fixes")
else:
    Grep(pattern="auth.*fix", glob="**/*.md")
```

## When to Probe

- Once at skill start (not before every call)
- Store results in `.claude/chain/capabilities.json`
- All subsequent phases read the capability map

## Exception: alwaysLoad (CC 2.1.121+)

If the project's `.mcp.json` sets `"alwaysLoad": true` on a server, **skip the probe**. The server is in the tool registry from session start; the probe is wasted work. OrchestKit ships `alwaysLoad: true` for `memory`, `context7`, and `sequential-thinking` (the universally-needed T2 trio). On older CC, `alwaysLoad` is an unknown key and is silently ignored — the on-demand probe path still works as a fallback if the skill keeps it.

```python
# CC 2.1.121+ with alwaysLoad on the T2 trio: probe-free
mcp__memory__search_nodes(query="past auth fixes")     # always loaded
mcp__context7__resolve-library-id(libraryName="zod")    # always loaded
```
