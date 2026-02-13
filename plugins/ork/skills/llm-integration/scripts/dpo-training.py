"""
DPO (Direct Preference Optimization) Training Script

Production-ready script for aligning language models to human preferences.
Requires a supervised fine-tuned (SFT) model as starting point.

Usage:
    python dpo-training.py --config config.yaml
    python dpo-training.py --model your-sft-model --dataset preference_data.jsonl
"""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import torch
from datasets import Dataset, load_dataset
from peft import LoraConfig, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    HfArgumentParser,
)
from trl import DPOConfig, DPOTrainer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

@dataclass
class ModelArguments:
    """Model configuration."""

    model_name_or_path: str = field(
        default="your-sft-model",
        metadata={"help": "Path to SFT model or Hugging Face model ID"},
    )
    use_lora: bool = field(
        default=True,
        metadata={"help": "Use LoRA for memory-efficient training"},
    )
    lora_r: int = field(
        default=16,
        metadata={"help": "LoRA rank"},
    )
    lora_alpha: int = field(
        default=32,
        metadata={"help": "LoRA alpha (scaling)"},
    )
    load_in_4bit: bool = field(
        default=True,
        metadata={"help": "Load model in 4-bit quantization"},
    )


@dataclass
class DataArguments:
    """Data configuration."""

    dataset_path: str = field(
        default="preference_data.jsonl",
        metadata={"help": "Path to preference dataset"},
    )
    max_length: int = field(
        default=1024,
        metadata={"help": "Maximum sequence length"},
    )
    max_prompt_length: int = field(
        default=512,
        metadata={"help": "Maximum prompt length"},
    )


@dataclass
class DPOArguments:
    """DPO training configuration."""

    output_dir: str = field(
        default="./dpo_output",
        metadata={"help": "Output directory"},
    )
    beta: float = field(
        default=0.1,
        metadata={"help": "KL penalty coefficient (0.01-0.5)"},
    )
    learning_rate: float = field(
        default=5e-6,
        metadata={"help": "Learning rate (5e-7 for full, 5e-5 for LoRA)"},
    )
    num_train_epochs: int = field(
        default=1,
        metadata={"help": "Number of training epochs"},
    )
    per_device_train_batch_size: int = field(
        default=4,
        metadata={"help": "Training batch size per device"},
    )
    gradient_accumulation_steps: int = field(
        default=4,
        metadata={"help": "Gradient accumulation steps"},
    )
    warmup_ratio: float = field(
        default=0.1,
        metadata={"help": "Warmup ratio"},
    )
    logging_steps: int = field(
        default=10,
        metadata={"help": "Logging frequency"},
    )
    eval_steps: int = field(
        default=100,
        metadata={"help": "Evaluation frequency"},
    )
    save_strategy: str = field(
        default="epoch",
        metadata={"help": "Save strategy"},
    )


# =============================================================================
# Data Loading
# =============================================================================

def load_preference_data(path: str) -> Dataset:
    """
    Load preference dataset.

    Expected format (JSONL):
    {"prompt": "...", "chosen": "...", "rejected": "..."}
    """
    path = Path(path)

    if path.suffix == ".jsonl":
        data = []
        with open(path) as f:
            for line in f:
                data.append(json.loads(line))
        return Dataset.from_list(data)
    elif path.suffix == ".json":
        with open(path) as f:
            data = json.load(f)
        return Dataset.from_list(data)
    else:
        # Assume Hugging Face dataset
        return load_dataset(str(path), split="train")


def validate_preference_data(dataset: Dataset) -> None:
    """Validate preference dataset format."""
    required_columns = {"prompt", "chosen", "rejected"}
    missing = required_columns - set(dataset.column_names)
    if missing:
        raise ValueError(f"Dataset missing columns: {missing}")

    # Check for empty values
    for i, example in enumerate(dataset):
        for col in required_columns:
            if not example[col] or not example[col].strip():
                logger.warning(f"Empty {col} at index {i}")


# =============================================================================
# Model Loading
# =============================================================================

def load_model_and_tokenizer(
    model_args: ModelArguments,
) -> tuple[AutoModelForCausalLM, AutoTokenizer]:
    """Load model with optional quantization and LoRA."""

    # Quantization config
    if model_args.load_in_4bit:
        from transformers import BitsAndBytesConfig
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )
    else:
        bnb_config = None

    # Load model
    model = AutoModelForCausalLM.from_pretrained(
        model_args.model_name_or_path,
        quantization_config=bnb_config,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(
        model_args.model_name_or_path,
        trust_remote_code=True,
    )

    # Set pad token
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        model.config.pad_token_id = tokenizer.eos_token_id

    return model, tokenizer


def apply_lora(
    model: AutoModelForCausalLM,
    model_args: ModelArguments,
) -> AutoModelForCausalLM:
    """Apply LoRA adapters to model."""

    # Prepare for k-bit training if quantized
    if model_args.load_in_4bit:
        from peft import prepare_model_for_kbit_training
        model = prepare_model_for_kbit_training(model)

    # LoRA config
    lora_config = LoraConfig(
        r=model_args.lora_r,
        lora_alpha=model_args.lora_alpha,
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
    model.print_trainable_parameters()

    return model


# =============================================================================
# Training
# =============================================================================

def train_dpo(
    model: AutoModelForCausalLM,
    tokenizer: AutoTokenizer,
    train_dataset: Dataset,
    eval_dataset: Optional[Dataset],
    dpo_args: DPOArguments,
    data_args: DataArguments,
    use_lora: bool,
) -> None:
    """Run DPO training."""

    # DPO configuration
    config = DPOConfig(
        output_dir=dpo_args.output_dir,

        # Core DPO
        beta=dpo_args.beta,
        max_length=data_args.max_length,
        max_prompt_length=data_args.max_prompt_length,

        # Training
        learning_rate=dpo_args.learning_rate,
        num_train_epochs=dpo_args.num_train_epochs,
        per_device_train_batch_size=dpo_args.per_device_train_batch_size,
        gradient_accumulation_steps=dpo_args.gradient_accumulation_steps,

        # Optimization
        warmup_ratio=dpo_args.warmup_ratio,
        weight_decay=0.01,
        bf16=True,
        gradient_checkpointing=True,

        # Logging
        logging_steps=dpo_args.logging_steps,
        logging_first_step=True,

        # Evaluation
        eval_strategy="steps" if eval_dataset else "no",
        eval_steps=dpo_args.eval_steps if eval_dataset else None,

        # Saving
        save_strategy=dpo_args.save_strategy,
        save_total_limit=2,
        load_best_model_at_end=True if eval_dataset else False,

        # Reproducibility
        seed=42,

        # Remove checkpoints at end
        remove_unused_columns=False,
    )

    # Create trainer
    # With LoRA, no separate ref_model needed (implicit reference)
    trainer = DPOTrainer(
        model=model,
        ref_model=None if use_lora else model,  # Separate ref for full fine-tune
        args=config,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        tokenizer=tokenizer,
    )

    # Train
    logger.info("Starting DPO training...")
    trainer.train()

    # Save final model
    logger.info(f"Saving model to {dpo_args.output_dir}")
    trainer.save_model(dpo_args.output_dir)
    tokenizer.save_pretrained(dpo_args.output_dir)


# =============================================================================
# Evaluation
# =============================================================================

def evaluate_alignment(
    model: AutoModelForCausalLM,
    tokenizer: AutoTokenizer,
    test_prompts: list[str],
) -> dict:
    """Quick evaluation of aligned model."""
    model.eval()
    results = []

    for prompt in test_prompts:
        inputs = tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512,
        ).to(model.device)

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=256,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
                pad_token_id=tokenizer.eos_token_id,
            )

        response = tokenizer.decode(
            outputs[0][inputs.input_ids.shape[1]:],
            skip_special_tokens=True,
        )
        results.append({"prompt": prompt, "response": response})

    return results


# =============================================================================
# Main
# =============================================================================

def main():
    """Main training function."""

    # Parse arguments
    parser = HfArgumentParser((ModelArguments, DataArguments, DPOArguments))
    model_args, data_args, dpo_args = parser.parse_args_into_dataclasses()

    # Adjust learning rate for LoRA
    if model_args.use_lora:
        dpo_args.learning_rate = 5e-5  # Higher LR for LoRA
        logger.info(f"Using LoRA, adjusted LR to {dpo_args.learning_rate}")

    # Load data
    logger.info(f"Loading dataset from {data_args.dataset_path}")
    dataset = load_preference_data(data_args.dataset_path)
    validate_preference_data(dataset)
    logger.info(f"Loaded {len(dataset)} examples")

    # Split into train/eval
    split = dataset.train_test_split(test_size=0.1, seed=42)
    train_dataset = split["train"]
    eval_dataset = split["test"]

    # Load model
    logger.info(f"Loading model from {model_args.model_name_or_path}")
    model, tokenizer = load_model_and_tokenizer(model_args)

    # Apply LoRA if enabled
    if model_args.use_lora:
        logger.info("Applying LoRA adapters")
        model = apply_lora(model, model_args)

    # Train
    train_dpo(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        dpo_args=dpo_args,
        data_args=data_args,
        use_lora=model_args.use_lora,
    )

    # Quick evaluation
    logger.info("Running quick evaluation...")
    test_prompts = [
        "Explain quantum computing in simple terms.",
        "Write a professional email declining a meeting.",
        "What are the best practices for code review?",
    ]
    results = evaluate_alignment(model, tokenizer, test_prompts)
    for r in results:
        logger.info(f"\nPrompt: {r['prompt']}\nResponse: {r['response'][:200]}...")

    logger.info("Training complete!")


if __name__ == "__main__":
    main()
