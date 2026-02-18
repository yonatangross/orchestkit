# Langfuse Experiments API

## Overview

The Experiments API enables systematic evaluation of LLM outputs across datasets. Use it for A/B testing prompts, comparing models, and tracking quality over time. v3 adds the Experiment Runner SDK, dataset item versioning, and corrected outputs.

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

## Experiment Runner SDK (v3)

The high-level API simplifies running experiments:

```python
from langfuse import Langfuse

langfuse = Langfuse()


async def my_pipeline(input_data: dict) -> str:
    """Your LLM pipeline to evaluate."""
    return await llm.generate(input_data["query"])


# Run experiment in one call
result = langfuse.run_experiment(
    dataset_name="golden-analysis-dataset",
    experiment_name="sonnet-v-gpt5",
    run_fn=my_pipeline,
    evaluators=[
        {"name": "relevance", "fn": relevance_evaluator},
        {"name": "depth", "fn": depth_evaluator},
    ],
)

# Result contains:
# - experiment_id
# - per-item scores
# - aggregate statistics
print(f"Avg relevance: {result.stats['relevance']['mean']:.2f}")
print(f"Avg depth: {result.stats['depth']['mean']:.2f}")
```

## Creating Datasets

### From Code

```python
from langfuse import Langfuse

langfuse = Langfuse()

# Create dataset with JSON schema enforcement
dataset = langfuse.create_dataset(
    name="golden-analysis-dataset",
    description="Curated analysis examples with expected outputs",
    metadata={"version": "v2", "schema_version": "1.0"},
)

# Add items with versioning
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

## Dataset Item Versioning

Track changes to dataset items over time:

```python
# Update an existing item — creates a new version
langfuse.update_dataset_item(
    dataset_name="golden-analysis-dataset",
    item_id="item_123",
    expected_output="Updated expected output with more detail...",
    metadata={"version": 2, "updated_by": "human_reviewer"},
)

# View item history in Langfuse UI:
# item_123 v1 (Jan 15) → v2 (Feb 01)
# Each experiment run records which version it evaluated against
```

## JSON Schema Enforcement

Enforce structure on dataset items:

```python
# Create dataset with schema
dataset = langfuse.create_dataset(
    name="structured-eval-dataset",
    description="Dataset with enforced input schema",
    metadata={
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "context": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["query"],
        }
    },
)

# Items must match schema — invalid items are rejected
langfuse.create_dataset_item(
    dataset_name="structured-eval-dataset",
    input={"query": "What is XSS?", "context": ["OWASP guide..."]},
    expected_output="XSS is a web security vulnerability...",
)
```

## Dataset Folder Organization

Organize datasets into folders:

```
Datasets/
├── production/
│   ├── golden-v1
│   ├── golden-v2
│   └── regression-suite
├── experiments/
│   ├── prompt-variants
│   └── model-comparison
└── development/
    ├── unit-tests
    └── edge-cases
```

## Batch Add Observations to Datasets

Add multiple observations at once:

```python
# Batch add from production traces
observation_ids = ["obs_1", "obs_2", "obs_3", "obs_4", "obs_5"]

langfuse.batch_add_dataset_items(
    dataset_name="production-golden-v1",
    observation_ids=observation_ids,
    metadata={"batch": "2026-02-01", "source": "production"},
)
```

## Corrected Outputs for Fine-Tuning

Use corrected outputs to build fine-tuning datasets:

```python
# Add corrected output to existing dataset item
langfuse.update_dataset_item(
    dataset_name="golden-analysis-dataset",
    item_id="item_456",
    corrected_output="Human-corrected version of the analysis...",
    metadata={"corrected_by": "expert_reviewer", "correction_type": "factual"},
)

# Export for fine-tuning
items = langfuse.get_dataset("golden-analysis-dataset").items

fine_tuning_data = []
for item in items:
    if item.corrected_output:
        fine_tuning_data.append({
            "messages": [
                {"role": "user", "content": str(item.input)},
                {"role": "assistant", "content": item.corrected_output},
            ]
        })

# Export as JSONL for fine-tuning
import json
with open("fine_tuning.jsonl", "w") as f:
    for entry in fine_tuning_data:
        f.write(json.dumps(entry) + "\n")
```

## Running Experiments (Manual)

### Basic Experiment

```python
from langfuse import observe, get_client, Langfuse

langfuse = Langfuse()


@observe()
async def run_experiment(
    dataset_name: str,
    experiment_name: str,
    model_config: dict,
):
    """Run an experiment on a dataset."""
    dataset = langfuse.get_dataset(dataset_name)

    results = []

    for item in dataset.items:
        @observe(name="experiment_run")
        async def evaluate_item(item=item):
            output = await your_pipeline(item.input, model_config)

            get_client().update_current_observation(
                input=item.input,
                output=output,
                metadata={"dataset_item_id": item.id},
            )

            return output

        output = await evaluate_item()
        results.append({"item_id": item.id, "output": output})

    return results
```

### A/B Testing Models

```python
async def ab_test_models(dataset_name: str):
    """Compare two model configurations."""

    configs = {
        "sonnet": {"model": "claude-sonnet-4-6", "temperature": 0.7},
        "gpt5": {"model": "gpt-5.2", "temperature": 0.7},
    }

    for name, config in configs.items():
        result = langfuse.run_experiment(
            dataset_name=dataset_name,
            experiment_name=f"model-comparison-{name}",
            run_fn=lambda input_data: your_pipeline(input_data, config),
            evaluators=[
                {"name": "relevance", "fn": relevance_evaluator},
                {"name": "depth", "fn": depth_evaluator},
            ],
        )
        print(f"{name}: avg_relevance={result.stats['relevance']['mean']:.2f}")
```

## Experiment Compare View

Compare experiments side-by-side in Langfuse UI:

- **Aggregate scores**: Average, median, std per criterion
- **Per-item comparison**: See how each item scored across experiments
- **Annotations**: Add notes to individual items or experiments
- **Diff view**: See which items improved or regressed
- **Export**: Download comparison as CSV

## OrchestKit Integration

### Golden Dataset Experiment

```python
from langfuse import Langfuse

langfuse = Langfuse()


async def run_golden_experiment():
    """Run quality experiment on golden dataset."""

    # 1. Create dataset from golden analyses
    golden_analyses = await get_golden_analyses()

    dataset = langfuse.create_dataset(name="orchestkit-golden-v1")
    for analysis in golden_analyses:
        langfuse.create_dataset_item(
            dataset_name="orchestkit-golden-v1",
            input={"url": analysis.url},
            expected_output=analysis.synthesis,
            metadata={"analysis_id": str(analysis.id)},
        )

    # 2. Run experiment with Experiment Runner
    result = langfuse.run_experiment(
        dataset_name="orchestkit-golden-v1",
        experiment_name=f"quality-test-{datetime.now().isoformat()}",
        run_fn=run_analysis_pipeline,
        evaluators=[
            {"name": "depth", "fn": depth_evaluator},
            {"name": "accuracy", "fn": accuracy_evaluator},
            {"name": "overall", "fn": overall_evaluator},
        ],
    )

    return {
        "experiment_id": result.experiment_id,
        "stats": result.stats,
        "pass_rate": result.stats["overall"]["mean"] >= 0.7,
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

    results = {}
    for name, prompt in variants.items():
        result = langfuse.run_experiment(
            dataset_name="orchestkit-golden-v1",
            experiment_name=f"prompt-variant-{name}",
            run_fn=lambda input_data: run_with_prompt(input_data, prompt),
            evaluators=[
                {"name": "overall", "fn": overall_evaluator},
            ],
        )
        results[name] = result.stats["overall"]["mean"]

    # Compare all variants
    winner = max(results, key=results.get)
    return {"winner": winner, "scores": results}
```

## Viewing Results

### Langfuse Dashboard

1. **Experiments Tab**: See all experiments with aggregate scores
2. **Compare View**: Side-by-side experiment comparison with annotations
3. **Runs Tab**: See individual executions with per-item scores
4. **Diff View**: Identify regressions between experiment versions

### Export Results

```python
import pandas as pd
from langfuse import Langfuse

langfuse = Langfuse()


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

1. **Use Experiment Runner SDK** for simplified experiment execution
2. **Version your datasets** with semantic names like `golden-v1`, `golden-v2`
3. **Use corrected outputs** to build fine-tuning datasets from production data
4. **Include metadata**: Store model config, prompt version in experiment metadata
5. **Evaluate consistently**: Use same evaluators across experiments
6. **Track over time**: Run same experiment periodically to detect regression
7. **Use ground truth**: When available, compute similarity to expected output
8. **Organize datasets** in folders by purpose (production, experiments, dev)
