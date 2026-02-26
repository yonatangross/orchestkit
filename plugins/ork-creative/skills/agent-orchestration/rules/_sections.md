---
title: Agent Orchestration Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Agent Loops (loops) — HIGH — 2 rules

Autonomous LLM reasoning patterns for single-agent workflows.

- `loops-react.md` — ReAct (Reasoning + Acting) loop with tool execution, self-correction, and memory management
- `loops-plan-execute.md` — Plan-and-Execute with replanning, step validation, and goal-oriented synthesis

## 2. Multi-Agent Coordination (multi) — CRITICAL — 3 rules

Patterns for coordinating multiple specialized agents.

- `multi-supervisor.md` — Supervisor routing with fan-out/fan-in, dependency ordering, and CC Agent Teams
- `multi-debate.md` — Conflict resolution via confidence scoring and LLM arbitration, agent communication bus
- `multi-synthesis.md` — Result synthesis with category grouping, executive summaries, and confidence scoring

## 3. Alternative Frameworks (frameworks) — HIGH — 3 rules

Multi-agent frameworks beyond LangGraph for specialized use cases.

- `frameworks-crewai.md` — CrewAI hierarchical crews, Flows architecture (1.8+), MCP tools, structured output
- `frameworks-autogen.md` — Microsoft Agent Framework (AutoGen + SK), RoundRobin/Selector teams, A2A protocol
- `frameworks-comparison.md` — Decision matrix, feature comparison, migration paths, cost and performance analysis

## 4. Multi-Scenario (scenario) — MEDIUM — 2 rules

Orchestrate skills across parallel difficulty scenarios with synchronized state.

- `scenario-orchestrator.md` — Parallel fan-out to 3 difficulty tiers (1x/3x/8x), LangGraph state machine, result aggregation
- `scenario-routing.md` — Milestone synchronization modes, difficulty scaling strategies, checkpointing and failure recovery
