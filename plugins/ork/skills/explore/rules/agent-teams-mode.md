---
title: Coordinate multi-agent exploration teams with real-time discovery sharing
impact: HIGH
impactDescription: "Enables coordinated multi-agent exploration with real-time discovery sharing"
tags: agent-teams, orchestration, explore
---

# Agent Teams Mode

In Agent Teams mode, form an exploration team where explorers share discoveries in real-time:

```python
# CC 2.1.178+: one implicit team per session — no TeamCreate.
# Spawn teammates directly via Agent(name=...). Requires
# CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (set in ork.settings.json).

Agent(subagent_type="Explore", name="structure-explorer",
     team_name="explore-{topic}",
     prompt="""Find all files, classes, and functions related to: {topic}
     When you discover key entry points, message data-flow-explorer so they
     can trace data paths from those points.
     When you find backend patterns, message backend-explorer.
     When you find frontend components, message frontend-explorer.""")

Agent(subagent_type="Explore", name="data-flow-explorer",
     team_name="explore-{topic}",
     prompt="""Trace entry points, processing, and storage for: {topic}
     When structure-explorer shares entry points, start tracing from those.
     When you discover cross-boundary data flows (frontend→backend or vice versa),
     message both backend-explorer and frontend-explorer.""")

Agent(subagent_type="ork:backend-system-architect", name="backend-explorer",
     team_name="explore-{topic}",
     prompt="""Analyze backend architecture patterns for: {topic}
     When structure-explorer or data-flow-explorer share backend findings,
     investigate deeper — API design, database schema, service patterns.
     Share integration points with frontend-explorer for consistency.""")

Agent(subagent_type="ork:frontend-ui-developer", name="frontend-explorer",
     team_name="explore-{topic}",
     prompt="""Analyze frontend components, state, and routes for: {topic}
     When structure-explorer shares component locations, investigate deeper.
     When backend-explorer shares API patterns, verify frontend alignment.
     Share component hierarchy with data-flow-explorer.""")
```

## Team Teardown

After report generation:

```python
# CC 2.1.178+: no TeamDelete — teammates wind down at turn end
# (press Ctrl+F twice to stop lingering background teammates).

# Worktree cleanup (CC 2.1.72)
ExitWorktree(action="keep")
```

> **Fallback:** If team formation fails, use standard Task tool spawns. See [exploration-agents.md](exploration-agents.md).

**Incorrect — Sequential exploration without coordination:**
```python
Agent(subagent_type="Explore", prompt="Find auth files")
# Wait for result...
Agent(subagent_type="Explore", prompt="Trace auth data flow")
# Sequential, no sharing between agents
```

**Correct — Team mode with real-time discovery sharing:**
```python
# CC 2.1.178+: one implicit team per session — no TeamCreate.
# Spawn teammates directly via Agent(name=...). Requires
# CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (set in ork.settings.json).
Agent(subagent_type="Explore", name="structure-explorer",
     team_name="explore-auth",
     prompt="Find auth files. Message data-flow-explorer with entry points.")
Agent(subagent_type="Explore", name="data-flow-explorer",
     team_name="explore-auth",
     prompt="When structure-explorer shares entry points, trace data flows.")
# Parallel execution, coordinated via messages
```
