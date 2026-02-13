---
title: "Fine-Tuning: LoRA/QLoRA Configuration"
impact: HIGH
impactDescription: "LoRA enables fine-tuning large models on consumer hardware with 0.5-2% of original parameters"
tags: [lora, qlora, peft, unsloth, adapter, fine-tuning, training]
---

# LoRA/QLoRA Fine-Tuning

## How LoRA Works

```
Original: W (4096 x 4096) = 16M parameters
LoRA:     A (4096 x 16) + B (16 x 4096) = 131K parameters (0.8%)
```

LoRA decomposes weight updates into low-rank matrices: freeze original W, train A and B where W' = W + BA.

## LoRA vs QLoRA

| Criteria | LoRA | QLoRA |
|----------|------|-------|
| Model fits in VRAM | Use LoRA | |
| Memory constrained | | Use QLoRA |
| Training speed | 39% faster | |
| Memory savings | | 75%+ (dynamic 4-bit quants) |
| Quality | Baseline | ~Same |
| 70B model | | <48GB VRAM |

## Unsloth QLoRA Training

```python
from unsloth import FastLanguageModel
from trl import SFTTrainer

# Load with 4-bit quantization (QLoRA)
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Meta-Llama-3.1-8B",
    max_seq_length=2048,
    load_in_4bit=True,
)

# Add LoRA adapters
model = FastLanguageModel.get_peft_model(
    model,
    r=16,              # Rank (16-64 typical)
    lora_alpha=32,     # Scaling (2x r)
    lora_dropout=0.05,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",  # Attention
        "gate_proj", "up_proj", "down_proj",      # MLP
    ],
)

# Train
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    max_seq_length=2048,
)
trainer.train()
```

## PEFT Library (Standard)

```python
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
import torch

# 4-bit quantization
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=bnb_config,
    device_map="auto",
)
model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=16, lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
)
model = get_peft_model(model, lora_config)
```

## Merging Adapters

```python
from peft import PeftModel

base_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B", torch_dtype=torch.float16, device_map="auto",
)
model = PeftModel.from_pretrained(base_model, "./lora_adapter")
merged_model = model.merge_and_unload()
merged_model.save_pretrained("./merged_model")
```

## Key Hyperparameters

| Parameter | Recommended | Notes |
|-----------|-------------|-------|
| Learning rate | 2e-4 | LoRA/QLoRA standard |
| Epochs | 1-3 | More risks overfitting |
| LoRA r | 16-64 | Higher = more capacity |
| LoRA alpha | 2x r | Scaling factor |
| Batch size | 4-8 | Per device |
| Warmup | 3% | Ratio of steps |

## Memory Requirements

| Model Size | Full FT | LoRA (r=16) | QLoRA (r=16) |
|------------|---------|-------------|--------------|
| 7B | 56GB+ | 16GB | 6GB |
| 13B | 104GB+ | 32GB | 10GB |
| 70B | 560GB+ | 160GB | 48GB |
