# Multi-Judge Evaluation with Langfuse

## Overview

Multi-judge evaluation uses multiple LLM evaluators to assess quality from different perspectives. Langfuse v3 provides evaluator execution tracing — each judge creates its own inspectable trace.

**OrchestKit has built-in evaluators** at `backend/app/shared/services/g_eval/langfuse_evaluators.py` - but they're not wired up!

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Multi-Judge Architecture                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   LLM Output ────────────────────────────────────────────────────   │
│        │                                                             │
│        ▼                                                             │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│   │ Judge 1 │  │ Judge 2 │  │ Judge 3 │  │ Judge 4 │               │
│   │ Depth   │  │ Accuracy│  │ Clarity │  │ Relevance│              │
│   │ 0.85    │  │ 0.90    │  │ 0.75    │  │ 0.92    │               │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘               │
│        │            │            │            │                      │
│        └────────────┴────────────┴────────────┘                      │
│                           │                                          │
│                           ▼                                          │
│                  ┌──────────────────┐                                │
│                  │ Score Aggregator │                                │
│                  │ Weighted: 0.87   │                                │
│                  └──────────────────┘                                │
│                           │                                          │
│                           ▼                                          │
│                  [Langfuse Score API]                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## G-Eval Criteria (Built into OrchestKit)

OrchestKit uses these evaluation criteria:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| **depth** | 0.30 | Technical depth and thoroughness |
| **accuracy** | 0.25 | Factual correctness |
| **specificity** | 0.20 | Concrete examples and details |
| **coherence** | 0.15 | Logical structure and flow |
| **usefulness** | 0.10 | Practical applicability |

## Evaluator Execution Tracing (v3)

Each evaluator run creates its own inspectable trace:

```python
from langfuse import observe, get_client, Langfuse

langfuse = Langfuse()


@observe(type="evaluator", name="depth_judge")
async def depth_evaluator(trace_id: str, output: str) -> float:
    """Depth evaluator — creates its own inspectable trace."""
    score = await g_eval.evaluate(criterion="depth", output=output)

    get_client().update_current_observation(
        input=output[:500],
        output={"score": score, "criterion": "depth"},
        model="claude-sonnet-4-6",
    )

    # Record score on the original trace
    langfuse.score(
        trace_id=trace_id,
        name="g_eval_depth",
        value=score,
        comment="G-Eval depth score",
    )

    return score
```

Result in Langfuse UI — the evaluator's own trace is inspectable:
```
evaluator:depth_judge (0.6s, $0.008)
├── generation: depth_prompt → 0.85
└── metadata: {criterion: "depth", model: "claude-sonnet-4-6"}
```

## Existing OrchestKit Evaluators (v3 Updated)

```python
# backend/app/shared/services/g_eval/langfuse_evaluators.py

from langfuse import observe, get_client, Langfuse

langfuse = Langfuse()


def create_g_eval_evaluator(criterion: str):
    """
    Create a Langfuse evaluator for a G-Eval criterion.
    Each evaluator creates an inspectable trace via @observe(type="evaluator").
    """
    @observe(type="evaluator", name=f"g_eval_{criterion}")
    async def evaluator(trace_id: str, output: str, **kwargs) -> float:
        # Run G-Eval for this criterion
        score = await g_eval.evaluate(
            criterion=criterion,
            output=output,
            **kwargs,
        )

        get_client().update_current_observation(
            input=output[:500],
            output={"score": score, "criterion": criterion},
        )

        # Record score in Langfuse
        langfuse.score(
            trace_id=trace_id,
            name=f"g_eval_{criterion}",
            value=score,
            comment=f"G-Eval {criterion} score",
        )

        return score

    return evaluator


def create_g_eval_overall_evaluator():
    """
    Create evaluator for weighted overall score.
    """
    weights = {
        "depth": 0.30,
        "accuracy": 0.25,
        "specificity": 0.20,
        "coherence": 0.15,
        "usefulness": 0.10,
    }

    @observe(type="evaluator", name="g_eval_overall")
    async def evaluator(trace_id: str, output: str, **kwargs) -> float:
        scores = {}

        # Run all criteria
        for criterion in weights.keys():
            scores[criterion] = await g_eval.evaluate(
                criterion=criterion,
                output=output,
                **kwargs,
            )

        # Calculate weighted average
        overall = sum(
            scores[c] * weights[c]
            for c in weights.keys()
        )

        get_client().update_current_observation(
            output={"overall": overall, "scores": scores},
        )

        # Record in Langfuse
        langfuse.score(
            trace_id=trace_id,
            name="g_eval_overall",
            value=overall,
            comment=f"Weighted G-Eval: {scores}",
        )

        return overall

    return evaluator


# Pre-built evaluators (ready to use!)
depth_evaluator = create_g_eval_evaluator("depth")
accuracy_evaluator = create_g_eval_evaluator("accuracy")
specificity_evaluator = create_g_eval_evaluator("specificity")
coherence_evaluator = create_g_eval_evaluator("coherence")
usefulness_evaluator = create_g_eval_evaluator("usefulness")
overall_evaluator = create_g_eval_overall_evaluator()
```

## Wiring Evaluators to Workflow

### Option 1: Quality Gate Integration

```python
from langfuse import observe, get_client
from app.shared.services.g_eval.langfuse_evaluators import (
    overall_evaluator,
    depth_evaluator,
    accuracy_evaluator,
)


@observe(name="quality_gate")
async def quality_gate_node(state: AnalysisState) -> dict:
    """Quality gate with Langfuse multi-judge evaluation."""

    trace_id = state.get("langfuse_trace_id")
    synthesis = state["synthesis_result"]

    # Run multi-judge evaluation (each creates inspectable trace)
    scores = {}

    scores["depth"] = await depth_evaluator(trace_id, synthesis)
    scores["accuracy"] = await accuracy_evaluator(trace_id, synthesis)

    # Overall score
    overall = await overall_evaluator(trace_id, synthesis)
    scores["overall"] = overall

    # Quality gate decision
    passed = overall >= 0.7

    return {
        "quality_scores": scores,
        "quality_passed": passed,
        "quality_gate_reason": (
            "Passed" if passed else f"Score {overall:.2f} below threshold"
        ),
    }
```

### Option 2: Experiment Runner Integration

```python
from langfuse import Langfuse

langfuse = Langfuse()


async def run_quality_experiment(dataset_name: str):
    """Run multi-judge evaluation using Experiment Runner."""

    result = langfuse.run_experiment(
        dataset_name=dataset_name,
        experiment_name=f"quality-eval-{datetime.now().isoformat()}",
        run_fn=run_analysis_pipeline,
        evaluators=[
            {"name": "depth", "fn": depth_evaluator},
            {"name": "accuracy", "fn": accuracy_evaluator},
            {"name": "overall", "fn": overall_evaluator},
        ],
    )

    return {
        "experiment_id": result.experiment_id,
        "avg_overall": result.stats["overall"]["mean"],
        "avg_depth": result.stats["depth"]["mean"],
        "pass_rate": sum(
            1 for r in result.runs if r.scores["overall"] >= 0.7
        ) / len(result.runs),
    }
```

## Best Practices

### 1. Use Multiple Independent Judges

```python
# BAD: Single judge decides everything
score = await evaluate(output)

# GOOD: Multiple judges with @observe(type="evaluator"), aggregate
scores = await asyncio.gather(
    depth_judge(output),
    accuracy_judge(output),
    clarity_judge(output),
)
overall = weighted_average(scores, weights)
```

### 2. Log All Scores to Langfuse

```python
# BAD: Only log final score
langfuse.score(trace_id=trace_id, name="quality", value=0.85)

# GOOD: Log individual + aggregate
for criterion, score in scores.items():
    langfuse.score(
        trace_id=trace_id,
        name=f"g_eval_{criterion}",
        value=score,
        comment=f"G-Eval {criterion}",
    )

langfuse.score(
    trace_id=trace_id,
    name="g_eval_overall",
    value=overall,
    comment=f"Weighted average of {list(scores.keys())}",
)
```

### 3. Include Ground Truth When Available

```python
# If you have ground truth (golden dataset)
langfuse.score(
    trace_id=trace_id,
    name="human_verified",
    value=ground_truth_score,
    source="human",  # Distinguish from LLM judges
)
```

### 4. Track Judge Agreement

```python
# Measure inter-judge agreement
agreement = calculate_agreement(scores)
langfuse.score(
    trace_id=trace_id,
    name="judge_agreement",
    value=agreement,
    comment="Inter-judge correlation",
)

# Flag for review if judges disagree
if agreement < 0.5:
    langfuse.event(
        trace_id=trace_id,
        name="low_judge_agreement",
        metadata={"scores": scores, "agreement": agreement},
        level="WARNING",
    )
```

## Viewing Results in Langfuse

### Dashboard Queries

```sql
-- Average scores by criterion
SELECT
  name,
  AVG(value) as avg_score,
  COUNT(*) as count
FROM scores
WHERE name LIKE 'g_eval_%'
GROUP BY name
ORDER BY avg_score DESC;

-- Score distribution
SELECT
  name,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) as median,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY value) as p25,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75
FROM scores
WHERE name = 'g_eval_overall'
GROUP BY name;
```

### Score Visualization

```
┌─────────────────────────────────────────────────────────────────────┐
│                  G-Eval Score Distribution                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   depth       ████████████████████░░░░  0.82                        │
│   accuracy    █████████████████████░░░  0.85                        │
│   specificity ██████████████░░░░░░░░░░  0.68                        │
│   coherence   ███████████████████░░░░░  0.78                        │
│   usefulness  ████████████████████████  0.91                        │
│   ─────────────────────────────────────                              │
│   overall     ██████████████████░░░░░░  0.81                        │
│                                                                      │
│   Threshold: 0.70  [PASS]                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Integration Steps for OrchestKit

1. **Import existing evaluators** (they're already built!)
   ```python
   from app.shared.services.g_eval.langfuse_evaluators import overall_evaluator
   ```

2. **Pass trace_id through workflow**
   ```python
   from langfuse import observe, get_client

   @observe(name="analysis")
   async def run_analysis():
       # trace_id is automatically managed by @observe
       state["langfuse_trace_id"] = get_client().get_current_trace_id()
   ```

3. **Call evaluators in quality gate**
   ```python
   await overall_evaluator(state["langfuse_trace_id"], synthesis)
   ```

4. **View scores in Langfuse dashboard**
   - Navigate to trace — see all G-Eval scores
   - Click evaluator scores — see the evaluator's own trace
   - Analyze trends over time
