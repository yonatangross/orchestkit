# Multi-Scenario Orchestration Framework

**Complete system for orchestrating ANY user-invocable skill across 3 parallel difficulty scenarios with synchronized state management and automated result aggregation.**

## 📋 Skill Overview

This skill provides **architecture, patterns, and reference implementations** for showcasing a single user-invocable skill across 3 simultaneous, independent Claude Code terminal instances running:

1. **Simple scenario** (1x scale, 30s budget, ~100 items)
2. **Medium scenario** (3x scale, 90s budget, ~300 items)
3. **Complex scenario** (8x scale, 300s budget, ~800 items)

All scenarios share state via PostgreSQL checkpoints, synchronize at key milestones, and produce a unified report comparing quality, performance, and scaling characteristics.

## 🎯 When to Use

- **Showcasing a new skill** with progressive difficulty
- **Demonstrating scaling behavior** (linear vs. exponential)
- **Testing skill robustness** under different loads
- **Building demos** that show 3 different use cases simultaneously
- **Validating quality metrics** across scenarios
- **Performance benchmarking** with realistic data

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│            MULTI-SCENARIO ORCHESTRATOR                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Terminal 1: Simple   (1x items)     ─┐                    │
│  Terminal 2: Medium   (3x items)     ─┼─→ PostgreSQL       │
│  Terminal 3: Complex  (8x items)     ─┘    Checkpoints     │
│                                            (Sync State)    │
│                                      ─┐                    │
│                                      ├─→ Aggregator        │
│                                      ─┘   (Results)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Components:**

1. **LangGraph State Machine**: Manages pending → running → paused → complete transitions
2. **Supervisor Node**: Routes to 3 scenario workers in parallel (fan-out)
3. **Scenario Workers**: Independent execution, reporting progress to shared checkpoints
4. **Synchronization**: Optional milestone-based pauses (30%, 50%, 70%, 90%)
5. **Aggregator Node**: Combines results, calculates metrics, generates recommendations
6. **Skill Adapter**: Generic template for plugging in ANY skill

## 📚 Documentation

### Core Skill Document
- **`SKILL.md`** (this directory)
  - Pattern overview
  - State machine design
  - Synchronization modes (Tier 1, 2, 3)
  - Implementation template

### Reference Guides

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **`references/langgraph-implementation.md`** | Complete Python code for LangGraph orchestrator | 30 min |
| **`references/claude-code-instance-management.md`** | Running 3 parallel Claude Code instances with shared state | 20 min |
| **`references/state-machine-design.md`** | Detailed state transitions (PENDING → RUNNING → PAUSED → COMPLETE) | 25 min |
| **`references/skill-agnostic-template.md`** | Abstract base class for ANY skill, with 2 examples | 35 min |
| **`references/architectural-patterns.md`** | Advanced patterns: synchronization tiers, failure modes, cost analysis | 30 min |

## 🚀 Quick Start

### For Testing a Specific Skill

**Step 1: Set up orchestrator**

```bash
cd /path/to/project
python backend/app/workflows/multi_scenario/coordinator.py
```

**Step 2: Launch 3 terminal instances**

Terminal A:
```bash
export SCENARIO_ID=simple && export ORCHESTRATION_ID=demo-001
python backend/app/workflows/multi_scenario/run_scenario.py
```

Terminal B:
```bash
export SCENARIO_ID=medium && export ORCHESTRATION_ID=demo-001
python backend/app/workflows/multi_scenario/run_scenario.py
```

Terminal C:
```bash
export SCENARIO_ID=complex && export ORCHESTRATION_ID=demo-001
python backend/app/workflows/multi_scenario/run_scenario.py
```

**Step 3: Monitor progress**

```bash
python backend/app/workflows/multi_scenario/monitor.py
```

**Output:**
```
demo-001 Progress:
─────────────────────
Simple:  ████████████████████ 100% (1.2s)
Medium:  ██████████░░░░░░░░░░  50% (3.5s)
Complex: ███░░░░░░░░░░░░░░░░░  15% (25.7s...)

Sync Points: ✓ 30% ✓ 50% ⏳ 70%
```

### For Creating a New Skill Orchestrator

**Step 1: Implement abstract methods**

```python
# backend/app/workflows/multi_scenario/my_skill_orchestrator.py

from skill_agnostic_template import SkillOrchestrator

class MySkillOrchestrator(SkillOrchestrator):

    async def invoke_skill(self, input_data, scenario_params):
        # Call your skill here
        # Return: {"processed": N, "results": [...], "quality_score": 0-1}
        pass

    def get_scenario_configs(self):
        # Define simple/medium/complex parameters
        return {
            "simple": {"input_size": 100, "batch_size": 10, ...},
            "medium": {"input_size": 300, "batch_size": 50, ...},
            "complex": {"input_size": 800, "batch_size": 100, ...},
        }

    def calculate_quality_metrics(self, results, metric_names):
        # Score results on metrics like accuracy, latency, coverage
        return {"accuracy": 0.92, "coverage": 0.98}

    def generate_test_data(self, size, characteristics):
        # Generate realistic test data for your skill
        return [{"item": i, ...} for i in range(size)]
```

**Step 2: Register and run**

```python
from my_skill_orchestrator import MySkillOrchestrator

OrchestratorRegistry.register("my-skill", MySkillOrchestrator)

# Run all 3 scenarios
result = await OrchestratorRegistry.get("my-skill").orchestrate("demo-001")
```

**Time to implement:** 15-30 minutes per skill

## 🔧 Customization Points

### Scenario Difficulty

Adjust via `DIFFICULTY_TIERS`:

```python
DIFFICULTY_TIERS = {
    "simple": {
        "input_multiplier": 1.0,      # 100 items
        "skill_timeout": 30,           # 30 seconds
        "expected_quality": "basic",
    },
    "medium": {
        "input_multiplier": 3.0,      # 300 items
        "skill_timeout": 90,
        "expected_quality": "good",
    },
    "complex": {
        "input_multiplier": 8.0,      # 800 items
        "skill_timeout": 300,
        "expected_quality": "excellent",
    }
}
```

### Quality Metrics

Define per-skill metrics:

```python
def calculate_quality_metrics(self, results, metric_names):
    scores = {}
    if "accuracy" in metric_names:
        scores["accuracy"] = calculate_accuracy(results)
    if "latency" in metric_names:
        scores["latency"] = 1.0 - min(1.0, avg_latency_ms / 1000)
    return scores
```

### Synchronization Mode

Choose synchronization strategy:

```python
# Mode A: Free-running (default)
# → Scenarios run independently, no waiting

# Mode B: Milestone-based (recommended for demos)
# → Pause at 30%, 50%, 70%, 90% until all catch up

# Mode C: Lock-step (strict)
# → All scenarios advance in lockstep (slowest determines pace)
```

## 📊 Output Example

```json
{
  "orchestration_id": "demo-001",
  "skill": "performance-testing",
  "timestamp": "2025-01-29T15:30:45Z",

  "results_by_scenario": {
    "simple": {
      "items_processed": 100,
      "quality": {"latency_p95": 0.92, "error_rate": 0.98},
      "elapsed_ms": 1200
    },
    "medium": {
      "items_processed": 300,
      "quality": {"latency_p95": 0.88, "error_rate": 0.96},
      "elapsed_ms": 3500
    },
    "complex": {
      "items_processed": 800,
      "quality": {"latency_p95": 0.84, "error_rate": 0.94},
      "elapsed_ms": 25700
    }
  },

  "quality_comparison": {
    "simple": 0.92,
    "medium": 0.88,
    "complex": 0.84
  },

  "scaling_analysis": {
    "time_per_item_ms": {
      "simple": 0.012,
      "medium": 0.012,
      "complex": 0.032
    },
    "recommendation": "Sublinear scaling up to 3x, superlinear at 8x"
  },

  "success_patterns": [
    "Caching effective at all scales",
    "Batch processing improves efficiency"
  ],

  "recommendations": {
    "best_difficulty": "medium",
    "reasoning": "Good balance of realism vs. execution time",
    "production_scaling": {
      "recommended_batch_size": 50,
      "estimated_response_time_ms": 450,
      "required_concurrency": 10
    }
  }
}
```

## 🛠️ Key Features

| Feature | Benefit |
|---------|---------|
| **Fan-Out/Fan-In** | All 3 scenarios run simultaneously (parallel) |
| **Checkpoint Persistence** | Save state to PostgreSQL for recovery |
| **Milestone Synchronization** | Optional pauses at 30%, 50%, 70%, 90% |
| **Error Isolation** | One scenario failure doesn't block others |
| **Quality Metrics** | Flexible, skill-agnostic scoring framework |
| **Cost Tracking** | Estimate tokens, compute, and resource usage |
| **Result Aggregation** | Automatic comparison and recommendations |
| **LangGraph Integration** | Works with streaming, checkpointing, and human-in-the-loop |

## 🔌 Related Skills

- `langgraph-supervisor` - Supervisor routing patterns
- `langgraph-parallel` - Fan-out/fan-in with LangGraph
- `langgraph-state` - State management with reducers
- `langgraph-checkpoints` - PostgreSQL persistence
- `multi-agent-orchestration` - Multi-agent coordination patterns
- `langfuse-observability` - Trace and monitor orchestrations

## ⚠️ Common Mistakes to Avoid

1. **Sequential instead of parallel** → Use `Send()` for fan-out
2. **No synchronization** → Results appear disjointed → Use milestone waits
3. **Tight coupling to skill** → Hard-code skill params → Use generic template
4. **Missing error recovery** → One failure blocks everything → Isolate errors
5. **No checkpointing** → Can't resume interrupted runs → Enable PostgreSQL
6. **Unclear difficulty scaling** → Scenarios seem arbitrary → Use 1x, 3x, 8x
7. **Single metric** → Incomplete picture → Use multiple quality metrics

## 📖 Implementation Checklist

For each new skill:

- [ ] Create `MySkillOrchestrator` subclass
- [ ] Implement `invoke_skill()` to call actual skill
- [ ] Implement `get_scenario_configs()` with 3 difficulty tiers
- [ ] Implement `calculate_quality_metrics()` with skill-specific scoring
- [ ] Implement `generate_test_data()` for realistic inputs
- [ ] Register in `OrchestratorRegistry`
- [ ] Test with simple scenario (< 1 minute)
- [ ] Test with medium scenario (< 2 minutes)
- [ ] Test with complex scenario (< 5 minutes)
- [ ] Verify synchronization at milestones
- [ ] Validate result aggregation
- [ ] Document expected metrics and baselines

## 🧪 Testing

```python
# Test one scenario
orchestrator = MySkillOrchestrator("my-skill", "1.0.0")
result = await orchestrator.run_scenario("simple", "test-001")

# Test full orchestration
results = await orchestrator.orchestrate("test-002")

assert results["success_rate"] > 0.8
assert "quality_comparison" in results
assert "recommendations" in results
```

## 📈 Performance Targets

| Scenario | Items | Budget | Target Quality |
|----------|-------|--------|-----------------|
| Simple   | 100   | 30s    | ≥0.90 |
| Medium   | 300   | 90s    | ≥0.85 |
| Complex  | 800   | 300s   | ≥0.80 |

Adjust these based on your skill's characteristics.

## 🚨 Troubleshooting

**Q: Instances get stuck at milestone?**
A: Increase `timeout_seconds` in `wait_for_milestone_sync()`

**Q: Memory grows over time?**
A: Enable checkpointing to disk, reduce batch sizes

**Q: One instance much slower?**
A: Normal! Use free-running mode (Tier 1), not lock-step

**Q: Can't resume after crash?**
A: Check PostgreSQL connection and `thread_id` uniqueness

## 📞 Support

For issues or questions:

1. Check `references/` docs for detailed implementation
2. Review skill-specific examples in `skill-agnostic-template.md`
3. Test with minimal scenario first (simple, 10 items)
4. Enable logging via `RUST_LOG=debug`
5. Review PostgreSQL checkpoint table for state

## 🎓 Learning Path

1. **Start here**: Read `SKILL.md` (overview)
2. **Understand patterns**: Read `references/architectural-patterns.md`
3. **See code**: Review `references/langgraph-implementation.md`
4. **Implement skill**: Use `references/skill-agnostic-template.md` as template
5. **Deploy**: Follow `references/claude-code-instance-management.md`
6. **Debug**: Consult `references/state-machine-design.md`

## 📝 Changelog

- **v1.0.0** (2025-01-29) - Initial release
  - Generic orchestrator with 3 difficulty tiers
  - PostgreSQL checkpoint synchronization
  - Milestone-based pausing (Mode B)
  - Free-running execution (Mode A)
  - LangGraph integration
  - Skill-agnostic template with 2 examples
  - Comprehensive documentation (5 reference guides)

## 📄 License

Part of OrchestKit v5.4.0+. See main project LICENSE.

## 🙏 Acknowledgments

- LangGraph team for state graph abstractions
- PostgreSQL for reliable distributed checkpointing
- Claude Code for session isolation and parallel execution
