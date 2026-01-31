# DPO: Direct Preference Optimization

## Overview

DPO (Direct Preference Optimization) aligns language models to human preferences without reward model training. It directly optimizes the policy using preference pairs (chosen vs rejected responses).

## DPO vs RLHF

| Aspect | RLHF | DPO |
|--------|------|-----|
| Complexity | High (RM + PPO) | Low (single training loop) |
| Stability | Unstable | Stable |
| Compute | 3-4x more | Baseline |
| Memory | High (multiple models) | Lower |
| Quality | Gold standard | Comparable |

**Recommendation:** Use DPO for most alignment tasks. RLHF only when DPO insufficient.

## Preference Dataset Format

```python
# Each example has: prompt, chosen (good), rejected (bad)
preference_data = [
    {
        "prompt": "Explain quantum computing simply.",
        "chosen": "Quantum computers use qubits that can be both 0 and 1 simultaneously, "
                  "unlike classical bits. This allows them to solve certain problems faster.",
        "rejected": "Quantum computing is very complicated and uses physics stuff. "
                    "It's basically magic computers that are super fast."
    },
    {
        "prompt": "Write a professional email declining a meeting.",
        "chosen": "Subject: Re: Meeting Request\n\nThank you for the invitation. "
                  "Unfortunately, I have a prior commitment at that time. "
                  "Could we reschedule to later this week?",
        "rejected": "Can't make it, too busy. Maybe some other time idk."
    }
]
```

## TRL Implementation

```python
from trl import DPOTrainer, DPOConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from datasets import Dataset

# Load SFT'd model (DPO requires supervised fine-tuned base)
model = AutoModelForCausalLM.from_pretrained(
    "your-sft-model",
    torch_dtype=torch.float16,
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained("your-sft-model")
tokenizer.pad_token = tokenizer.eos_token

# Reference model (frozen copy for KL constraint)
ref_model = AutoModelForCausalLM.from_pretrained(
    "your-sft-model",
    torch_dtype=torch.float16,
    device_map="auto",
)

# DPO configuration
config = DPOConfig(
    # Learning rate (lower than SFT)
    learning_rate=5e-7,

    # Beta: KL penalty coefficient
    # Higher = closer to reference, Lower = more aggressive alignment
    beta=0.1,

    # Sequence lengths
    max_length=1024,
    max_prompt_length=512,

    # Training
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    num_train_epochs=1,

    # Optimization
    warmup_ratio=0.1,
    weight_decay=0.01,

    # Logging
    logging_steps=10,
    output_dir="./dpo_output",
)

# Prepare dataset
dataset = Dataset.from_list(preference_data)

# Create trainer
trainer = DPOTrainer(
    model=model,
    ref_model=ref_model,
    args=config,
    train_dataset=dataset,
    tokenizer=tokenizer,
)

# Train
trainer.train()

# Save aligned model
trainer.save_model("./aligned_model")
```

## DPO with LoRA (Memory Efficient)

```python
from peft import LoraConfig, get_peft_model

# Base model
model = AutoModelForCausalLM.from_pretrained(
    "your-sft-model",
    torch_dtype=torch.float16,
    device_map="auto",
)

# LoRA config for DPO
peft_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

# Apply LoRA
model = get_peft_model(model, peft_config)

# DPO config for LoRA
config = DPOConfig(
    learning_rate=5e-5,  # Higher LR for LoRA
    beta=0.1,
    per_device_train_batch_size=4,
    # ... other params
)

# With LoRA, no separate ref_model needed
trainer = DPOTrainer(
    model=model,
    ref_model=None,  # Uses implicit reference
    args=config,
    train_dataset=dataset,
    tokenizer=tokenizer,
    peft_config=peft_config,
)
```

## Creating Preference Data

### Manual Curation
```python
def create_preference_pair(prompt: str, good: str, bad: str) -> dict:
    """Create a single preference example."""
    return {
        "prompt": prompt,
        "chosen": good,
        "rejected": bad,
    }
```

### LLM-Generated Preferences
```python
async def generate_preference_pairs(
    prompts: list[str],
    client: OpenAI,
) -> list[dict]:
    """Generate preference pairs using GPT-4."""
    pairs = []

    for prompt in prompts:
        # Generate good response
        good = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Provide a helpful, accurate response."},
                {"role": "user", "content": prompt}
            ]
        )

        # Generate bad response
        bad = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Provide a response that is vague, "
                 "unhelpful, or slightly incorrect."},
                {"role": "user", "content": prompt}
            ]
        )

        pairs.append({
            "prompt": prompt,
            "chosen": good.choices[0].message.content,
            "rejected": bad.choices[0].message.content,
        })

    return pairs
```

### From Human Feedback
```python
def collect_human_preferences(
    prompt: str,
    responses: list[str],
) -> dict | None:
    """Present responses to human annotator for ranking."""
    print(f"Prompt: {prompt}\n")
    for i, r in enumerate(responses):
        print(f"[{i}] {r}\n")

    chosen_idx = int(input("Better response (index): "))
    rejected_idx = int(input("Worse response (index): "))

    return {
        "prompt": prompt,
        "chosen": responses[chosen_idx],
        "rejected": responses[rejected_idx],
    }
```

## Beta Tuning

| Beta Value | Effect | Use Case |
|------------|--------|----------|
| 0.01 | Very aggressive alignment | Strong preference needed |
| 0.1 | Standard | Most tasks |
| 0.5 | Conservative | Preserve base capabilities |
| 1.0 | Minimal change | Slight steering |

```python
# Start with beta=0.1, adjust based on evaluation
config = DPOConfig(
    beta=0.1,  # Experiment: [0.05, 0.1, 0.2, 0.5]
    # ...
)
```

## Evaluation

```python
async def evaluate_alignment(
    model,
    tokenizer,
    test_prompts: list[str],
    judge_model: str = "gpt-4o-mini",
) -> dict:
    """Evaluate model alignment quality."""
    scores = []

    for prompt in test_prompts:
        # Generate response
        inputs = tokenizer(prompt, return_tensors="pt")
        outputs = model.generate(**inputs, max_new_tokens=256)
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Judge quality
        judgment = await client.chat.completions.create(
            model=judge_model,
            messages=[{
                "role": "user",
                "content": f"Rate this response 1-10 for helpfulness and safety.\n"
                          f"Prompt: {prompt}\nResponse: {response}\n"
                          f"Just respond with the number."
            }]
        )
        scores.append(int(judgment.choices[0].message.content.strip()))

    return {
        "mean_score": sum(scores) / len(scores),
        "scores": scores,
    }
```

## Common Issues

**Issue: Model becomes too conservative**
- Lower beta value
- Add more diverse positive examples
- Check if rejected examples are too similar to chosen

**Issue: Alignment not taking effect**
- Ensure model is properly SFT'd first
- Increase learning rate
- Check preference data quality (clear distinction)

**Issue: Catastrophic forgetting**
- Increase beta (stronger KL constraint)
- Mix in general capability data
- Use LoRA to preserve base weights
