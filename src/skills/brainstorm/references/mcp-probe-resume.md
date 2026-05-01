# MCP Probe + Resume Check

Run this **once at skill start** to detect available MCP servers and resume any prior session that crashed mid-phase.

## Probe MCP servers

```python
ToolSearch(query="select:mcp__memory__search_nodes")  # CC < 2.1.121 fallback (alwaysLoad in .mcp.json otherwise)
ToolSearch(query="select:mcp__sequential-thinking__sequentialthinking")
```

Detailed detection patterns: `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/mcp-detection.md")`.

## Store capabilities

```python
Write(".claude/chain/capabilities.json", {
  "memory": probe_memory.found,
  "sequential_thinking": probe_st.found,
  "skill": "brainstorm",
  "timestamp": now()
})
```

## Resume from prior crash

```python
state = Read(".claude/chain/state.json")  # may not exist
if state.skill == "brainstorm" and state.status == "in_progress":
    # Skip completed phases, resume from state.current_phase
    last_handoff = Read(f".claude/chain/{state.last_handoff}")
```

## Phase Handoff Files

Each phase writes a handoff file consumed by the next phase:

| Phase | Handoff File                  | Contents                                       |
|-------|-------------------------------|------------------------------------------------|
| 0     | `00-topic-analysis.json`      | Agent list, tier, topic classification         |
| 1     | `01-memory-context.json`      | Prior patterns, codebase signals               |
| 2     | `02-divergent-ideas.json`     | 10+ raw ideas                                  |
| 3     | `03-feasibility.json`         | Filtered viable ideas                          |
| 4     | `04-evaluation.json`          | Rated + devil's advocate results               |
| 5     | `05-synthesis.json`           | Top 2-3 approaches, trade-off table            |
