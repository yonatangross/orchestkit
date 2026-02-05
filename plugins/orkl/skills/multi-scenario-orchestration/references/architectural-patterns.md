# Architectural Patterns for Multi-Scenario Orchestration

**Deep patterns and design decisions for production multi-scenario demos.**

## Pattern 1: Three-Tier Synchronization

### Tier 1: Free-Running (Baseline)

**Each scenario runs independently, no blocking.**

```
Time →
─────────────────────────────────────────────────┐
Simple   ███████████████ Complete at 1.2s        │
         └─────────────────────────────────────┘ │
                                                  │
Medium      ██████████████████████░░░░ In progress at 3.5s
            └──────────────────────────────────┘ │
                                                  │
Complex      ██████████░░░░░░░░░░░░░░░░ In progress at 25.7s
             └─────────────────────────────────────┘ │
─────────────────────────────────────────────────┘
```

**Advantages:**
- Realistic—shows natural skill behavior
- Tolerates slowness in one scenario
- Lower synchronization overhead

**Implementation:**
```python
# Each scenario runs its own event loop
# No waiting between scenarios
# Checkpoints are independent
```

### Tier 2: Milestone Synchronization

**Scenarios pause at checkpoints (30%, 50%, 70%, 90%) to allow others to catch up.**

```
Time →
─────────────────────────────────────────────────┐
Simple   ███ PAUSE ███ PAUSE ███ Complete        │
         └───┬────────┬────────┬────────────────┘│
                │      │      │                  │
Medium      ██ PAUSE ██ PAUSE ██████░░░░ In-prog │
            └────┬────────┬──────────────────────┘│
                 │      │                        │
Complex      █ PAUSE █ PAUSE ██░░░░░░░░░░░░░░░ │
             └──┬────────┬──────────────────────────┘│
─────────────────────────────────────────────────┘
```

**Advantages:**
- Synchronized checkpoints for state capture
- Better for demos (shows progression together)
- Easier to explain ("all at 30%")

**Implementation:**
```python
async def synchronize_at_milestone(milestone_pct, timeout_seconds=60):
    while time.time() - start < timeout_seconds:
        if all_scenarios_at_milestone:
            return True
        await asyncio.sleep(0.5)

    # Timeout: proceed anyway (don't block forever)
    return False
```

### Tier 3: Lock-Step (Strict Synchronization)

**All scenarios advance together, slowest determines pace.**

```
Time →
─────────────────────────────────────────────────┐
Step 1:  Simple   ███ | Medium   ███ | Complex █  │
         └────────────────────────────────────────┘│
Step 2:  Simple   ███ | Medium   ███ | Complex █  │
         └────────────────────────────────────────┘│
Step 3:  All complete together                    │
─────────────────────────────────────────────────┘
```

**Advantages:**
- Perfect synchronization for demos
- Easy to explain ("all scenarios complete together")

**Disadvantages:**
- Complex scenario blocks others (1-2 min delays)
- Unrealistic performance representation

**Recommendation:** Use **Tier 1 (Free-Running)** for production, **Tier 2 (Milestone)** for interactive demos.

---

## Pattern 2: Input Scaling Strategies

### Strategy A: Linear Scaling (Additive)

```
Simple:  100 items
Medium:  100 + 200 = 300 items (+200%)
Complex: 300 + 500 = 800 items (+267%)

Time complexity: O(n)
Expected medium time ≈ 3x simple
Expected complex time ≈ 8x simple
```

**Best for:** I/O-bound skills (API calls, database queries)

### Strategy B: Exponential Scaling (Multiplicative)

```
Simple:  100 items
Medium:  100 × 3 = 300 items (3x)
Complex: 100 × 8 = 800 items (8x)

Time complexity: O(n) or O(n log n)
Expected medium time ≈ 3x simple (if linear)
Expected complex time ≈ 8x simple (if linear)
```

**Best for:** Batch processing, LLM calls

### Strategy C: Quadratic Scaling

```
Simple:  100 items
Medium:  300 items (3x)
Complex: 800 items (8x)

But if algorithm is O(n²):
Expected medium time ≈ 9x simple
Expected complex time ≈ 64x simple
```

**Detection:**
```python
# Calculate actual time complexity
simple_time = 1.2  # seconds
medium_time = 3.5
complex_time = 25.7

simple_size = 100
medium_size = 300
complex_size = 800

# Time per item
simple_tpi = simple_time / simple_size        # 0.012 s/item
medium_tpi = medium_time / medium_size        # 0.012 s/item
complex_tpi = complex_time / complex_size     # 0.032 s/item

# Ratio indicates scaling behavior
ratio = complex_tpi / simple_tpi  # 2.67 → O(n log n) or worse
```

### Strategy D: Adaptive Scaling

Choose scaling based on skill characteristics:

```python
SKILL_SCALING_PROFILES = {
    "performance-testing": {
        "scaling": "linear",
        "simple": 10,
        "medium": 30,
        "complex": 80
    },
    "security-scanning": {
        "scaling": "sublinear",  # Gets faster with caching
        "simple": 20,
        "medium": 100,
        "complex": 500
    },
    "data-transformation": {
        "scaling": "quadratic",  # O(n²) worst case
        "simple": 100,
        "medium": 200,  # Limit increase
        "complex": 300
    }
}
```

---

## Pattern 3: Quality Metrics Framework

### Metric Category 1: Functional Metrics

What the skill is designed to measure:

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

### Metric Category 2: Comparative Metrics

How scenarios compare:

```python
{
    "quality_scaling": {
        "formula": "complex_quality / simple_quality",
        "expected": 1.0,  # Expect no degradation
        "acceptable": ">0.8"
    },
    "time_efficiency": {
        "formula": "simple_tpi / complex_tpi",
        "expected": 1.0,  # Linear scaling
        "acceptable": ">0.5"
    },
    "resource_efficiency": {
        "formula": "quality_per_second_complex / quality_per_second_simple",
        "expected": 0.8,  # Complex less efficient (higher overhead)
        "acceptable": ">0.5"
    }
}
```

### Metric Category 3: Stability Metrics

Consistency across scenarios:

```python
{
    "quality_variance": {
        "formula": "stdev(simple_quality, medium_quality, complex_quality)",
        "expected": "<0.05",
        "interpretation": "Low variance = stable algorithm"
    },
    "error_consistency": {
        "formula": "all_scenarios_error_rate < threshold",
        "expected": True,
        "interpretation": "Same error rate across loads"
    }
}
```

---

## Pattern 4: Failure Modes & Recovery

### Failure Mode 1: One Scenario Fails (Independent)

```
Simple   ███████████████ Complete ✓
Medium   ██████████ FAILED ✗
Complex  ███ In progress...

Recovery:
• Medium stores checkpoint at failure point
• Can be restarted independently
• Simple/Complex continue
• Aggregator combines partial results
```

**Implementation:**
```python
# Isolate failures
try:
    result = await invoke_skill(batch)
except Exception as e:
    progress.errors.append({"message": str(e), "batch_index": i})
    # Don't raise—let other scenarios continue

# Report but don't block
if progress.errors:
    print(f"⚠ {scenario_id} had {len(progress.errors)} errors")
```

### Failure Mode 2: All Scenarios Fail (Systematic)

```
Simple   ███ FAILED ✗
Medium   ███ FAILED ✗
Complex  ███ FAILED ✗

Possible causes:
• Skill has a bug
• Resource limit exceeded
• Network/database unavailable
```

**Recovery:**
```python
async def orchestrator_with_recovery(initial_state):
    """Attempt recovery if all scenarios fail."""

    result = await app.ainvoke(initial_state)

    all_failed = all(
        state[f"progress_{s}"].status == "failed"
        for s in ["simple", "medium", "complex"]
    )

    if all_failed:
        print("All scenarios failed—attempting recovery...")

        # 1. Reduce resource contention
        # 2. Retry with smaller batches
        # 3. Or abort with diagnostic info

        return retry_with_reduced_load(initial_state)
```

### Failure Mode 3: Timeout (Skill Takes Too Long)

```
Simple   ███████████ Complete in 1.2s (budget: 30s) ✓
Medium   ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ TIMEOUT ✗ (budget: 90s)
Complex  █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ IN PROGRESS

Recovery:
• Medium: Cancel at 90s, return partial results
• Complex: Continue until 300s timeout
```

**Implementation:**
```python
async def invoke_skill_with_timeout(skill, input_data, timeout_seconds):
    try:
        return await asyncio.wait_for(
            invoke_skill(skill, input_data),
            timeout=timeout_seconds
        )
    except asyncio.TimeoutError:
        print(f"Timeout after {timeout_seconds}s, returning partial results")
        return {
            "processed": len(input_data),
            "results": [],
            "error": "timeout",
            "quality_score": 0.0,
        }
```

---

## Pattern 5: Observability & Monitoring

### Monitoring Strategy 1: Real-Time Progress

```python
# Stream progress from PostgreSQL checkpoints
async def monitor_real_time():
    while orchestration_running:
        progress = await db.query("""
            SELECT scenario_id, MAX(progress_pct), MAX(elapsed_ms)
            FROM scenario_checkpoints
            WHERE orchestration_id = $1
            GROUP BY scenario_id
        """, orchestration_id)

        for scenario_id, progress_pct, elapsed_ms in progress:
            bar = "█" * int(progress_pct / 5) + "░" * (20 - int(progress_pct / 5))
            print(f"{scenario_id}: │{bar}│ {progress_pct:.0f}%")

        await asyncio.sleep(2)
```

### Monitoring Strategy 2: Comparative Timeline

```
                   0s      10s      20s      30s      40s
Simple:            |████████|                            (complete)
Medium:            |              |██████████|           (in progress)
Complex:           |                   |████|            (in progress)
                   |─────────────────────────────────────|

Milestones:
Simple:  ✓ 30% @ 0.4s   ✓ 50% @ 0.6s   ✓ 70% @ 0.9s   ✓ 100% @ 1.2s
Medium:  ✓ 30% @ 3.2s   ✓ 50% @ 5.1s   ⏳ 70% @ 8.3s  ⏳ In progress
Complex: ✓ 30% @ 9.1s   ⏳ 50% in progress
```

### Monitoring Strategy 3: Quality Trend

```
Quality Score (0-1)
1.0 ├─────────────────
    │ Simple    ████░░░░░░
0.8 ├───────────────────
    │ Medium      ██████░░
0.6 ├───────────────────
    │ Complex       ███░░░░
0.4 ├───────────────────
    │
0.2 ├───────────────────
    └─────────────────────
    0%  30%  50%  70%  100%
         Progress
```

---

## Pattern 6: Result Aggregation Strategies

### Aggregation Type 1: Comparative (Default)

Compare metrics across all 3 scenarios:

```json
{
  "quality_comparison": {
    "simple": {"latency_p95": 120, "score": 0.92},
    "medium": {"latency_p95": 145, "score": 0.88},
    "complex": {"latency_p95": 185, "score": 0.84}
  },
  "scaling_analysis": {
    "quality_degradation": "8% from simple to complex",
    "time_growth": "linear (as expected)",
    "recommendation": "Quality acceptable, can scale to complex"
  }
}
```

### Aggregation Type 2: Pattern Extraction

Find common patterns across scenarios:

```json
{
  "success_patterns": [
    "Caching strategy effective at all scales",
    "Batch size of 50+ preferred",
    "Memory usage stays below 512MB"
  ],
  "failure_patterns": [
    "Timeout at >5000 items per batch",
    "Quality drops with skewed data distribution"
  ]
}
```

### Aggregation Type 3: Recommendation Engine

Suggest optimal difficulty for production:

```json
{
  "recommended_difficulty": "medium",
  "reasoning": [
    "Simple: Insufficient load to detect bottlenecks",
    "Medium: Good balance of realism and speed",
    "Complex: Takes too long for frequent testing (300s)"
  ],
  "production_scaling": {
    "estimated_items_per_request": 50,
    "estimated_response_time_ms": 450,
    "required_concurrency_support": 10
  }
}
```

---

## Pattern 7: Checkpointing Strategy

### Checkpoint Type 1: Scenario-Level

Save progress at each scenario milestone:

```sql
INSERT INTO scenario_checkpoints (
    orchestration_id, scenario_id, milestone_pct, elapsed_ms, state_snapshot
) VALUES (
    'demo-001', 'medium', 30, 3200, {'items': 90, 'results': [...]}
);
```

**Use case:** Resume interrupted scenario

### Checkpoint Type 2: Milestone-Level

Save synchronized state across all scenarios:

```sql
INSERT INTO orchestration_milestones (
    orchestration_id, milestone_pct, timestamp, simple_status, medium_status, complex_status
) VALUES (
    'demo-001', 30, NOW(), 'complete', 'paused', 'in_progress'
);
```

**Use case:** Track synchronization progress

### Checkpoint Type 3: Full-State

Periodic snapshots for recovery:

```python
async def checkpoint_full_state(state: ScenarioOrchestratorState):
    """Save complete state to disk."""

    checkpoint_data = {
        "orchestration_id": state["orchestration_id"],
        "timestamp": datetime.now().isoformat(),
        "progress_simple": state["progress_simple"].to_dict(),
        "progress_medium": state["progress_medium"].to_dict(),
        "progress_complex": state["progress_complex"].to_dict(),
    }

    await db.insert("full_state_checkpoints", checkpoint_data)
```

**Use case:** Complete recovery from any point

---

## Pattern 8: Cost & Performance Analysis

### Cost Analysis

```python
def estimate_orchestration_cost(
    scenarios: dict[str, ScenarioDefinition]
) -> dict:
    """Estimate total execution cost."""

    # LLM cost (if using Claude)
    llm_cost_per_scenario = {
        "simple": estimate_tokens(100) * 0.001,   # ~$0.002
        "medium": estimate_tokens(300) * 0.001,   # ~$0.005
        "complex": estimate_tokens(800) * 0.001,  # ~$0.010
    }

    # Compute cost (if cloud)
    compute_cost = {
        "simple": 30 / 3600 * 0.10,   # 30s @ $0.10/hour
        "medium": 90 / 3600 * 0.10,   # 90s @ $0.10/hour
        "complex": 300 / 3600 * 0.10, # 300s @ $0.10/hour
    }

    # Database cost
    db_cost = 0.001  # Negligible for checkpointing

    return {
        "llm_cost": sum(llm_cost_per_scenario.values()),
        "compute_cost": sum(compute_cost.values()),
        "db_cost": db_cost,
        "total_cost": sum(llm_cost_per_scenario.values()) + sum(compute_cost.values()) + db_cost,
        "cost_per_scenario": llm_cost_per_scenario,
    }
```

### Performance Analysis

```python
def analyze_performance(
    results: dict
) -> dict:
    """Analyze orchestration performance."""

    return {
        "total_execution_time_minutes": (sum(r["elapsed_ms"] for r in results.values()) / 60000),
        "critical_path_seconds": max(r["elapsed_ms"] for r in results.values()) / 1000,
        "parallel_efficiency": (
            (sum(r["elapsed_ms"] for r in results.values()) / 1000) /
            (max(r["elapsed_ms"] for r in results.values()) / 1000)
        ),
        "cost_per_quality_point": estimate_orchestration_cost({}) / avg_quality_score,
    }
```

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Synchronization | Milestone-based (Tier 2) | Balance between realism and demo experience |
| Input Scaling | 1x, 3x, 8x (exponential) | Exponential because most skills have overhead |
| Quality Metrics | Multiple per-skill metrics | Single metric insufficient to assess quality |
| Failure Recovery | Isolation + checkpointing | Partial results preferable to total failure |
| Monitoring | Real-time DB queries + Langfuse | Distributed state requires DB |
| Checkpoint Frequency | Every milestone + completion | Balance between safety and overhead |
| Aggregation | Comparative + recommendations | Provide actionable insights |
| Skill Abstraction | Generic orchestrator base class | Template for ANY skill |

---

## References

- `langgraph-implementation.md` - Python implementation details
- `claude-code-instance-management.md` - Multi-terminal setup
- `state-machine-design.md` - Detailed state transitions
- `skill-agnostic-template.md` - Template for new skills
