---
title: "Scenario: Multi-Scenario Orchestrator"
category: scenario
impact: MEDIUM
impactDescription: "Ensures skills are tested across three parallel scenarios with progressive difficulty and synchronized execution"
tags: scenarios, orchestration, parallel, testing, scaling
---

# Multi-Scenario Orchestrator

Run a single skill across 3 parallel scenarios (simple/medium/complex) with synchronized execution and progressive difficulty.

## Core Pattern

```
+---------------------------------------------------------------------+
|                   MULTI-SCENARIO ORCHESTRATOR                        |
+---------------------------------------------------------------------+
|  [Coordinator] --+--> [Scenario 1: Simple]       (Easy)             |
|       ^          |      +--> [Skill Instance 1]                     |
|       |          +--> [Scenario 2: Medium]       (Intermediate)     |
|       |          |      +--> [Skill Instance 2]                     |
|       |          +--> [Scenario 3: Complex]      (Advanced)         |
|       |                 +--> [Skill Instance 3]                     |
|       |                                                             |
|   [State Manager] <---- All instances report progress               |
|   [Aggregator] --> Cross-scenario synthesis                         |
+---------------------------------------------------------------------+
```

## When to Use

| Scenario | Example |
|----------|---------|
| **Skill demos** | Show `/implement` on simple, medium, complex tasks |
| **Progressive testing** | Validate skill scales with complexity |
| **Comparative analysis** | How does approach differ by difficulty? |
| **Training/tutorials** | Show skill progression from easy to hard |

## LangGraph Implementation

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command, Send

async def scenario_supervisor(state: ScenarioOrchestratorState) -> list[Command]:
    """Route to all 3 scenarios in parallel."""
    for scenario_id in ["simple", "medium", "complex"]:
        state[f"progress_{scenario_id}"] = ScenarioProgress(
            scenario_id=scenario_id, status="pending",
            start_time_ms=int(time.time() * 1000)
        )

    return [
        Send("scenario_worker", {"scenario_id": "simple", **state}),
        Send("scenario_worker", {"scenario_id": "medium", **state}),
        Send("scenario_worker", {"scenario_id": "complex", **state}),
    ]

async def scenario_worker(state: ScenarioOrchestratorState) -> dict:
    """Execute one scenario."""
    scenario_id = state.get("scenario_id")
    progress = state[f"progress_{scenario_id}"]
    scenario_def = state[f"scenario_{scenario_id}"]

    progress.status = "running"
    try:
        result = await execute_skill_with_milestones(
            skill_name=state["skill_name"],
            scenario_def=scenario_def,
            progress=progress, state=state
        )
        progress.status = "complete"
        progress.elapsed_ms = int(time.time() * 1000) - progress.start_time_ms
        return {f"progress_{scenario_id}": progress}
    except Exception as e:
        progress.status = "failed"
        progress.errors.append({"message": str(e)})
        return {f"progress_{scenario_id}": progress}

async def scenario_aggregator(state: ScenarioOrchestratorState) -> dict:
    """Collect all results and synthesize findings."""
    aggregated = {
        "orchestration_id": state["orchestration_id"],
        "metrics": {},
        "comparison": {},
        "recommendations": []
    }

    for scenario_id in ["simple", "medium", "complex"]:
        progress = state[f"progress_{scenario_id}"]
        aggregated["metrics"][scenario_id] = {
            "elapsed_ms": progress.elapsed_ms,
            "items_processed": progress.items_processed,
            "quality_scores": progress.quality_scores,
        }

    return {"final_results": aggregated}

# Build graph
graph = StateGraph(ScenarioOrchestratorState)
graph.add_node("supervisor", scenario_supervisor)
graph.add_node("scenario_worker", scenario_worker)
graph.add_node("aggregator", scenario_aggregator)
graph.add_edge(START, "supervisor")
graph.add_edge("scenario_worker", "aggregator")
graph.add_edge("aggregator", END)
app = graph.compile(checkpointer=checkpointer)
```

## Skill-Agnostic Template

```python
from abc import ABC, abstractmethod

class SkillOrchestrator(ABC):
    """Abstract orchestrator for any user-invocable skill."""

    def __init__(self, skill_name: str, skill_version: str):
        self.skill_name = skill_name
        self.skill_version = skill_version

    @abstractmethod
    async def invoke_skill(self, input_data: list[dict], scenario_params: dict) -> dict:
        """Invoke your skill on input data."""
        pass

    @abstractmethod
    def get_scenario_configs(self) -> dict[str, dict]:
        """Return configs for simple/medium/complex."""
        pass

    @abstractmethod
    def calculate_quality_metrics(self, results: list[dict], metric_names: list[str]) -> dict:
        """Calculate quality metrics from results."""
        pass

    async def orchestrate(self, orchestration_id: str) -> dict:
        """Run all 3 scenarios in parallel and aggregate."""
        results = await asyncio.gather(
            self.run_scenario("simple", orchestration_id),
            self.run_scenario("medium", orchestration_id),
            self.run_scenario("complex", orchestration_id),
            return_exceptions=True
        )
        return self.aggregate_results(results)
```

## Difficulty Scaling

| Level | Complexity | Input Size | Time Budget | Quality |
|-------|------------|------------|-------------|---------|
| Simple | 1x | Small (10-100) | 30s | Basic |
| Medium | 3x | Medium (30-300) | 90s | Good |
| Complex | 8x | Large (80-800) | 300s | Excellent |

## Output Example

```json
{
  "orchestration_id": "demo-001",
  "quality_comparison": {
    "simple": 0.92, "medium": 0.88, "complex": 0.84
  },
  "scaling_analysis": {
    "time_per_item_ms": {
      "simple": 0.012, "medium": 0.012, "complex": 0.032
    },
    "recommendation": "Sublinear scaling up to 3x, superlinear at 8x"
  }
}
```

## Common Mistakes

- Sequential instead of parallel (defeats purpose)
- No synchronization (results appear disjointed)
- Unclear difficulty scaling (differ in scale, not approach)
- Missing aggregation (individual results lack comparative insights)
