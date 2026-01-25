---
name: create-lora-config
description: Create LoRA fine-tuning configuration with auto-detected model type. Use when setting up model fine-tuning.
user-invocable: true
argument-hint: [model-name]
---

Create LoRA config: $ARGUMENTS

## Fine-Tuning Context (Auto-Detected)

- **Model Type**: !`grep -r "llama\|mistral\|phi" requirements.txt pyproject.toml 2>/dev/null | head -1 | grep -oE 'llama|mistral|phi' || echo "llama (recommended)"`
- **Transformers**: !`grep -r "transformers\|torch" requirements.txt pyproject.toml 2>/dev/null | head -1 | grep -oE 'transformers|torch' || echo "Not detected"`
- **Training Setup**: !`find . -name "*train*.py" -o -name "*fine-tune*" 2>/dev/null | head -3 || echo "No training scripts found"`
- **Model Path**: !`grep -r "MODEL_PATH\|model_name" .env* 2>/dev/null | head -1 | cut -d'=' -f2 || echo "Not found in .env"`

## LoRA Configuration

```yaml
# LoRA Fine-Tuning Configuration: $ARGUMENTS
# Generated: !`date +%Y-%m-%d`
# Model: $ARGUMENTS

model:
  name: "$ARGUMENTS"  # Use the model name from arguments, or update from detected path above
  max_seq_length: 2048
  load_in_4bit: true  # QLoRA: true, LoRA: false

lora:
  r: 16
  lora_alpha: 32
  lora_dropout: 0.05
  target_modules:
    - q_proj
    - k_proj
    - v_proj
    - o_proj
    - gate_proj
    - up_proj
    - down_proj

training:
  output_dir: "./models/$ARGUMENTS"
  num_train_epochs: 3
  per_device_train_batch_size: 2
  gradient_accumulation_steps: 4
  learning_rate: 2.0e-4
  warmup_steps: 100
```

## Usage

1. Review detected model type above
2. Update model name if different from $ARGUMENTS
3. Save to: `config/lora-$ARGUMENTS.yaml`
4. Adjust hyperparameters for your dataset
