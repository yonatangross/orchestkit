---
title: Prepare high-quality training datasets since data quality determines fine-tuning success
impact: HIGH
impactDescription: "Training data quality determines fine-tuning success -- garbage in, garbage out"
tags: [synthetic-data, dataset, quality, deduplication, teacher-model, formatting]
---

# Dataset Preparation & Synthetic Data

Upstream (do not restate): TRL `SFTTrainer` and its accepted dataset formats
live at https://huggingface.co/docs/trl/sft_trainer. Embedding models for
similarity dedup live at https://sbert.net/. This rule keeps the pipeline
order, our volume floors and the two steps teams skip.

## Pipeline order (all four steps, in this order)

```python
# 1. GENERATE with a teacher model, temperature high for diversity
resp = await client.chat.completions.create(
    model="gpt-5.5",                          # teacher, plain default id only
    messages=[{"role": "system", "content": f"Generate a training example about {topic}."}],
    response_format={"type": "json_object"},
    temperature=0.9,
)

# 2. VALIDATE with a DIFFERENT model on the cost tier, never the teacher
#    Score clarity / quality / realism 1-10; keep=false if any score < 6.
validator_model = "claude-haiku-4-5-20251001"

# 3. DEDUPLICATE on instruction embeddings, cosine > 0.85 is a duplicate
from sentence_transformers import SentenceTransformer
embeddings = SentenceTransformer("all-MiniLM-L6-v2").encode(instructions)

# 4. FORMAT once, at the end: Alpaca (instruction/input/output) or
#    ChatML (messages: [{role: user}, {role: assistant}]). Pick per trainer.
```

Steps 2 and 3 are the ones that get skipped. Generating straight into a
training file is how a 1000-example dataset turns out to be 300 distinct
examples repeated with paraphrase noise.

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
3. **Validation**: Filter with a separate model, remove low-quality
4. **Deduplication**: Remove near-duplicates to prevent overfitting
5. **Iterative Refinement**: Generate, train, evaluate, adjust generation

**Incorrect, generating a dataset without validation or deduplication:**
```python
async def generate_dataset(topic: str, num: int = 1000):
    examples = []
    for _ in range(num):
        ex = await generate_example(topic)
        examples.append(ex)  # No validation, possible duplicates
    return examples
```

**Correct, validating and deduplicating before saving:**
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
