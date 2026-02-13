# LoRA & QLoRA: Parameter-Efficient Fine-Tuning

## Overview

LoRA (Low-Rank Adaptation) and QLoRA (Quantized LoRA) enable fine-tuning large models on consumer hardware by training only small adapter matrices instead of all model weights.

## How LoRA Works

```
Original: W (4096 x 4096) = 16M parameters
LoRA:     A (4096 x 16) + B (16 x 4096) = 131K parameters (0.8%)
```

LoRA decomposes weight updates into low-rank matrices:
- Freeze original weights W
- Train A and B where: W' = W + BA
- Rank r controls capacity (16-64 typical)

## Unsloth Implementation (2x Faster)

```python
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments
from datasets import load_dataset

# Load model with 4-bit quantization
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Meta-Llama-3.1-8B",
    max_seq_length=2048,
    dtype=None,  # Auto-detect
    load_in_4bit=True,  # QLoRA
)

# Add LoRA adapters
model = FastLanguageModel.get_peft_model(
    model,
    r=16,                # Rank: 16-64 typical
    lora_alpha=32,       # Scaling: usually 2x r
    lora_dropout=0.05,   # Regularization
    target_modules=[
        # Attention layers (always include)
        "q_proj", "k_proj", "v_proj", "o_proj",
        # MLP layers (per QLoRA paper - better results)
        "gate_proj", "up_proj", "down_proj",
    ],
    bias="none",
    use_gradient_checkpointing="unsloth",  # Memory efficient
    random_state=42,
)

# Prepare dataset
dataset = load_dataset("your_dataset", split="train")

def format_prompt(example):
    return f"""### Instruction:
{example['instruction']}

### Response:
{example['response']}"""

# Training arguments
training_args = TrainingArguments(
    output_dir="./output",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    num_train_epochs=1,
    warmup_ratio=0.03,
    weight_decay=0.001,
    logging_steps=10,
    save_strategy="epoch",
    fp16=True,
    optim="adamw_8bit",
)

# Train
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    formatting_func=format_prompt,
    max_seq_length=2048,
    args=training_args,
)

trainer.train()

# Save adapter only (small file)
model.save_pretrained("./lora_adapter")
tokenizer.save_pretrained("./lora_adapter")
```

## PEFT Library (Standard Implementation)

```python
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch

# 4-bit quantization config
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

# Load quantized model
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=bnb_config,
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")

# Prepare for k-bit training
model = prepare_model_for_kbit_training(model)

# LoRA config
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

# Apply LoRA
model = get_peft_model(model, lora_config)

# Print trainable parameters
model.print_trainable_parameters()
# Output: trainable params: 41,943,040 || all params: 8,071,106,560 || trainable%: 0.52%
```

## Target Module Selection

| Model Family | Recommended Modules | Notes |
|--------------|---------------------|-------|
| Llama 3.x | q,k,v,o_proj + gate,up,down_proj | Full coverage |
| Mistral | q,k,v,o_proj + gate,up,down_proj | Same as Llama |
| Phi-3 | q,k,v,o_proj + gate,up,down_proj | Same pattern |
| Qwen2 | q,k,v,o_proj + gate,up,down_proj | Same pattern |

**Minimal (attention only):**
```python
target_modules=["q_proj", "v_proj"]  # Faster, less capacity
```

**Maximum (all projections):**
```python
target_modules=[
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
    "embed_tokens", "lm_head",  # Embeddings (use cautiously)
]
```

## Hyperparameter Guidelines

```yaml
# Conservative (start here)
lora:
  r: 16
  lora_alpha: 32
  lora_dropout: 0.05

training:
  learning_rate: 2e-4
  epochs: 1
  batch_size: 4
  gradient_accumulation: 4

# Higher capacity (more complex tasks)
lora:
  r: 64
  lora_alpha: 128
  lora_dropout: 0.1

training:
  learning_rate: 1e-4
  epochs: 2-3
```

## Memory Requirements

| Model Size | Full FT | LoRA (r=16) | QLoRA (r=16) |
|------------|---------|-------------|--------------|
| 7B | 56GB+ | 16GB | 6GB |
| 13B | 104GB+ | 32GB | 10GB |
| 70B | 560GB+ | 160GB | 48GB |

## Merging Adapters

```python
# Merge LoRA weights back into base model
from peft import PeftModel

# Load base model (full precision for merging)
base_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    torch_dtype=torch.float16,
    device_map="auto",
)

# Load adapter
model = PeftModel.from_pretrained(base_model, "./lora_adapter")

# Merge and unload
merged_model = model.merge_and_unload()

# Save merged model
merged_model.save_pretrained("./merged_model")
```

## Inference with Adapter

```python
from peft import PeftModel

# Load base + adapter for inference
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    torch_dtype=torch.float16,
    device_map="auto",
)
model = PeftModel.from_pretrained(model, "./lora_adapter")

# Inference
inputs = tokenizer("Your prompt", return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=256)
```

## Common Issues

**Issue: Loss not decreasing**
- Increase r (rank) for more capacity
- Lower learning rate
- Check data formatting

**Issue: Overfitting**
- Reduce epochs (1 is often enough)
- Increase dropout
- Add more diverse data

**Issue: Out of memory**
- Use gradient checkpointing
- Reduce batch size, increase gradient accumulation
- Use 4-bit quantization (QLoRA)
