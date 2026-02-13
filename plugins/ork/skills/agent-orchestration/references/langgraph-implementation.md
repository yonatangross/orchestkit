# LangGraph Implementation: Multi-Scenario Orchestration

Complete Python implementation of the multi-scenario orchestration pattern using LangGraph 1.0.6+.

## 1. State Definition

```python
from typing import TypedDict, Annotated, Literal
from dataclasses import dataclass, field, asdict
from operator import add
import time
from datetime import datetime

@dataclass
class ScenarioProgress:
    """Track execution state for one scenario."""
    scenario_id: str
    status: Literal["pending", "running", "paused", "complete", "failed"]
    progress_pct: float = 0.0

    # Milestones
    milestones_reached: list[str] = field(default_factory=list)
    current_milestone: str = "start"

    # Timing
    start_time_ms: int = 0
    elapsed_ms: int = 0
    elapsed_checkpoints: dict = field(default_factory=dict)  # {milestone: time_ms}

    # Metrics
    memory_used_mb: int = 0
    items_processed: int = 0
    batch_count: int = 0

    # Results
    partial_results: list[dict] = field(default_factory=list)
    quality_scores: dict = field(default_factory=dict)

    # Errors
    errors: list[dict] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)

@dataclass
class ScenarioDefinition:
    """Configuration for one scenario."""
    name: str  # "simple", "medium", "complex"
    difficulty: Literal["easy", "intermediate", "advanced"]
    complexity_multiplier: float  # 1.0, 3.0, 8.0

    # Inputs
    input_size: int
    dataset_characteristics: dict  # {"distribution": "uniform"}

    # Constraints
    time_budget_seconds: int
    memory_limit_mb: int
    error_tolerance: float  # 0-1

    # Skill params
    skill_params: dict

    # Expectations
    expected_quality: Literal["basic", "good", "excellent"]
    quality_metrics: list[str]

    def to_dict(self):
        return asdict(self)

class ScenarioOrchestratorState(TypedDict, total=False):
    """State for the entire orchestration."""

    # Orchestration metadata
    orchestration_id: str
    start_time_unix: int
    skill_name: str
    skill_version: str

    # Scenario definitions
    scenario_simple: ScenarioDefinition
    scenario_medium: ScenarioDefinition
    scenario_complex: ScenarioDefinition

    # Progress tracking
    progress_simple: ScenarioProgress
    progress_medium: ScenarioProgress
    progress_complex: ScenarioProgress

    # Synchronization
    sync_points: dict  # {milestone: bool}
    last_sync_time: int

    # Aggregated results
    final_results: dict
```

## 2. Node Implementations

### Supervisor Node

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command, Send

async def scenario_supervisor(state: ScenarioOrchestratorState) -> list[Command]:
    """
    Route to all 3 scenarios in parallel.

    Returns Send commands that trigger parallel execution.
    """
    print(f"[SUPERVISOR] Starting orchestration {state['orchestration_id']}")

    # Initialize progress for each scenario
    for scenario_id in ["simple", "medium", "complex"]:
        progress = ScenarioProgress(
            scenario_id=scenario_id,
            status="pending",
            start_time_ms=int(time.time() * 1000)
        )
        state[f"progress_{scenario_id}"] = progress

    # Return Send commands for parallel execution
    return [
        Send("scenario_worker", {"scenario_id": "simple", **state}),
        Send("scenario_worker", {"scenario_id": "medium", **state}),
        Send("scenario_worker", {"scenario_id": "complex", **state}),
    ]

async def scenario_worker(state: ScenarioOrchestratorState) -> dict:
    """
    Execute one scenario (simple, medium, or complex).

    Receives scenario_id from supervisor via Send.
    """
    scenario_id = state.get("scenario_id")
    progress = state[f"progress_{scenario_id}"]
    scenario_def = state[f"scenario_{scenario_id}"]

    print(f"[SCENARIO {scenario_id.upper()}] Starting ({scenario_def.complexity_multiplier}x complexity)")

    progress.status = "running"
    progress.start_time_ms = int(time.time() * 1000)

    try:
        # Execute skill for this scenario
        result = await execute_skill_with_milestones(
            skill_name=state["skill_name"],
            scenario_def=scenario_def,
            progress=progress,
            state=state
        )

        progress.status = "complete"
        progress.elapsed_ms = int(time.time() * 1000) - progress.start_time_ms
        progress.partial_results.append(result)

        print(f"[SCENARIO {scenario_id.upper()}] Complete in {progress.elapsed_ms}ms")

        return {f"progress_{scenario_id}": progress}

    except Exception as e:
        progress.status = "failed"
        progress.errors.append({
            "timestamp": datetime.now().isoformat(),
            "message": str(e),
            "severity": "error"
        })
        print(f"[SCENARIO {scenario_id.upper()}] Failed: {e}")

        return {f"progress_{scenario_id}": progress}


async def execute_skill_with_milestones(
    skill_name: str,
    scenario_def: ScenarioDefinition,
    progress: ScenarioProgress,
    state: ScenarioOrchestratorState
) -> dict:
    """
    Execute skill, recording milestones and checkpoints.

    This is where you call YOUR SKILL.
    """

    milestones = [0, 30, 50, 70, 90, 100]  # Percentage checkpoints
    results = {"batches": [], "quality": {}}

    input_items = generate_test_data(
        size=scenario_def.input_size,
        characteristics=scenario_def.dataset_characteristics
    )

    batch_size = scenario_def.skill_params.get("batch_size", 10)

    for batch_idx, batch in enumerate(chunks(input_items, batch_size)):
        # Execute skill on this batch
        # Replace this with your actual skill invocation
        batch_result = await invoke_skill(
            skill_name=skill_name,
            input_data=batch,
            params=scenario_def.skill_params
        )

        results["batches"].append(batch_result)
        progress.batch_count += 1
        progress.items_processed += len(batch)

        # Update progress percentage
        progress.progress_pct = (progress.items_processed / scenario_def.input_size) * 100

        # Check if we've reached a milestone
        reached_milestones = [m for m in milestones if m <= progress.progress_pct]
        new_milestones = [m for m in reached_milestones if m not in progress.milestones_reached]

        for milestone in new_milestones:
            progress.milestones_reached.append(milestone)
            elapsed = int(time.time() * 1000) - progress.start_time_ms
            progress.elapsed_checkpoints[f"milestone_{milestone}"] = elapsed

            print(f"  [{progress.scenario_id}] Reached {milestone}% at {elapsed}ms")

            # Optional: Wait for other scenarios at major milestones
            if milestone in [30, 70]:
                await synchronize_at_milestone(milestone, state)

    # Score results
    results["quality"] = calculate_quality_metrics(results["batches"], scenario_def.quality_metrics)
    progress.quality_scores = results["quality"]

    return results
```

### Synchronization Node

```python
async def synchronize_at_milestone(
    milestone_pct: int,
    state: ScenarioOrchestratorState,
    timeout_seconds: int = 30
) -> bool:
    """
    Optional: Wait for other scenarios at major milestones.

    Returns True if all scenarios reached milestone, False if timeout.
    """

    start = time.time()
    milestone_key = f"checkpoint_{milestone_pct}"

    while time.time() - start < timeout_seconds:
        simple_at_milestone = milestone_pct in state["progress_simple"].milestones_reached
        medium_at_milestone = milestone_pct in state["progress_medium"].milestones_reached
        complex_at_milestone = milestone_pct in state["progress_complex"].milestones_reached

        all_reached = simple_at_milestone and medium_at_milestone and complex_at_milestone

        if all_reached:
            state["sync_points"][milestone_key] = True
            print(f"[SYNC] All scenarios reached {milestone_pct}%")
            return True

        # Check if any scenario failed
        if any(state[f"progress_{s}"].status == "failed" for s in ["simple", "medium", "complex"]):
            print(f"[SYNC] A scenario failed, proceeding without sync")
            return False

        await asyncio.sleep(0.5)

    print(f"[SYNC] Timeout at {milestone_pct}%, proceeding")
    return False
```

### Aggregator Node

```python
async def scenario_aggregator(state: ScenarioOrchestratorState) -> dict:
    """
    Collect all scenario results and synthesize findings.
    """

    print("[AGGREGATOR] Combining results from all scenarios")

    aggregated = {
        "orchestration_id": state["orchestration_id"],
        "skill": state["skill_name"],
        "timestamp": datetime.now().isoformat(),

        # Raw results
        "results_by_scenario": {
            "simple": state["progress_simple"].partial_results[-1] if state["progress_simple"].partial_results else {},
            "medium": state["progress_medium"].partial_results[-1] if state["progress_medium"].partial_results else {},
            "complex": state["progress_complex"].partial_results[-1] if state["progress_complex"].partial_results else {},
        },

        # Metrics
        "metrics": {},

        # Comparison
        "comparison": {},

        # Recommendations
        "recommendations": []
    }

    # Calculate comparative metrics
    for scenario_id in ["simple", "medium", "complex"]:
        progress = state[f"progress_{scenario_id}"]

        aggregated["metrics"][scenario_id] = {
            "elapsed_ms": progress.elapsed_ms,
            "items_processed": progress.items_processed,
            "quality_scores": progress.quality_scores,
            "errors": len(progress.errors)
        }

    # Compare quality vs. complexity
    simple_quality = state["progress_simple"].quality_scores.get("overall", 0)
    medium_quality = state["progress_medium"].quality_scores.get("overall", 0)
    complex_quality = state["progress_complex"].quality_scores.get("overall", 0)

    aggregated["comparison"]["quality_ranking"] = {
        "best": max(
            ("simple", simple_quality),
            ("medium", medium_quality),
            ("complex", complex_quality),
            key=lambda x: x[1]
        )[0],
        "scores": {
            "simple": simple_quality,
            "medium": medium_quality,
            "complex": complex_quality
        }
    }

    # Time complexity analysis
    simple_time = state["progress_simple"].elapsed_ms
    medium_time = state["progress_medium"].elapsed_ms
    complex_time = state["progress_complex"].elapsed_ms

    simple_size = 100 * 1.0
    medium_size = 100 * 3.0
    complex_size = 100 * 8.0

    aggregated["comparison"]["time_per_item_ms"] = {
        "simple": simple_time / simple_size,
        "medium": medium_time / medium_size,
        "complex": complex_time / complex_size,
    }

    # Identify scaling issues
    if complex_time / complex_size > simple_time / simple_size * 2:
        aggregated["recommendations"].append("Sublinear scaling—excellent performance with increased load")
    elif complex_time / complex_size < simple_time / simple_size * 0.8:
        aggregated["recommendations"].append("Superlinear scaling—overhead increases with load")

    # Success patterns
    success_patterns = []
    for scenario_id in ["simple", "medium", "complex"]:
        if state[f"progress_{scenario_id}"].status == "complete" and state[f"progress_{scenario_id}"].errors == []:
            success_patterns.append(scenario_id)

    aggregated["recommendations"].append(f"Successful in all scenarios: {', '.join(success_patterns)}")

    return {"final_results": aggregated}
```

## 3. Graph Construction

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.types import Command

def build_scenario_orchestrator(
    checkpointer: PostgresSaver | None = None
) -> Any:
    """
    Build the complete orchestration graph.
    """

    graph = StateGraph(ScenarioOrchestratorState)

    # Nodes
    graph.add_node("supervisor", scenario_supervisor)
    graph.add_node("scenario_worker", scenario_worker)
    graph.add_node("aggregator", scenario_aggregator)

    # Edges
    graph.add_edge(START, "supervisor")

    # Fan-out: supervisor sends to 3 parallel workers
    graph.add_conditional_edges(
        "supervisor",
        lambda _: ["scenario_worker", "scenario_worker", "scenario_worker"]
    )

    # Workers converge at aggregator
    graph.add_edge("scenario_worker", "aggregator")
    graph.add_edge("aggregator", END)

    # Compile with checkpointing
    return graph.compile(checkpointer=checkpointer)
```

## 4. Invocation Example

```python
import asyncio
import uuid
from langgraph.checkpoint.postgres import PostgresSaver

async def main():
    # Setup checkpointing
    checkpointer = PostgresSaver.from_conn_string(
        "postgresql://user:password@localhost/orchestkit"
    )

    # Build orchestrator
    app = build_scenario_orchestrator(checkpointer=checkpointer)

    # Prepare initial state
    initial_state: ScenarioOrchestratorState = {
        "orchestration_id": f"demo-{uuid.uuid4().hex[:8]}",
        "start_time_unix": int(time.time()),
        "skill_name": "your-skill-name",
        "skill_version": "1.0.0",

        # Scenarios
        "scenario_simple": ScenarioDefinition(
            name="simple",
            difficulty="easy",
            complexity_multiplier=1.0,
            input_size=100,
            dataset_characteristics={"distribution": "uniform"},
            time_budget_seconds=30,
            memory_limit_mb=256,
            error_tolerance=0.0,
            skill_params={"batch_size": 10, "cache_enabled": True},
            expected_quality="basic",
            quality_metrics=["accuracy", "coverage"]
        ),
        "scenario_medium": ScenarioDefinition(
            name="medium",
            difficulty="intermediate",
            complexity_multiplier=3.0,
            input_size=300,
            dataset_characteristics={"distribution": "uniform"},
            time_budget_seconds=90,
            memory_limit_mb=512,
            error_tolerance=0.05,
            skill_params={"batch_size": 50, "cache_enabled": True},
            expected_quality="good",
            quality_metrics=["accuracy", "coverage"]
        ),
        "scenario_complex": ScenarioDefinition(
            name="complex",
            difficulty="advanced",
            complexity_multiplier=8.0,
            input_size=800,
            dataset_characteristics={"distribution": "skewed"},
            time_budget_seconds=300,
            memory_limit_mb=1024,
            error_tolerance=0.1,
            skill_params={"batch_size": 100, "cache_enabled": True, "parallel_workers": 4},
            expected_quality="excellent",
            quality_metrics=["accuracy", "coverage", "latency"]
        ),

        # Progress tracking
        "progress_simple": ScenarioProgress(scenario_id="simple"),
        "progress_medium": ScenarioProgress(scenario_id="medium"),
        "progress_complex": ScenarioProgress(scenario_id="complex"),

        # Synchronization
        "sync_points": {},
        "last_sync_time": 0,
    }

    # Run with thread_id for checkpointing
    config = {"configurable": {"thread_id": f"orch-{initial_state['orchestration_id']}"}}

    print("Starting multi-scenario orchestration...")
    result = await app.ainvoke(initial_state, config=config)

    # Print results
    final = result["final_results"]
    print("\n" + "="*60)
    print("ORCHESTRATION RESULTS")
    print("="*60)
    print(f"Orchestration ID: {final['orchestration_id']}")
    print(f"Skill: {final['skill']}")
    print("\nQuality Comparison:")
    for scenario, score in final["comparison"]["quality_ranking"]["scores"].items():
        print(f"  {scenario}: {score:.2f}")
    print("\nTime per Item (ms):")
    for scenario, time in final["comparison"]["time_per_item_ms"].items():
        print(f"  {scenario}: {time:.2f}ms")
    print("\nRecommendations:")
    for rec in final["recommendations"]:
        print(f"  • {rec}")

if __name__ == "__main__":
    asyncio.run(main())
```

## 5. Helper Functions

```python
def chunks(items: list, size: int):
    """Split items into chunks."""
    for i in range(0, len(items), size):
        yield items[i:i + size]

def generate_test_data(size: int, characteristics: dict) -> list:
    """Generate test data based on scenario characteristics."""
    import random

    distribution = characteristics.get("distribution", "uniform")

    if distribution == "uniform":
        return [{"id": i, "value": random.random()} for i in range(size)]
    elif distribution == "skewed":
        # Zipfian distribution
        return [
            {"id": i, "value": random.random() ** 2}
            for i in range(size)
        ]
    else:
        return [{"id": i, "value": random.random()} for i in range(size)]

async def invoke_skill(
    skill_name: str,
    input_data: list,
    params: dict
) -> dict:
    """
    Invoke your skill here.

    Replace with actual skill invocation.
    """
    # Simulate processing
    await asyncio.sleep(0.1)  # 100ms per batch

    return {
        "processed": len(input_data),
        "quality_score": 0.85 + (random.random() * 0.15),
        "timestamp": datetime.now().isoformat()
    }

def calculate_quality_metrics(batches: list, metrics: list[str]) -> dict:
    """Calculate quality metrics across batches."""
    if not batches:
        return {metric: 0.0 for metric in metrics}

    scores = {
        "accuracy": sum(b.get("quality_score", 0) for b in batches) / len(batches),
        "coverage": 1.0,
    }

    return {metric: scores.get(metric, 0.0) for metric in metrics}
```

## 6. Streaming Results (Real-time Progress)

```python
async def stream_orchestration_progress(
    app,
    initial_state: ScenarioOrchestratorState,
    config: dict
):
    """
    Stream progress updates as scenarios execute.
    """

    async for step in app.astream(initial_state, config=config, stream_mode="updates"):
        print(f"\n[UPDATE] {step}")

        # Extract progress from step
        if "progress_simple" in step:
            p = step["progress_simple"]
            print(f"  Simple: {p.progress_pct:.1f}% ({p.items_processed} items)")

        if "progress_medium" in step:
            p = step["progress_medium"]
            print(f"  Medium: {p.progress_pct:.1f}% ({p.items_processed} items)")

        if "progress_complex" in step:
            p = step["progress_complex"]
            print(f"  Complex: {p.progress_pct:.1f}% ({p.items_processed} items)")
```

## Key Features

1. **Fan-Out/Fan-In**: All 3 scenarios execute in parallel
2. **Milestone Tracking**: Progress recorded at key checkpoints
3. **Synchronization**: Optional wait points at 30% and 70%
4. **Error Isolation**: One scenario's failure doesn't block others
5. **Checkpointing**: State saved to PostgreSQL for recovery
6. **Aggregation**: Cross-scenario analysis and recommendations
7. **Streaming**: Real-time progress updates

## Testing

```python
@pytest.mark.asyncio
async def test_multi_scenario_orchestration():
    # Mock checkpointer
    from langgraph.checkpoint.memory import MemorySaver

    app = build_scenario_orchestrator(checkpointer=MemorySaver())

    initial_state = {...}  # Setup
    config = {"configurable": {"thread_id": "test-123"}}

    result = await app.ainvoke(initial_state, config=config)

    assert result["final_results"]["orchestration_id"]
    assert "simple" in result["final_results"]["metrics"]
    assert "medium" in result["final_results"]["metrics"]
    assert "complex" in result["final_results"]["metrics"]
```
