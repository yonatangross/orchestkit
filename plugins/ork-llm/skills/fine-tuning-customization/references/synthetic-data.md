# Synthetic Data Generation for Fine-Tuning

## Overview

Synthetic data generation uses large teacher models (GPT-4, Claude) to create training data for smaller student models. This enables cost-effective fine-tuning without expensive manual annotation.

## Teacher-Student Paradigm

```
Teacher Model (GPT-4o) → Generate Examples → Train Student (Llama-8B)
                                                    ↓
                                              Deploy Student (cheaper)
```

## Basic Generation

```python
import json
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def generate_training_example(
    topic: str,
    style: str = "helpful and concise",
) -> dict:
    """Generate a single training example."""
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "system",
            "content": f"""Generate a training example for a {style} AI assistant.

Topic: {topic}

Output JSON with:
- instruction: A realistic user question/request
- response: An ideal assistant response

Be specific and realistic. Vary complexity and phrasing."""
        }],
        response_format={"type": "json_object"},
        temperature=0.9,  # Higher for diversity
    )

    return json.loads(response.choices[0].message.content)


async def generate_dataset(
    topic: str,
    num_examples: int = 100,
    batch_size: int = 10,
) -> list[dict]:
    """Generate multiple training examples in batches."""
    examples = []

    for batch_start in range(0, num_examples, batch_size):
        batch_tasks = [
            generate_training_example(topic)
            for _ in range(min(batch_size, num_examples - batch_start))
        ]
        batch_results = await asyncio.gather(*batch_tasks)
        examples.extend(batch_results)

        print(f"Generated {len(examples)}/{num_examples} examples")

    return examples


# Usage
examples = asyncio.run(generate_dataset(
    topic="Python programming and debugging",
    num_examples=1000,
))
```

## Diverse Generation Strategies

### Seed-Based Diversity

```python
SEED_INSTRUCTIONS = [
    "Explain {concept} to a beginner",
    "Debug this {language} code: {code_snippet}",
    "Compare {thing1} and {thing2}",
    "Write a function that {task}",
    "What are best practices for {topic}?",
    "How do I handle {error_type} in {context}?",
]

async def generate_with_seeds(
    seeds: list[str],
    fill_values: dict,
    per_seed: int = 20,
) -> list[dict]:
    """Generate examples based on seed templates."""
    examples = []

    for seed in seeds:
        for _ in range(per_seed):
            # Randomly fill template
            filled = seed.format(**{
                k: random.choice(v) if isinstance(v, list) else v
                for k, v in fill_values.items()
            })

            example = await generate_training_example(filled)
            examples.append(example)

    return examples
```

### Multi-Turn Conversations

```python
async def generate_conversation(
    topic: str,
    num_turns: int = 3,
) -> list[dict]:
    """Generate multi-turn conversation examples."""
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "system",
            "content": f"""Generate a realistic {num_turns}-turn conversation between a user and AI assistant about {topic}.

Output JSON:
{{
  "conversation": [
    {{"role": "user", "content": "..."}},
    {{"role": "assistant", "content": "..."}},
    ...
  ]
}}

Make it realistic with follow-up questions and clarifications."""
        }],
        response_format={"type": "json_object"},
    )

    return json.loads(response.choices[0].message.content)
```

## Quality Control

### Self-Validation

```python
async def validate_example(
    example: dict,
    validator_model: str = "gpt-4o-mini",
) -> dict:
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

    validation = json.loads(response.choices[0].message.content)
    return {**example, **validation}


async def generate_validated_dataset(
    topic: str,
    target_count: int = 1000,
    quality_threshold: float = 0.8,
) -> list[dict]:
    """Generate and filter high-quality examples."""
    validated = []
    generated = 0

    while len(validated) < target_count:
        # Generate batch
        batch = await generate_dataset(topic, num_examples=100)
        generated += len(batch)

        # Validate
        validations = await asyncio.gather(*[
            validate_example(ex) for ex in batch
        ])

        # Filter
        high_quality = [v for v in validations if v.get("keep", False)]
        validated.extend(high_quality)

        acceptance_rate = len(high_quality) / len(batch)
        print(f"Batch acceptance: {acceptance_rate:.1%}, "
              f"Total: {len(validated)}/{target_count}")

    return validated[:target_count]
```

### Deduplication

```python
from sentence_transformers import SentenceTransformer
import numpy as np

def deduplicate_examples(
    examples: list[dict],
    similarity_threshold: float = 0.85,
) -> list[dict]:
    """Remove near-duplicate examples using embeddings."""
    model = SentenceTransformer("all-MiniLM-L6-v2")

    # Embed instructions
    instructions = [ex["instruction"] for ex in examples]
    embeddings = model.encode(instructions)

    # Find unique examples
    unique_indices = []
    for i, emb in enumerate(embeddings):
        is_unique = True
        for j in unique_indices:
            similarity = np.dot(emb, embeddings[j]) / (
                np.linalg.norm(emb) * np.linalg.norm(embeddings[j])
            )
            if similarity > similarity_threshold:
                is_unique = False
                break
        if is_unique:
            unique_indices.append(i)

    print(f"Deduplication: {len(examples)} → {len(unique_indices)} "
          f"({len(unique_indices)/len(examples):.1%} unique)")

    return [examples[i] for i in unique_indices]
```

## Domain-Specific Generation

### Code Examples

```python
async def generate_code_examples(
    language: str,
    difficulty: str = "intermediate",
    num_examples: int = 100,
) -> list[dict]:
    """Generate coding instruction-response pairs."""
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "system",
            "content": f"""Generate {num_examples} {language} coding examples at {difficulty} level.

Each example should have:
- instruction: A coding task or question
- response: Working code with explanation

Include variety: algorithms, debugging, best practices, common patterns.

Output JSON array of {{"instruction": "...", "response": "..."}}"""
        }],
        response_format={"type": "json_object"},
    )

    return json.loads(response.choices[0].message.content).get("examples", [])
```

### Domain Expertise

```python
async def generate_domain_examples(
    domain: str,
    expertise_level: str,
    terminology: list[str],
) -> list[dict]:
    """Generate domain-specific training data."""
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "system",
            "content": f"""Generate training examples for a {domain} expert assistant.

Expertise level: {expertise_level}
Must naturally incorporate terminology: {', '.join(terminology)}

Generate realistic questions a {expertise_level} professional would ask.
Responses should demonstrate deep domain knowledge."""
        }],
        response_format={"type": "json_object"},
    )

    return json.loads(response.choices[0].message.content)
```

## Dataset Formatting

### Alpaca Format

```python
def to_alpaca_format(examples: list[dict]) -> list[dict]:
    """Convert to Alpaca training format."""
    return [
        {
            "instruction": ex["instruction"],
            "input": ex.get("input", ""),
            "output": ex["response"],
        }
        for ex in examples
    ]
```

### ChatML Format

```python
def to_chatml_format(examples: list[dict]) -> list[dict]:
    """Convert to ChatML format for chat models."""
    return [
        {
            "messages": [
                {"role": "user", "content": ex["instruction"]},
                {"role": "assistant", "content": ex["response"]},
            ]
        }
        for ex in examples
    ]
```

## Cost Estimation

```python
def estimate_generation_cost(
    num_examples: int,
    avg_input_tokens: int = 100,
    avg_output_tokens: int = 300,
    model: str = "gpt-4o",
) -> float:
    """Estimate synthetic data generation cost."""
    # GPT-4o pricing (as of 2024)
    prices = {
        "gpt-4o": {"input": 2.50 / 1_000_000, "output": 10.00 / 1_000_000},
        "gpt-4o-mini": {"input": 0.15 / 1_000_000, "output": 0.60 / 1_000_000},
    }

    price = prices.get(model, prices["gpt-4o"])

    input_cost = num_examples * avg_input_tokens * price["input"]
    output_cost = num_examples * avg_output_tokens * price["output"]

    return input_cost + output_cost


# Example: 10,000 examples with GPT-4o
cost = estimate_generation_cost(10000)
print(f"Estimated cost: ${cost:.2f}")  # ~$32.50
```

## Best Practices

1. **Quality > Quantity**: 1,000 high-quality examples beat 10,000 mediocre ones
2. **Diversity**: Use seeds, varied prompts, multiple domains
3. **Validation**: Filter with separate model, remove low-quality
4. **Deduplication**: Remove near-duplicates to prevent overfitting
5. **Iterative Refinement**: Generate, train, evaluate, adjust generation
