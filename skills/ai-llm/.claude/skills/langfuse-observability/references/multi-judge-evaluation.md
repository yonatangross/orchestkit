# Multi-Judge Evaluation with Langfuse

## Overview

Multi-judge evaluation uses multiple LLM evaluators to assess quality from different perspectives. Langfuse provides the infrastructure to run, track, and analyze these evaluations.

**SkillForge has built-in evaluators** at `backend/app/shared/services/g_eval/langfuse_evaluators.py` - but they're not wired up!

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

## G-Eval Criteria (Built into SkillForge)

SkillForge uses these evaluation criteria:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| **depth** | 0.30 | Technical depth and thoroughness |
| **accuracy** | 0.25 | Factual correctness |
| **specificity** | 0.20 | Concrete examples and details |
| **coherence** | 0.15 | Logical structure and flow |
| **usefulness** | 0.10 | Practical applicability |

## Existing SkillForge Evaluators (BUILT BUT NOT USED!)

```python
# backend/app/shared/services/g_eval/langfuse_evaluators.py

from langfuse import Langfuse
from langfuse.decorators import observe

langfuse = Langfuse()


def create_g_eval_evaluator(criterion: str):
    """
    Create a Langfuse evaluator for a G-Eval criterion.

    Returns a function that can be used with langfuse.score()
    """
    async def evaluator(trace_id: str, output: str, **kwargs) -> float:
        # Run G-Eval for this criterion
        score = await g_eval.evaluate(
            criterion=criterion,
            output=output,
            **kwargs
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

    async def evaluator(trace_id: str, output: str, **kwargs) -> float:
        scores = {}

        # Run all criteria
        for criterion in weights.keys():
            scores[criterion] = await g_eval.evaluate(
                criterion=criterion,
                output=output,
                **kwargs
            )

        # Calculate weighted average
        overall = sum(
            scores[c] * weights[c]
            for c in weights.keys()
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
# backend/app/domains/analysis/workflows/nodes/quality_gate_node.py

from app.shared.services.g_eval.langfuse_evaluators import (
    overall_evaluator,
    depth_evaluator,
    accuracy_evaluator,
)

async def quality_gate_node(state: AnalysisState) -> dict:
    """Quality gate with Langfuse multi-judge evaluation."""

    trace_id = state.get("langfuse_trace_id")
    synthesis = state["synthesis_result"]

    # Run multi-judge evaluation
    scores = {}

    # Individual judges
    scores["depth"] = await depth_evaluator(trace_id, synthesis)
    scores["accuracy"] = await accuracy_evaluator(trace_id, synthesis)

    # Overall score
    overall = await overall_evaluator(trace_id, synthesis)
    scores["overall"] = overall

    # Quality gate decision
    passed = overall >= 0.7  # Threshold

    return {
        "quality_scores": scores,
        "quality_passed": passed,
        "quality_gate_reason": (
            "Passed" if passed else f"Score {overall:.2f} below threshold"
        ),
    }
```

### Option 2: Post-Workflow Evaluation

```python
# Evaluate after workflow completes
async def run_analysis_with_evaluation(url: str) -> AnalysisResult:
    # Run workflow
    trace = langfuse.trace(name="content_analysis", metadata={"url": url})
    result = await workflow.ainvoke({"url": url})

    # Run evaluations
    synthesis = result["synthesis_result"]

    await overall_evaluator(trace.id, synthesis)
    await depth_evaluator(trace.id, synthesis)
    await accuracy_evaluator(trace.id, synthesis)

    return result
```

## Langfuse Experiments API

Run systematic evaluations across datasets:

```python
from langfuse import Langfuse

langfuse = Langfuse()


async def run_quality_experiment(dataset_name: str):
    """
    Run multi-judge evaluation on a dataset.
    """
    # Create experiment
    experiment = langfuse.create_experiment(
        name=f"quality-eval-{datetime.now().isoformat()}",
        description="Multi-judge quality evaluation",
    )

    # Get dataset
    dataset = langfuse.get_dataset(dataset_name)

    results = []
    for item in dataset.items:
        # Run analysis
        result = await workflow.ainvoke({"url": item.input["url"]})

        # Create run
        run = experiment.create_run(
            item_id=item.id,
            input=item.input,
            output=result["synthesis_result"],
        )

        # Run all judges
        scores = {
            "depth": await depth_evaluator(run.trace_id, result["synthesis_result"]),
            "accuracy": await accuracy_evaluator(run.trace_id, result["synthesis_result"]),
            "overall": await overall_evaluator(run.trace_id, result["synthesis_result"]),
        }

        results.append({"item_id": item.id, "scores": scores})

    return {
        "experiment_id": experiment.id,
        "results": results,
        "avg_overall": np.mean([r["scores"]["overall"] for r in results]),
    }
```

## Best Practices

### 1. Use Multiple Independent Judges

```python
# BAD: Single judge decides everything
score = await evaluate(output)

# GOOD: Multiple judges, aggregate
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
│   Threshold: 0.70  [✓ PASS]                                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Integration Steps for SkillForge

1. **Import existing evaluators** (they're already built!)
   ```python
   from app.shared.services.g_eval.langfuse_evaluators import overall_evaluator
   ```

2. **Pass trace_id through workflow**
   ```python
   # In workflow entry point
   trace = langfuse.trace(name="analysis")
   state["langfuse_trace_id"] = trace.id
   ```

3. **Call evaluators in quality gate**
   ```python
   # In quality_gate_node
   await overall_evaluator(state["langfuse_trace_id"], synthesis)
   ```

4. **View scores in Langfuse dashboard**
   - Navigate to trace
   - See all G-Eval scores
   - Analyze trends over time
