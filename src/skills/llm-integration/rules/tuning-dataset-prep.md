---
title: "Fine-Tuning: Dataset Preparation"
impact: HIGH
impactDescription: "Training data quality determines fine-tuning success -- garbage in, garbage out"
tags: [synthetic-data, dataset, quality, deduplication, teacher-model, formatting]
---

# Dataset Preparation & Synthetic Data

## Synthetic Data Generation

```python
import json
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def generate_training_example(topic: str) -> dict:
    """Generate a single training example using teacher model."""
    response = await client.chat.completions.create(
        model="gpt-5.2",  # Teacher
        messages=[{
            "role": "system",
            "content": f"Generate a training example about {topic}. "
                      "Include instruction and response."
        }],
        response_format={"type": "json_object"},
        temperature=0.9,  # Higher for diversity
    )
    return json.loads(response.choices[0].message.content)


async def generate_dataset(topic: str, num_examples: int = 100) -> list[dict]:
    """Generate dataset in batches."""
    examples = []
    batch_size = 10

    for batch_start in range(0, num_examples, batch_size):
        batch_tasks = [
            generate_training_example(topic)
            for _ in range(min(batch_size, num_examples - batch_start))
        ]
        batch_results = await asyncio.gather(*batch_tasks)
        examples.extend(batch_results)

    return examples
```

## Quality Validation

```python
async def validate_example(example: dict, validator_model: str = "gpt-5.2-mini") -> dict:
    """Validate and score a training example."""
    response = await client.chat.completions.create(
        model=validator_model,
        messages=[{
            "role": "system",
            "content": """Score this training example 1-10 on:
- clarity: Is the instruction clear?
- quality: Is the response high quality?
- realism: Is this a realistic interaction?

Output JSON: {"clarity": N, "quality": N, "realism": N, "keep": true/false}
Set keep=false if any score < 6."""
        }, {
            "role": "user",
            "content": f"Instruction: {example['instruction']}\n\nResponse: {example['response']}"
        }],
        response_format={"type": "json_object"},
    )
    return {**example, **json.loads(response.choices[0].message.content)}
```

## Deduplication

```python
from sentence_transformers import SentenceTransformer
import numpy as np

def deduplicate_examples(examples: list[dict], threshold: float = 0.85) -> list[dict]:
    """Remove near-duplicate examples using embeddings."""
    model = SentenceTransformer("all-MiniLM-L6-v2")
    instructions = [ex["instruction"] for ex in examples]
    embeddings = model.encode(instructions)

    unique_indices = []
    for i, emb in enumerate(embeddings):
        is_unique = True
        for j in unique_indices:
            similarity = np.dot(emb, embeddings[j]) / (
                np.linalg.norm(emb) * np.linalg.norm(embeddings[j])
            )
            if similarity > threshold:
                is_unique = False
                break
        if is_unique:
            unique_indices.append(i)

    return [examples[i] for i in unique_indices]
```

## Dataset Formatting

```python
# Alpaca format
def to_alpaca_format(examples: list[dict]) -> list[dict]:
    return [{
        "instruction": ex["instruction"],
        "input": ex.get("input", ""),
        "output": ex["response"],
    } for ex in examples]

# ChatML format
def to_chatml_format(examples: list[dict]) -> list[dict]:
    return [{
        "messages": [
            {"role": "user", "content": ex["instruction"]},
            {"role": "assistant", "content": ex["response"]},
        ]
    } for ex in examples]
```

## Data Requirements by Task

| Task Type | Minimum Examples | Recommended |
|-----------|------------------|-------------|
| Style/tone | 500 | 1,000 |
| Classification | 100/class | 500/class |
| Format enforcement | 500 | 2,000 |
| Domain expertise | 2,000 | 10,000 |
| Complex reasoning | 5,000 | 20,000+ |

## Best Practices

1. **Quality > Quantity**: 1,000 high-quality examples beat 10,000 mediocre ones
2. **Diversity**: Use seeds, varied prompts, multiple domains
3. **Validation**: Filter with separate model, remove low-quality
4. **Deduplication**: Remove near-duplicates to prevent overfitting
5. **Iterative Refinement**: Generate, train, evaluate, adjust generation

**Incorrect — generating dataset without validation or deduplication:**
```python
async def generate_dataset(topic: str, num: int = 1000):
    examples = []
    for _ in range(num):
        ex = await generate_example(topic)
        examples.append(ex)  # No validation, possible duplicates
    return examples
```

**Correct — validating and deduplicating before saving:**
```python
async def generate_dataset(topic: str, num: int = 1000):
    examples = []
    for _ in range(num):
        ex = await generate_example(topic)
        validation = await validate_example(ex)
        if validation["keep"]:  # Filter low-quality
            examples.append(ex)
    return deduplicate_examples(examples, threshold=0.85)
```
