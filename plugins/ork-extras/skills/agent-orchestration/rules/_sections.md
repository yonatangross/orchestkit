---
title: Agent Orchestration Rule Categories
version: 2.0.0
---

# Rule Categories

Loop and framework tutorial rules were retired to first-party sources on 2026-07-31; see
"Upstream coverage (do not restate)" in SKILL.md and `../references/ork-delta.md` for the
rescued house defaults.

## 1. Multi-Agent Coordination (multi) - CRITICAL - 2 rules

Patterns for coordinating multiple specialized agents.

- `multi-supervisor.md` - Supervisor routing with fan-out/fan-in, dependency ordering, and CC Agent Teams
- `multi-debate.md` - Conflict resolution via confidence scoring and LLM arbitration, agent communication bus

## 2. Multi-Scenario (scenario) - MEDIUM - 2 rules

Orchestrate skills across parallel difficulty scenarios with synchronized state.

- `scenario-orchestrator.md` - Parallel fan-out to 3 difficulty tiers (1x/3x/8x), LangGraph state machine, result aggregation
- `scenario-routing.md` - Milestone synchronization modes, difficulty scaling strategies, checkpointing and failure recovery
