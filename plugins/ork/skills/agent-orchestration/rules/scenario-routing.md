---
title: "Scenario: Routing & Synchronization"
category: scenario
impact: MEDIUM
---

# Scenario Routing & Synchronization

Milestone synchronization modes, difficulty scaling strategies, checkpointing, and failure recovery for multi-scenario orchestration.

## Synchronization Modes

| Mode | Description | Use When |
|------|-------------|----------|
| **Free-running** | All run independently | Demo videos, production |
| **Milestone-sync** | Wait at 30%, 70%, 100% | Comparative analysis |
| **Lock-step** | All proceed together | Training, tutorials |

### Milestone Synchronization

```python
async def synchronize_at_milestone(
    milestone_pct: int,
    state: ScenarioOrchestratorState,
    timeout_seconds: int = 30
) -> bool:
    """Wait for all scenarios to reach milestone."""
    start = time.time()

    while time.time() - start < timeout_seconds:
        simple_at = milestone_pct in state["progress_simple"].milestones_reached
        medium_at = milestone_pct in state["progress_medium"].milestones_reached
        complex_at = milestone_pct in state["progress_complex"].milestones_reached

        if simple_at and medium_at and complex_at:
            print(f"[SYNC] All scenarios reached {milestone_pct}%")
            return True

        if any(state[f"progress_{s}"].status == "failed"
               for s in ["simple", "medium", "complex"]):
            print(f"[SYNC] A scenario failed, proceeding without sync")
            return False

        await asyncio.sleep(0.5)

    print(f"[SYNC] Timeout at {milestone_pct}%, proceeding")
    return False
```

## Input Scaling Strategies

### Linear Scaling (I/O-bound skills)

```
Simple:  100 items
Medium:  300 items (3x)
Complex: 800 items (8x)
Time: O(n) -- expected medium ~3x simple
```

### Adaptive Scaling (per-skill tuning)

```python
SKILL_SCALING_PROFILES = {
    "performance-testing": {
        "scaling": "linear",
        "simple": 10, "medium": 30, "complex": 80
    },
    "security-scanning": {
        "scaling": "sublinear",
        "simple": 20, "medium": 100, "complex": 500
    },
    "data-transformation": {
        "scaling": "quadratic",
        "simple": 100, "medium": 200, "complex": 300
    }
}
```

### Complexity Detection

```python
# Calculate actual time complexity
simple_tpi = simple_time / simple_size    # time per item
medium_tpi = medium_time / medium_size
complex_tpi = complex_time / complex_size
ratio = complex_tpi / simple_tpi  # >2 = superlinear
```

## Failure Recovery

### One Scenario Fails (Independent)

```python
try:
    result = await invoke_skill(batch)
except Exception as e:
    progress.errors.append({"message": str(e), "batch_index": i})
    # Don't raise -- let other scenarios continue
```

### Timeout Handling

```python
async def invoke_skill_with_timeout(skill, input_data, timeout_seconds):
    try:
        return await asyncio.wait_for(
            invoke_skill(skill, input_data),
            timeout=timeout_seconds
        )
    except asyncio.TimeoutError:
        return {
            "processed": len(input_data),
            "results": [],
            "error": "timeout",
            "quality_score": 0.0,
        }
```

### All Scenarios Fail (Systematic)

```python
async def orchestrator_with_recovery(initial_state):
    result = await app.ainvoke(initial_state)

    all_failed = all(
        state[f"progress_{s}"].status == "failed"
        for s in ["simple", "medium", "complex"]
    )

    if all_failed:
        # 1. Reduce resource contention
        # 2. Retry with smaller batches
        # 3. Or abort with diagnostic info
        return retry_with_reduced_load(initial_state)
```

## Checkpointing

### Scenario-Level Checkpoints

```sql
INSERT INTO scenario_checkpoints (
    orchestration_id, scenario_id, milestone_pct, elapsed_ms, state_snapshot
) VALUES (
    'demo-001', 'medium', 30, 3200, '{"items": 90, "results": [...]}'
);
```

### Full-State Snapshots

```python
async def checkpoint_full_state(state: ScenarioOrchestratorState):
    checkpoint_data = {
        "orchestration_id": state["orchestration_id"],
        "timestamp": datetime.now().isoformat(),
        "progress_simple": state["progress_simple"].to_dict(),
        "progress_medium": state["progress_medium"].to_dict(),
        "progress_complex": state["progress_complex"].to_dict(),
    }
    await db.insert("full_state_checkpoints", checkpoint_data)
```

## Quality Metrics Framework

### Functional Metrics (per-skill)

```python
{
    "performance-testing": {
        "latency_p95_ms": {"target": "<500ms", "weight": 0.5},
        "error_rate": {"target": "<1%", "weight": 0.5},
    },
    "security-scanning": {
        "vulnerabilities_found": {"target": ">0", "weight": 0.3},
        "coverage_pct": {"target": "100%", "weight": 0.7},
    }
}
```

### Comparative Metrics

```python
{
    "quality_scaling": {
        "formula": "complex_quality / simple_quality",
        "expected": 1.0,
        "acceptable": ">0.8"
    },
    "time_efficiency": {
        "formula": "simple_tpi / complex_tpi",
        "expected": 1.0,
        "acceptable": ">0.5"
    }
}
```

## Multi-Host Execution

For greater parallelism, run scenarios on different machines sharing the same database:

```bash
# Host 1: Coordinator + Simple
python coordinator.py

# Host 2: Medium (different machine, same DB)
export DATABASE_URL="postgresql://user:pass@coordinator-host/orchestkit"
export SCENARIO_ID=medium
python run_scenario.py

# Host 3: Complex
export SCENARIO_ID=complex
python run_scenario.py
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Synchronization mode | Free-running with checkpoints |
| Scenario count | Always 3: simple, medium, complex |
| Input scaling | 1x, 3x, 8x (exponential) |
| Time budgets | 30s, 90s, 300s |
| Checkpoint frequency | Every milestone + completion |
