---
title: "Fine-Tuning: DPO Alignment & Evaluation"
impact: HIGH
impactDescription: "DPO aligns models to preferences without reward model training; evaluation prevents deploying degraded models"
tags: [dpo, alignment, evaluation, preference, anti-patterns, decision-framework]
---

# DPO Alignment & Evaluation

## Decision Framework: Fine-Tune or Not?

| Approach | Try First | When It Works |
|----------|-----------|---------------|
| Prompt Engineering | Always | Simple tasks, clear instructions |
| RAG | External knowledge needed | Knowledge-intensive tasks |
| Fine-Tuning | Last resort | Deep specialization, format control |

**Fine-tune ONLY when:**
1. Prompt engineering tried and insufficient
2. RAG doesn't capture domain nuances
3. Specific output format consistently required
4. You have ~1000+ high-quality examples

## DPO Implementation

```python
from trl import DPOTrainer, DPOConfig

config = DPOConfig(
    learning_rate=5e-6,  # Lower for alignment
    beta=0.1,            # KL penalty coefficient
    per_device_train_batch_size=4,
    num_train_epochs=1,
)

# Preference dataset: {prompt, chosen, rejected}
trainer = DPOTrainer(
    model=model,
    ref_model=ref_model,  # Frozen reference
    args=config,
    train_dataset=preference_dataset,
    tokenizer=tokenizer,
)
trainer.train()
```

## DPO with LoRA (Memory Efficient)

```python
from peft import LoraConfig, get_peft_model

peft_config = LoraConfig(
    r=16, lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
)
model = get_peft_model(model, peft_config)

# With LoRA, no separate ref_model needed
trainer = DPOTrainer(
    model=model,
    ref_model=None,  # Uses implicit reference
    args=DPOConfig(learning_rate=5e-5, beta=0.1),
    train_dataset=dataset,
    tokenizer=tokenizer,
)
```

## Beta Tuning

| Beta Value | Effect | Use Case |
|------------|--------|----------|
| 0.01 | Very aggressive alignment | Strong preference needed |
| 0.1 | Standard | Most tasks |
| 0.5 | Conservative | Preserve base capabilities |
| 1.0 | Minimal change | Slight steering |

## Evaluation

```python
async def evaluate_alignment(
    model, tokenizer,
    test_prompts: list[str],
    judge_model: str = "gpt-5.2-mini",
) -> dict:
    """Evaluate model alignment quality."""
    scores = []
    for prompt in test_prompts:
        inputs = tokenizer(prompt, return_tensors="pt")
        outputs = model.generate(**inputs, max_new_tokens=256)
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)

        judgment = await client.chat.completions.create(
            model=judge_model,
            messages=[{
                "role": "user",
                "content": f"Rate this response 1-10 for helpfulness.\n"
                          f"Prompt: {prompt}\nResponse: {response}"
            }]
        )
        scores.append(int(judgment.choices[0].message.content.strip()))

    return {"mean_score": sum(scores) / len(scores), "scores": scores}
```

## Anti-Patterns (FORBIDDEN)

```python
# NEVER fine-tune without trying alternatives first
model.fine_tune(data)  # Try prompt engineering & RAG first!

# NEVER use low-quality training data
data = scrape_random_web()  # Garbage in, garbage out

# NEVER skip evaluation
trainer.train()
deploy(model)  # Always evaluate before deploy!

# ALWAYS use separate eval set
train, eval = split(data, test_size=0.1)
trainer = SFTTrainer(..., eval_dataset=eval)
```

## Common Issues

**Loss not decreasing**: Increase r (rank), lower learning rate, check data formatting

**Overfitting**: Reduce epochs (1 is often enough), increase dropout, add more data

**Model too conservative** (DPO): Lower beta, add diverse positive examples

**Catastrophic forgetting**: Increase beta, mix in general data, use LoRA
