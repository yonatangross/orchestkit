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
│       │          │                                                 │
│       │          ├─→ [Scenario 2: Medium]       (Intermediate)    │
│       │          │      └─→ [Skill Instance 2]                    │
│       │          │                                                 │
│       │          └─→ [Scenario 3: Complex]      (Advanced)        │
│       │                 └─→ [Skill Instance 3]                    │
│       │                                                             │
│   [State Manager] ◄──┬─── Instance 1 (progress)                    │
│   (Checkpoints)      │                                              │
│       │              ├─── Instance 2 (progress)                    │
│       │              │                                              │
│       └──────────────┴─── Instance 3 (progress)                    │
│                                                                     │
│  [Synchronization Points]                                          │
│   • T=0:    All scenarios start together                          │
│   • T=30%:  Medium scenario reaches first milestone                │
│   • T=50%:  Simple scenario complete, medium continues            │
│   • T=70%:  Medium complete, complex reaches halfway               │
│   • T=100%: All complete → [Aggregator]                           │
│                                                                     │
│  [Aggregator] ─→ Cross-scenario synthesis                         │
│                 Comparison metrics                                 │
│                 Difficulty vs. Result quality matrix               │
│                 Shared pattern extraction                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Architecture Overview

### 1. Scenario Definitions

Each scenario specifies **difficulty**, **input scale**, **constraints**:

```python
from typing import TypedDict, Literal
from dataclasses import dataclass

@dataclass
class ScenarioDefinition:
    """Template for any skill across 3 difficulty levels."""

    name: str                    # "simple", "medium", "complex"
    difficulty: Literal["easy", "intermediate", "advanced"]
    complexity_multiplier: float # 1.0x, 3.0x, 8.0x

    # Input scaling
    input_size: int              # Number of items to process
    dataset_characteristics: dict # {"distribution": "uniform|skewed|clustered"}

    # Constraints for this scenario
    time_budget_seconds: int     # Expected duration
    memory_limit_mb: int         # Max memory allowed
    error_tolerance: float       # 0.0 (strict) to 1.0 (lenient)

    # Skill-specific parameters
    skill_params: dict           # Custom skill config for this scenario

    # Expected outcomes
    expected_outcome_quality: Literal["basic", "good", "excellent"]
    quality_metrics: list[str]   # What to measure

@dataclass
class ScenarioProgress:
    """Track execution state for one scenario."""

    scenario_id: str
    status: Literal["pending", "running", "paused", "complete", "failed"]
    progress_pct: float          # 0-100

    # Milestones reached
    milestones_reached: list[str]
    current_milestone: str

    # Metrics
    elapsed_ms: int
    memory_used_mb: int
    items_processed: int

    # Results (accumulated)
    partial_results: list[dict]
    quality_scores: dict         # {metric: score}

    # Error tracking
    errors: list[dict]           # [{timestamp, message, severity}]

class ScenarioOrchestratorState(TypedDict):
    """Shared state for all 3 scenarios."""

    # Scenario definitions
    scenario_simple: ScenarioDefinition
    scenario_medium: ScenarioDefinition
    scenario_complex: ScenarioDefinition

    # Runtime progress
    progress_simple: ScenarioProgress
    progress_medium: ScenarioProgress
    progress_complex: ScenarioProgress

    # Coordination
    start_time_unix: int
    sync_points_reached: dict[str, float]  # {milestone: timestamp}
    is_synchronized: bool

    # Results aggregation
    final_results: dict
    comparison_matrix: dict
    shared_patterns: list[dict]
```

### 2. Synchronization Strategy

**Three synchronization modes:**

#### Mode A: Free-Running with Checkpoints

Scenarios run independently but store checkpoints at shared milestones:

```python
SYNCHRONIZATION_MILESTONES = [
    {"name": "start", "trigger": "immediate", "all_scenarios": True},
    {"name": "checkpoint_1", "trigger": "30% complete", "all_scenarios": True},
    {"name": "checkpoint_2", "trigger": "70% complete", "all_scenarios": True},
    {"name": "completion", "trigger": "100% complete", "all_scenarios": True},
]

async def scenario_worker(scenario_id: str, state: ScenarioOrchestratorState):
    """Run one scenario, sync at milestones."""

    progress = state[f"progress_{scenario_id}"]
    progress.status = "running"

    while progress.progress_pct < 100:
        # Run skill until next milestone
        next_milestone = get_next_milestone(progress.progress_pct)

        # Execute skill with this milestone as target
        await execute_skill_until_milestone(
            skill=state.skill_instance,
            params=state[f"scenario_{scenario_id}"].skill_params,
            target_milestone=next_milestone
        )

        # Sync: Wait for other scenarios or timeout
        await synchronize_at_milestone(
            scenario_id=scenario_id,
            milestone=next_milestone,
            timeout_seconds=30,  # Don't block forever
            state=state
        )

        # Store checkpoint
        await store_checkpoint(scenario_id, state)

    progress.status = "complete"
```

#### Mode B: Lock-Step Synchronization

All scenarios advance together, slowest determines pace:

```python
async def lockstep_coordinator(
    scenarios: dict[str, ScenarioDefinition],
    state: ScenarioOrchestratorState
):
    """All scenarios progress in lock-step."""

    # Start all scenarios
    tasks = [
        run_scenario_step(scenario_id, state)
        for scenario_id in scenarios.keys()
    ]

    while any(progress.status == "running" for progress in get_all_progress(state)):
        # Execute one step in all scenarios
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Record milestone for all
        record_synchronized_milestone(state)

        # Rebalance: Slower scenarios get more resources
        rebalance_compute_allocation(results, state)
```

#### Mode C: Milestone-Based Pausing

Faster scenarios pause at milestones, wait for others:

```python
PAUSE_AT_MILESTONES = [30, 50, 70, 90]  # Percentage

async def scenario_with_waits(scenario_id: str, state: ScenarioOrchestratorState):
    """Run scenario, pause at milestones for others to catch up."""

    while progress.progress_pct < 100:
        # Run until next sync point
        target_pct = next(m for m in PAUSE_AT_MILESTONES if m > progress.progress_pct)

        await run_skill_until(target_pct, state)

        # Pause and wait for other scenarios
        while any(p.progress_pct < target_pct - 5 for p in get_other_progress(scenario_id)):
            await asyncio.sleep(1)  # Check every second

            # Allow timeout for truly slow scenarios
            if elapsed_at_milestone() > 60:  # 60 second max wait
                break

        record_milestone(scenario_id, target_pct, state)
```

**Recommendation:** Use **Mode A (Free-Running with Checkpoints)** for demos—it's most realistic and shows skill behavior under different loads.

### 3. State Machine for Each Scenario

```
        ┌───────────┐
        │  PENDING  │
        └─────┬─────┘
              │ [start signal]
              ▼
        ┌───────────┐
     ┌──┤  RUNNING  ├──┐
     │  └─────┬─────┘  │
     │        │        │
     │[pause] │[pause] │
     │        │        │
     │  ┌─────▼─────┐  │
     └─→│  PAUSED   │←─┘
        └─────┬─────┘
              │[resume]
              ▼
        ┌───────────┐
        │ COMPLETE  │
        └───────────┘
              ▲
              │[error recovery]
        ┌─────┴─────┐
        │  FAILED   │
        └───────────┘
```

### 4. Difficulty Progression Pattern

**Key principle: Simple scenario completes first, provides baseline for medium, which provides reference for complex.**

```python
DIFFICULTY_TIERS = {
    "simple": {
        "input_multiplier": 1.0,      # 100 items
        "skill_timeout": 30,           # 30 seconds
        "expected_quality": "basic",
        "skill_params": {
            "batch_size": 10,
            "cache_enabled": True,
            "debug_enabled": True
        }
    },
    "medium": {
        "input_multiplier": 3.0,      # 300 items
        "skill_timeout": 90,           # 90 seconds
        "expected_quality": "good",
        "skill_params": {
            "batch_size": 50,
            "cache_enabled": True,
            "debug_enabled": False
        }
    },
    "complex": {
        "input_multiplier": 8.0,      # 800 items
        "skill_timeout": 300,          # 5 minutes
        "expected_quality": "excellent",
        "skill_params": {
            "batch_size": 100,
            "cache_enabled": True,
            "debug_enabled": False,
            "parallel_workers": 4
        }
    }
}

def derive_scenario_params(skill_name: str, base_params: dict, difficulty: str) -> dict:
    """Scale skill parameters by difficulty."""

    tier = DIFFICULTY_TIERS[difficulty]

    return {
        # Scale inputs
        "input_size": int(base_params.get("input_size", 100) * tier["input_multiplier"]),

        # Adjust timeouts
        "timeout_seconds": tier["skill_timeout"],

        # Apply difficulty-specific params
        **tier["skill_params"],

        # Keep base params
        **{k: v for k, v in base_params.items() if k not in ["input_size", "timeout_seconds"]}
    }
```

### 5. Aggregator Pattern

**Combines results from all 3 scenarios:**

```python
@dataclass
class AggregatedResults:
    """Combined insights from all scenarios."""

    # Per-scenario results
    results_simple: dict
    results_medium: dict
    results_complex: dict

    # Comparative analysis
    difficulty_vs_quality: dict     # {simple, medium, complex} → quality score
    time_complexity: dict           # Actual time × input_size

    # Patterns extracted across scenarios
    success_patterns: list[str]     # What worked in all scenarios
    scaling_bottlenecks: list[str]  # Where it scaled poorly

    # Recommendations
    optimal_difficulty_for_use_case: str  # "simple" | "medium" | "complex"
    resource_requirements: dict     # {cpu, memory, time}

    # Visualization data
    progress_timeline: dict         # For charting all 3 scenarios
    quality_comparison: dict        # Bar chart data
    efficiency_ratio: dict          # Quality per second per MB

async def aggregate_results(state: ScenarioOrchestratorState) -> AggregatedResults:
    """Synthesize findings from all 3 scenarios."""

    # Collect raw results
    simple_result = state.progress_simple.partial_results[-1]
    medium_result = state.progress_medium.partial_results[-1]
    complex_result = state.progress_complex.partial_results[-1]

    # Calculate metrics
    quality_scores = {
        "simple": calculate_quality(simple_result),
        "medium": calculate_quality(medium_result),
        "complex": calculate_quality(complex_result),
    }

    # Time complexity analysis
    simple_time = state.progress_simple.elapsed_ms
    medium_time = state.progress_medium.elapsed_ms
    complex_time = state.progress_complex.elapsed_ms

    simple_input = DIFFICULTY_TIERS["simple"]["input_multiplier"] * 100
    medium_input = DIFFICULTY_TIERS["medium"]["input_multiplier"] * 100
    complex_input = DIFFICULTY_TIERS["complex"]["input_multiplier"] * 100

    time_complexity = {
        "simple": simple_time / simple_input,      # ms per item
        "medium": medium_time / medium_input,
        "complex": complex_time / complex_input,
    }

    # Find success patterns
    success_patterns = extract_common_patterns(
        simple_result["patterns"],
        medium_result["patterns"],
        complex_result["patterns"]
    )

    # Identify scaling issues
    scaling_bottlenecks = [
        "Linear time growth" if time_complexity["complex"] / time_complexity["simple"] > 3,
        "Memory pressure" if state.progress_complex.memory_used_mb > 500,
        "Batch processing overhead" if medium_input / simple_input > time_complexity["medium"] / time_complexity["simple"]
    ]

    return AggregatedResults(
        results_simple=simple_result,
        results_medium=medium_result,
        results_complex=complex_result,
        difficulty_vs_quality=quality_scores,
        time_complexity=time_complexity,
        success_patterns=success_patterns,
        scaling_bottlenecks=[b for b in scaling_bottlenecks if b],
        optimal_difficulty_for_use_case=recommend_difficulty(quality_scores),
        resource_requirements={
            "cpu_cores": estimate_cpu_from_complex(state),
            "memory_mb": state.progress_complex.memory_used_mb,
            "time_minutes": state.progress_complex.elapsed_ms / 60000
        },
        progress_timeline=build_timeline_chart(state),
        quality_comparison=build_quality_chart(quality_scores),
        efficiency_ratio={
            "simple": quality_scores["simple"] / (simple_time / 1000),  # quality/second
            "medium": quality_scores["medium"] / (medium_time / 1000),
            "complex": quality_scores["complex"] / (complex_time / 1000),
        }
    )
```

### 6. Supervisor Node

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command, Send

class ScenarioSupervisor:
    """Coordinates 3 scenarios with intelligent routing."""

    async def route_scenarios(self, state: ScenarioOrchestratorState) -> list[Command]:
        """Fan-out to all 3 scenarios."""
        return [
            Send("scenario_simple", {
                **state,
                "scenario_id": "simple",
                "scenario_def": state.scenario_simple
            }),
            Send("scenario_medium", {
                **state,
                "scenario_id": "medium",
                "scenario_def": state.scenario_medium
            }),
            Send("scenario_complex", {
                **state,
                "scenario_id": "complex",
                "scenario_def": state.scenario_complex
            })
        ]

    async def collect_and_aggregate(self, state: ScenarioOrchestratorState) -> dict:
        """Fan-in: combine all results."""
        aggregated = await aggregate_results(state)
        return {
            "aggregated_results": aggregated,
            "status": "complete"
        }

def build_scenario_orchestrator():
    """Construct the orchestrator graph."""

    graph = StateGraph(ScenarioOrchestratorState)

    # Supervisor
    graph.add_node("supervisor", ScenarioSupervisor().route_scenarios)

    # 3 worker nodes
    graph.add_node("scenario_simple", execute_scenario_worker)
    graph.add_node("scenario_medium", execute_scenario_worker)
    graph.add_node("scenario_complex", execute_scenario_worker)

    # Aggregator
    graph.add_node("aggregator", ScenarioSupervisor().collect_and_aggregate)

    # Edges
    graph.add_edge(START, "supervisor")

    # Fan-out from supervisor
    graph.add_conditional_edges(
        "supervisor",
        lambda state: ["scenario_simple", "scenario_medium", "scenario_complex"]
    )

    # Workers → Aggregator
    graph.add_edge("scenario_simple", "aggregator")
    graph.add_edge("scenario_medium", "aggregator")
    graph.add_edge("scenario_complex", "aggregator")

    # End
    graph.add_edge("aggregator", END)

    return graph.compile(checkpointer=PostgresSaver.from_conn_string(DATABASE_URL))
```

## Instance Management

### 3 Claude Code Terminal Instances

Each scenario runs in **parallel but isolated** Claude Code instance:

```bash
# Terminal 1 (Scenario: Simple)
claude code /path/to/project \
  --session "scenario-simple-20250129" \
  --skill "{skill_name}" \
  --params '{"difficulty": "simple", "input_size": 100, ...}'

# Terminal 2 (Scenario: Medium)
claude code /path/to/project \
  --session "scenario-medium-20250129" \
  --skill "{skill_name}" \
  --params '{"difficulty": "medium", "input_size": 300, ...}'

# Terminal 3 (Scenario: Complex)
claude code /path/to/project \
  --session "scenario-complex-20250129" \
  --skill "{skill_name}" \
  --params '{"difficulty": "complex", "input_size": 800, ...}'
```

### State Synchronization Across Instances

**Shared checkpoint table (PostgreSQL):**

```sql
CREATE TABLE scenario_orchestration_checkpoints (
    id UUID PRIMARY KEY,
    orchestration_id VARCHAR(255),
    scenario_id VARCHAR(50),
    milestone_name VARCHAR(100),
    progress_pct FLOAT,
    timestamp BIGINT,
    state_snapshot JSONB,
    metrics JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Query all scenarios' progress
SELECT
    scenario_id,
    milestone_name,
    progress_pct,
    (SELECT timestamp FROM scenario_orchestration_checkpoints WHERE scenario_id = 'simple' ORDER BY timestamp DESC LIMIT 1) as simple_ts,
    (SELECT timestamp FROM scenario_orchestration_checkpoints WHERE scenario_id = 'medium' ORDER BY timestamp DESC LIMIT 1) as medium_ts,
    (SELECT timestamp FROM scenario_orchestration_checkpoints WHERE scenario_id = 'complex' ORDER BY timestamp DESC LIMIT 1) as complex_ts
FROM scenario_orchestration_checkpoints
WHERE orchestration_id = $1
ORDER BY timestamp DESC;
```

## Implementation Template

**For ANY user-invocable skill:**

```python
# 1. Define scenarios
scenarios = {
    "simple": ScenarioDefinition(
        name="simple",
        difficulty="easy",
        complexity_multiplier=1.0,
        input_size=100,
        time_budget_seconds=30,
        skill_params={"batch_size": 10, ...}
    ),
    "medium": ScenarioDefinition(
        name="medium",
        difficulty="intermediate",
        complexity_multiplier=3.0,
        input_size=300,
        time_budget_seconds=90,
        skill_params={"batch_size": 50, ...}
    ),
    "complex": ScenarioDefinition(
        name="complex",
        difficulty="advanced",
        complexity_multiplier=8.0,
        input_size=800,
        time_budget_seconds=300,
        skill_params={"batch_size": 100, ...}
    )
}

# 2. Initialize state
state = ScenarioOrchestratorState(
    scenario_simple=scenarios["simple"],
    scenario_medium=scenarios["medium"],
    scenario_complex=scenarios["complex"],
    progress_simple=ScenarioProgress(...),
    progress_medium=ScenarioProgress(...),
    progress_complex=ScenarioProgress(...),
    start_time_unix=time.time(),
    sync_points_reached={},
)

# 3. Build orchestrator
app = build_scenario_orchestrator()

# 4. Invoke with checkpointing
config = {"configurable": {"thread_id": f"orchestration-{skill_name}-{date}"}}
result = await app.ainvoke(state, config=config)

# 5. Aggregate and report
aggregated = result["aggregated_results"]
print(aggregated.to_report())
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Synchronization mode | Free-running with checkpoints (Mode A) |
| Scenario count | Always 3: simple, medium, complex |
| Input scaling | 1x, 3x, 8x (exponential) |
| Time budgets | 30s, 90s, 300s (3-5x multiplier) |
| Checkpoint frequency | Every milestone (30%, 70%) + completion |
| Aggregation strategy | Cross-scenario pattern extraction |
| Parallelism | All 3 scenarios simultaneous |

## Common Mistakes

- **Sequential instead of parallel**: Defeats purpose of demo. Always use fan-out.
- **No synchronization**: Results appear disjointed. Use milestone-based waits.
- **Unclear difficulty scaling**: Scenarios should differ in scale, not approach.
- **Missing aggregation**: Individual results don't show comparative insights.
- **Tight coupling to skill**: Use generic params, not skill-specific code in orchestrator.

## Related Skills

- `langgraph-supervisor` - Supervisor routing pattern
- `langgraph-parallel` - Fan-out/fan-in execution
- `langgraph-state` - State management
- `langgraph-checkpoints` - Persistence
- `multi-agent-orchestration` - Coordination patterns

## Capability Details

### scenario-definition
**Keywords:** scenario, difficulty, scaling, input multiplier, progressive
**Solves:**
- Define progressive difficulty scenarios
- Scale skill parameters by complexity
- Set time budgets and constraints

### synchronization-strategy
**Keywords:** synchronize, checkpoint, milestone, lock-step, coordination
**Solves:**
- Coordinate 3 parallel scenarios
- Wait at milestones or free-run
- Store checkpoints for recovery

### aggregation-pattern
**Keywords:** aggregate, combine, synthesis, cross-scenario, comparison
**Solves:**
- Merge results from all scenarios
- Extract common patterns
- Build comparison metrics

### difficulty-progression
**Keywords:** easy, intermediate, advanced, progressive, complexity
**Solves:**
- Design difficulty scaling
- Set appropriate resource budgets
- Validate scaling behavior

### parallel-execution
**Keywords:** parallel, concurrent, fan-out, simultaneous, independent
**Solves:**
- Run 3 scenarios simultaneously
- Fan-out from supervisor
- Fan-in to aggregator

### instance-management
**Keywords:** claude code, terminal, session, isolation, instance
**Solves:**
- Structure 3 parallel Claude Code instances
- Manage session IDs and isolation
- Coordinate across instances
