---
name: multi-scenario-orchestration
description: Orchestrate single user-invocable skill across 3 parallel scenarios with synchronized state and progressive difficulty. Use for demos, testing, and progressive validation workflows.
tags: [orchestration, parallel, supervisor, state-machine, scenario, testing]
context: fork
agent: workflow-architect
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# Multi-Scenario Orchestration

**Design patterns for showcasing one skill across 3 parallel scenarios with synchronized execution and progressive difficulty.**

## Core Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                   MULTI-SCENARIO ORCHESTRATOR                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Coordinator] ──┬─→ [Scenario 1: Simple]       (Easy)            │
│       ▲          │      └─→ [Skill Instance 1]                    │
│       │          ├─→ [Scenario 2: Medium]       (Intermediate)    │
│       │          │      └─→ [Skill Instance 2]                    │
│       │          └─→ [Scenario 3: Complex]      (Advanced)        │
│       │                 └─→ [Skill Instance 3]                    │
│       │                                                             │
│   [State Manager] ◄──── All instances report progress              │
│   [Aggregator] ─→ Cross-scenario synthesis                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## When to Use

| Scenario | Example |
|----------|---------|
| **Skill demos** | Show `/implement` on simple, medium, complex tasks |
| **Progressive testing** | Validate skill scales with complexity |
| **Comparative analysis** | How does approach differ by difficulty? |
| **Training/tutorials** | Show skill progression from easy to hard |

## Quick Start

```python
from langgraph.graph import StateGraph

# 1. Define 3 scenarios with progressive difficulty
scenarios = [
    {"name": "simple", "complexity": 1.0, "input_size": 10},
    {"name": "medium", "complexity": 3.0, "input_size": 50},
    {"name": "complex", "complexity": 8.0, "input_size": 200},
]

# 2. Fan out to parallel execution
# 3. Aggregate results
# 4. Report comparative metrics
```

## Scenario Difficulty Scaling

| Level | Complexity | Input Size | Time Budget | Quality |
|-------|------------|------------|-------------|---------|
| Simple | 1x | Small (10) | 30s | Basic |
| Medium | 3x | Medium (50) | 90s | Good |
| Complex | 8x | Large (200) | 300s | Excellent |

## Synchronization Modes

| Mode | Description | Use When |
|------|-------------|----------|
| **Free-running** | All run independently | Demo videos |
| **Milestone-sync** | Wait at 30%, 70%, 100% | Comparative analysis |
| **Lock-step** | All proceed together | Training |

## Key Components

1. **Coordinator** - Spawns and monitors 3 instances
2. **State Manager** - Tracks progress per scenario
3. **Aggregator** - Merges results, extracts patterns

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Synchronization mode | Free-running with checkpoints |
| Scenario count | Always 3: simple, medium, complex |
| Input scaling | 1x, 3x, 8x (exponential) |
| Time budgets | 30s, 90s, 300s |
| Checkpoint frequency | Every milestone + completion |

## Common Mistakes

- **Sequential instead of parallel**: Defeats purpose. Always fan-out.
- **No synchronization**: Results appear disjointed.
- **Unclear difficulty scaling**: Differ in scale, not approach.
- **Missing aggregation**: Individual results lack comparative insights.

## Related Skills

- `langgraph-supervisor` - Supervisor routing pattern
- `langgraph-parallel` - Fan-out/fan-in execution
- `langgraph-state` - State management
- `langgraph-checkpoints` - Persistence
- `multi-agent-orchestration` - Coordination patterns

## References

- [Architectural Patterns](references/architectural-patterns.md) - Full architecture
- [State Machine Design](references/state-machine-design.md) - LangGraph state
- [LangGraph Implementation](references/langgraph-implementation.md) - Code examples
- [Claude Code Instance Management](references/claude-code-instance-management.md) - Multi-instance
- [Skill-Agnostic Template](references/skill-agnostic-template.md) - Reusable template
