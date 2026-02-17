---
title: Agent Teams Mode
impact: HIGH
impactDescription: "Enables coordinated multi-agent exploration with real-time discovery sharing"
tags: agent-teams, orchestration, explore
---

# Agent Teams Mode

In Agent Teams mode, form an exploration team where explorers share discoveries in real-time:

```python
TeamCreate(team_name="explore-{topic}", description="Explore {topic}")

Task(subagent_type="Explore", name="structure-explorer",
     team_name="explore-{topic}",
     prompt="""Find all files, classes, and functions related to: {topic}
     When you discover key entry points, message data-flow-explorer so they
     can trace data paths from those points.
     When you find backend patterns, message backend-explorer.
     When you find frontend components, message frontend-explorer.""")

Task(subagent_type="Explore", name="data-flow-explorer",
     team_name="explore-{topic}",
     prompt="""Trace entry points, processing, and storage for: {topic}
     When structure-explorer shares entry points, start tracing from those.
     When you discover cross-boundary data flows (frontend→backend or vice versa),
     message both backend-explorer and frontend-explorer.""")

Task(subagent_type="backend-system-architect", name="backend-explorer",
     team_name="explore-{topic}",
     prompt="""Analyze backend architecture patterns for: {topic}
     When structure-explorer or data-flow-explorer share backend findings,
     investigate deeper — API design, database schema, service patterns.
     Share integration points with frontend-explorer for consistency.""")

Task(subagent_type="frontend-ui-developer", name="frontend-explorer",
     team_name="explore-{topic}",
     prompt="""Analyze frontend components, state, and routes for: {topic}
     When structure-explorer shares component locations, investigate deeper.
     When backend-explorer shares API patterns, verify frontend alignment.
     Share component hierarchy with data-flow-explorer.""")
```

## Team Teardown

After report generation:

```python
SendMessage(type="shutdown_request", recipient="structure-explorer", content="Exploration complete")
SendMessage(type="shutdown_request", recipient="data-flow-explorer", content="Exploration complete")
SendMessage(type="shutdown_request", recipient="backend-explorer", content="Exploration complete")
SendMessage(type="shutdown_request", recipient="frontend-explorer", content="Exploration complete")
TeamDelete()
```

> **Fallback:** If team formation fails, use standard Task tool spawns. See [exploration-agents.md](exploration-agents.md).

**Incorrect — Sequential exploration without coordination:**
```python
Task(subagent_type="Explore", prompt="Find auth files")
# Wait for result...
Task(subagent_type="Explore", prompt="Trace auth data flow")
# Sequential, no sharing between agents
```

**Correct — Team mode with real-time discovery sharing:**
```python
TeamCreate(team_name="explore-auth")
Task(subagent_type="Explore", name="structure-explorer",
     team_name="explore-auth",
     prompt="Find auth files. Message data-flow-explorer with entry points.")
Task(subagent_type="Explore", name="data-flow-explorer",
     team_name="explore-auth",
     prompt="When structure-explorer shares entry points, trace data flows.")
# Parallel execution, coordinated via messages
```
