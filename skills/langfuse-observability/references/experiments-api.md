# Langfuse Experiments API

## Overview

The Experiments API enables systematic evaluation of LLM outputs across datasets. Use it for A/B testing prompts, comparing models, and tracking quality over time.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Langfuse Experiments Flow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────┐     ┌────────────┐     ┌──────────────┐              │
│   │ Dataset  │────▶│ Experiment │────▶│ Runs (Items) │              │
│   │ (inputs) │     │ (config)   │     │ (executions) │              │
│   └──────────┘     └────────────┘     └──────┬───────┘              │
│                                              │                       │
│                                              ▼                       │
│                                    ┌──────────────────┐             │
│                                    │ Evaluators       │             │
│                                    │ (judge outputs)  │             │
│                                    └────────┬─────────┘             │
│                                             │                        │
│                                             ▼                        │
│                                    ┌──────────────────┐             │
│                                    │ Scores           │             │
│                                    │ (per run)        │             │
│                                    └──────────────────┘             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Creating Datasets

### From Code

```python
from langfuse import Langfuse

langfuse = Langfuse()

# Create dataset
dataset = langfuse.create_dataset(
    name="golden-analysis-dataset",
    description="Curated analysis examples with expected outputs",
)

# Add items
items = [
    {
        "input": {"url": "https://example.com/article1", "type": "article"},
        "expected_output": "Expected analysis for article 1...",
        "metadata": {"category": "tutorial", "difficulty": "beginner"},
    },
    {
        "input": {"url": "https://example.com/article2", "type": "article"},
        "expected_output": "Expected analysis for article 2...",
        "metadata": {"category": "reference", "difficulty": "advanced"},
    },
]

for item in items:
    langfuse.create_dataset_item(
        dataset_name="golden-analysis-dataset",
        input=item["input"],
        expected_output=item.get("expected_output"),
        metadata=item.get("metadata"),
    )
```

### From Existing Traces

```python
# Create dataset from production traces
traces = langfuse.get_traces(
    filter={
        "score_name": "human_verified",
        "score_value_gte": 0.9,  # Only high-quality
    },
    limit=100,
)

dataset = langfuse.create_dataset(name="production-golden-v1")

for trace in traces:
    langfuse.create_dataset_item(
        dataset_name="production-golden-v1",
        input=trace.input,
        expected_output=trace.output,
        metadata={"trace_id": trace.id},
    )
```

## Running Experiments

### Basic Experiment

```python
async def run_experiment(
    dataset_name: str,
    experiment_name: str,
    model_config: dict,
):
    """Run an experiment on a dataset."""
    dataset = langfuse.get_dataset(dataset_name)

    # Create experiment
    experiment = langfuse.create_experiment(
        name=experiment_name,
        metadata={"model_config": model_config},
    )

    results = []

    for item in dataset.items:
        # Create trace for this run
        trace = langfuse.trace(
            name="experiment_run",
            metadata={"dataset_item_id": item.id},
        )

        # Run your pipeline
        output = await your_pipeline(item.input, model_config)

        # Create run linked to experiment
        run = langfuse.create_run(
            experiment_id=experiment.id,
            dataset_item_id=item.id,
            trace_id=trace.id,
            input=item.input,
            output=output,
            expected_output=item.expected_output,
        )

        results.append({
            "item_id": item.id,
            "run_id": run.id,
            "output": output,
        })

    return experiment.id, results
```

### A/B Testing Models

```python
async def ab_test_models(dataset_name: str):
    """Compare two model configurations."""

    configs = {
        "sonnet": {"model": "claude-sonnet-4-20250514", "temperature": 0.7},
        "gpt4o": {"model": "gpt-4o", "temperature": 0.7},
    }

    experiments = {}

    for name, config in configs.items():
        exp_id, results = await run_experiment(
            dataset_name=dataset_name,
            experiment_name=f"model-comparison-{name}",
            model_config=config,
        )
        experiments[name] = exp_id

    # Run evaluations on both
    for name, exp_id in experiments.items():
        await evaluate_experiment(exp_id)

    # Compare results
    return compare_experiments(experiments)
```

## Evaluation During Experiments

### Automatic Evaluation

```python
async def run_experiment_with_eval(dataset_name: str, experiment_name: str):
    """Run experiment with automatic evaluation."""
    dataset = langfuse.get_dataset(dataset_name)

    experiment = langfuse.create_experiment(name=experiment_name)

    for item in dataset.items:
        trace = langfuse.trace(name="experiment_run")

        # Run pipeline
        output = await pipeline(item.input)

        # Create run
        run = langfuse.create_run(
            experiment_id=experiment.id,
            dataset_item_id=item.id,
            trace_id=trace.id,
            output=output,
        )

        # Run evaluations immediately
        await evaluate_run(
            trace_id=trace.id,
            output=output,
            expected_output=item.expected_output,
        )


async def evaluate_run(trace_id: str, output: str, expected_output: str = None):
    """Run all evaluators on a single run."""

    # G-Eval judges
    scores = {
        "depth": await depth_evaluator(trace_id, output),
        "accuracy": await accuracy_evaluator(trace_id, output),
        "coherence": await coherence_evaluator(trace_id, output),
    }

    # Overall score
    overall = await overall_evaluator(trace_id, output)
    scores["overall"] = overall

    # If ground truth available, compute similarity
    if expected_output:
        similarity = compute_similarity(output, expected_output)
        langfuse.score(
            trace_id=trace_id,
            name="ground_truth_similarity",
            value=similarity,
        )
        scores["similarity"] = similarity

    return scores
```

### Batch Evaluation

```python
async def batch_evaluate_experiment(experiment_id: str):
    """Evaluate all runs in an experiment."""

    runs = langfuse.get_experiment_runs(experiment_id)

    all_scores = []

    for run in runs:
        scores = await evaluate_run(
            trace_id=run.trace_id,
            output=run.output,
            expected_output=run.expected_output,
        )
        all_scores.append({"run_id": run.id, **scores})

    # Compute aggregate stats
    stats = {
        "count": len(all_scores),
        "avg_overall": np.mean([s["overall"] for s in all_scores]),
        "avg_depth": np.mean([s["depth"] for s in all_scores]),
        "pass_rate": np.mean([s["overall"] >= 0.7 for s in all_scores]),
    }

    return {"runs": all_scores, "stats": stats}
```

## Comparing Experiments

```python
def compare_experiments(experiment_ids: dict[str, str]) -> dict:
    """Compare multiple experiments."""

    results = {}

    for name, exp_id in experiment_ids.items():
        runs = langfuse.get_experiment_runs(exp_id)

        scores = []
        for run in runs:
            run_scores = langfuse.get_scores(trace_id=run.trace_id)
            scores.append({
                score.name: score.value
                for score in run_scores
            })

        results[name] = {
            "count": len(scores),
            "avg_overall": np.mean([s.get("g_eval_overall", 0) for s in scores]),
            "avg_depth": np.mean([s.get("g_eval_depth", 0) for s in scores]),
            "std_overall": np.std([s.get("g_eval_overall", 0) for s in scores]),
        }

    # Statistical comparison
    comparison = {
        "winner": max(results.items(), key=lambda x: x[1]["avg_overall"])[0],
        "results": results,
    }

    return comparison
```

## SkillForge Integration

### Golden Dataset Experiment

```python
# Run experiment on SkillForge's golden dataset
async def run_golden_experiment():
    """Run quality experiment on golden dataset."""

    # 1. Create dataset from golden analyses
    golden_analyses = await get_golden_analyses()

    dataset = langfuse.create_dataset(name="skillforge-golden-v1")
    for analysis in golden_analyses:
        langfuse.create_dataset_item(
            dataset_name="skillforge-golden-v1",
            input={"url": analysis.url},
            expected_output=analysis.synthesis,
            metadata={"analysis_id": str(analysis.id)},
        )

    # 2. Run experiment
    experiment_id, results = await run_experiment_with_eval(
        dataset_name="skillforge-golden-v1",
        experiment_name=f"quality-test-{datetime.now().isoformat()}",
    )

    # 3. Get summary
    stats = await batch_evaluate_experiment(experiment_id)

    return {
        "experiment_id": experiment_id,
        "stats": stats["stats"],
        "url": f"https://langfuse.example.com/experiments/{experiment_id}",
    }
```

### Prompt Variant Testing

```python
async def test_prompt_variants():
    """A/B test different prompt templates."""

    variants = {
        "detailed": "Provide a comprehensive, in-depth analysis...",
        "concise": "Provide a brief, focused analysis...",
        "structured": "Analyze using the following structure: 1) Overview...",
    }

    for name, prompt in variants.items():
        # Create experiment
        exp_id, _ = await run_experiment(
            dataset_name="skillforge-golden-v1",
            experiment_name=f"prompt-variant-{name}",
            model_config={"prompt_template": prompt},
        )

        # Evaluate
        await batch_evaluate_experiment(exp_id)

    # Compare all variants
    return compare_experiments({
        name: exp_id
        for name, (exp_id, _) in zip(variants.keys(), experiments)
    })
```

## Viewing Results

### Langfuse Dashboard

1. **Experiments Tab**: See all experiments
2. **Runs Tab**: See individual executions
3. **Scores**: See evaluation scores per run
4. **Compare**: Side-by-side experiment comparison

### Export Results

```python
def export_experiment_results(experiment_id: str) -> pd.DataFrame:
    """Export experiment results to DataFrame."""

    runs = langfuse.get_experiment_runs(experiment_id)

    data = []
    for run in runs:
        scores = langfuse.get_scores(trace_id=run.trace_id)
        score_dict = {s.name: s.value for s in scores}

        data.append({
            "run_id": run.id,
            "item_id": run.dataset_item_id,
            **run.input,
            **score_dict,
        })

    return pd.DataFrame(data)
```

## Best Practices

1. **Version Your Datasets**: Use semantic names like `golden-v1`, `golden-v2`
2. **Include Metadata**: Store model config, prompt version, etc.
3. **Evaluate Consistently**: Use same evaluators across experiments
4. **Track Over Time**: Run same experiment periodically to detect regression
5. **Use Ground Truth**: When available, compute similarity to expected output
