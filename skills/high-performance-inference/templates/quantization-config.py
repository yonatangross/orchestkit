"""
Model Quantization Template

Quantize HuggingFace models using GPTQModel for efficient inference.

Usage:
    python quantization-config.py --model meta-llama/Llama-3.2-1B-Instruct --bits 4

Environment Variables:
    HF_TOKEN: HuggingFace token for gated models
    CALIBRATION_SAMPLES: Number of calibration samples (default: 512)
"""

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

# Validation constants
MIN_CALIBRATION_SAMPLES = 32
MAX_CALIBRATION_SAMPLES = 4096
VALID_BITS = [2, 3, 4, 8]
VALID_GROUP_SIZES = [32, 64, 128]


def check_dependencies() -> bool:
    """Check if required dependencies are installed."""
    missing = []

    try:
        import torch
        if not torch.cuda.is_available():
            print("ERROR: CUDA is not available. Model quantization requires GPU support.")
            print(f"PyTorch version: {torch.__version__}")
            return False
        print(f"PyTorch: {torch.__version__}, CUDA devices: {torch.cuda.device_count()}")
    except ImportError:
        missing.append("torch")

    try:
        import gptqmodel
        print(f"GPTQModel: {gptqmodel.__version__ if hasattr(gptqmodel, '__version__') else 'installed'}")
    except ImportError:
        missing.append("gptqmodel")

    try:
        import datasets
        print(f"Datasets: {datasets.__version__}")
    except ImportError:
        missing.append("datasets")

    if missing:
        print(f"ERROR: Missing required packages: {', '.join(missing)}")
        print("Install with:")
        print(f"  pip install {' '.join(missing)}")
        return False

    return True


@dataclass
class QuantConfig:
    """Quantization configuration."""

    model_name: str
    output_dir: str
    bits: int = 4
    group_size: int = 128
    damp_percent: float = 0.1
    desc_act: bool = True
    calibration_samples: int = 512
    calibration_batch_size: int = 4
    device: str = "cuda:0"

    def __post_init__(self) -> None:
        """Validate configuration after initialization."""
        if self.bits not in VALID_BITS:
            raise ValueError(f"Invalid bits={self.bits}. Must be one of: {VALID_BITS}")

        if self.group_size not in VALID_GROUP_SIZES:
            raise ValueError(f"Invalid group_size={self.group_size}. Must be one of: {VALID_GROUP_SIZES}")

        if not MIN_CALIBRATION_SAMPLES <= self.calibration_samples <= MAX_CALIBRATION_SAMPLES:
            raise ValueError(
                f"calibration_samples={self.calibration_samples} out of range. "
                f"Must be {MIN_CALIBRATION_SAMPLES}-{MAX_CALIBRATION_SAMPLES}"
            )

        if not 0.0 < self.damp_percent <= 1.0:
            raise ValueError(f"damp_percent={self.damp_percent} must be between 0 and 1")

        if self.calibration_batch_size < 1:
            raise ValueError(f"calibration_batch_size must be >= 1, got {self.calibration_batch_size}")


def get_calibration_data(num_samples: int = 512) -> list[str]:
    """Load calibration data from C4 dataset."""
    try:
        from datasets import load_dataset
    except ImportError:
        print("ERROR: 'datasets' package not installed. Run: pip install datasets")
        sys.exit(1)

    # Validate num_samples
    if not MIN_CALIBRATION_SAMPLES <= num_samples <= MAX_CALIBRATION_SAMPLES:
        print(f"WARNING: num_samples={num_samples} adjusted to valid range")
        num_samples = max(MIN_CALIBRATION_SAMPLES, min(num_samples, MAX_CALIBRATION_SAMPLES))

    print(f"Loading {num_samples} calibration samples from C4...")

    try:
        dataset = load_dataset(
            "allenai/c4",
            data_files="en/c4-train.00001-of-01024.json.gz",
            split="train",
        )
    except Exception as e:
        print(f"ERROR: Failed to load C4 dataset: {e}")
        print("Check your internet connection and HuggingFace access.")
        raise RuntimeError(f"Dataset loading failed: {e}") from e

    # Select and filter samples
    calibration_data = []
    for item in dataset:
        text = item["text"]
        # Filter reasonable length samples
        if 100 < len(text) < 5000:
            calibration_data.append(text)
        if len(calibration_data) >= num_samples:
            break

    if len(calibration_data) < num_samples:
        print(f"WARNING: Only loaded {len(calibration_data)} samples (requested {num_samples})")

    if len(calibration_data) < MIN_CALIBRATION_SAMPLES:
        raise RuntimeError(
            f"Insufficient calibration data: {len(calibration_data)} samples "
            f"(minimum {MIN_CALIBRATION_SAMPLES} required)"
        )

    print(f"Loaded {len(calibration_data)} calibration samples")
    return calibration_data


def get_domain_calibration_data(domain: str, num_samples: int = 512) -> list[str]:
    """Load domain-specific calibration data."""
    from datasets import load_dataset

    domain_datasets = {
        "code": ("codeparrot/github-code", "python"),
        "medical": ("medalpaca/medical_meadow_wikidoc", None),
        "legal": ("pile-of-law/pile-of-law", "court_opinions"),
        "finance": ("gbharti/finance-alpaca", None),
    }

    if domain not in domain_datasets:
        print(f"Unknown domain '{domain}', using C4")
        return get_calibration_data(num_samples)

    dataset_name, subset = domain_datasets[domain]
    print(f"Loading {domain} calibration data from {dataset_name}...")

    try:
        if subset:
            dataset = load_dataset(dataset_name, subset, split="train")
        else:
            dataset = load_dataset(dataset_name, split="train")

        # Extract text field (varies by dataset)
        text_field = "code" if domain == "code" else "text"
        if text_field not in dataset.features:
            text_field = list(dataset.features.keys())[0]

        calibration_data = [
            item[text_field]
            for item in dataset.select(range(min(num_samples * 2, len(dataset))))
            if 100 < len(item[text_field]) < 5000
        ][:num_samples]

        return calibration_data

    except Exception as e:
        print(f"Failed to load {domain} data: {e}")
        print("Falling back to C4")
        return get_calibration_data(num_samples)


def quantize_model(config: QuantConfig, calibration_data: list[str]) -> str:
    """Quantize model with GPTQ.

    Args:
        config: Quantization configuration
        calibration_data: List of calibration text samples

    Returns:
        Path to the saved quantized model

    Raises:
        RuntimeError: If quantization fails
        ImportError: If gptqmodel is not installed
    """
    try:
        from gptqmodel import GPTQModel, QuantizeConfig
    except ImportError:
        print("ERROR: 'gptqmodel' package not installed.")
        print("Install with: pip install gptqmodel")
        sys.exit(1)

    # Validate calibration data
    if not calibration_data:
        raise ValueError("calibration_data cannot be empty")
    if len(calibration_data) < MIN_CALIBRATION_SAMPLES:
        raise ValueError(
            f"Insufficient calibration samples: {len(calibration_data)} "
            f"(minimum {MIN_CALIBRATION_SAMPLES} required)"
        )

    print(f"\nQuantizing {config.model_name}")
    print(f"  Bits: {config.bits}")
    print(f"  Group size: {config.group_size}")
    print(f"  Output: {config.output_dir}")
    print(f"  Calibration samples: {len(calibration_data)}")

    # Configure quantization
    quant_config = QuantizeConfig(
        bits=config.bits,
        group_size=config.group_size,
        damp_percent=config.damp_percent,
        desc_act=config.desc_act,
    )

    # Load model
    print("\nLoading model...")
    try:
        model = GPTQModel.load(
            config.model_name,
            quant_config,
            device=config.device,
        )
    except Exception as e:
        print(f"ERROR: Failed to load model '{config.model_name}': {e}")
        print("Common issues:")
        print("  - Model not found: Check if model ID is correct on HuggingFace")
        print("  - Access denied: Set HF_TOKEN for gated models")
        print("  - Out of memory: Try a smaller model or reduce batch size")
        raise RuntimeError(f"Model loading failed: {e}") from e

    # Quantize
    print("\nQuantizing (this may take a while)...")
    try:
        model.quantize(
            calibration_data,
            batch_size=config.calibration_batch_size,
        )
    except Exception as e:
        print(f"ERROR: Quantization failed: {e}")
        print("Common issues:")
        print("  - Out of memory: Reduce calibration_batch_size")
        print("  - CUDA error: Check GPU drivers and available memory")
        raise RuntimeError(f"Quantization failed: {e}") from e

    # Save
    print(f"\nSaving to {config.output_dir}...")
    try:
        Path(config.output_dir).mkdir(parents=True, exist_ok=True)
        model.save(config.output_dir)
    except PermissionError:
        print(f"ERROR: Permission denied writing to '{config.output_dir}'")
        raise
    except OSError as e:
        print(f"ERROR: Failed to save model: {e}")
        raise RuntimeError(f"Model save failed: {e}") from e

    print("\nQuantization complete!")
    return config.output_dir


def validate_quantized_model(model_path: str, test_prompts: list[str] | None = None) -> bool:
    """Validate quantized model works correctly.

    Args:
        model_path: Path to quantized model
        test_prompts: Optional list of prompts to test

    Returns:
        True if validation passed, False otherwise
    """
    try:
        from vllm import LLM, SamplingParams
    except ImportError:
        print("ERROR: 'vllm' package not installed for validation.")
        print("Install with: pip install vllm")
        return False

    print(f"\nValidating {model_path}...")

    if not Path(model_path).exists():
        print(f"ERROR: Model path does not exist: {model_path}")
        return False

    if test_prompts is None:
        test_prompts = [
            "What is machine learning?",
            "Write a Python function to sort a list:",
            "Explain quantum computing briefly:",
        ]

    try:
        # Load quantized model
        llm = LLM(
            model=model_path,
            quantization="gptq",
            dtype="half",
            gpu_memory_utilization=0.9,
        )

        # Generate outputs
        sampling_params = SamplingParams(max_tokens=100, temperature=0.7)
        outputs = llm.generate(test_prompts, sampling_params)

        print("\nValidation outputs:")
        for prompt, output in zip(test_prompts, outputs):
            print(f"\nPrompt: {prompt}")
            print(f"Output: {output.outputs[0].text[:200]}...")

        print("\nValidation passed!")
        return True

    except Exception as e:
        print(f"ERROR: Validation failed: {e}")
        return False


def compare_models(
    original_model: str,
    quantized_model: str,
    test_prompts: list[str] | None = None,
) -> bool:
    """Compare original and quantized model outputs.

    Args:
        original_model: Path or ID of original model
        quantized_model: Path to quantized model
        test_prompts: Optional prompts for comparison

    Returns:
        True if comparison completed, False on error
    """
    try:
        from vllm import LLM, SamplingParams
    except ImportError:
        print("ERROR: 'vllm' package not installed for comparison.")
        print("Install with: pip install vllm")
        return False

    if test_prompts is None:
        test_prompts = [
            "Explain the theory of relativity:",
            "What are the benefits of exercise?",
        ]

    sampling_params = SamplingParams(max_tokens=100, temperature=0.0)

    try:
        print("Loading original model...")
        llm_original = LLM(model=original_model, dtype="half")
        outputs_original = llm_original.generate(test_prompts, sampling_params)
        del llm_original

        print("Loading quantized model...")
        llm_quantized = LLM(model=quantized_model, quantization="gptq", dtype="half")
        outputs_quantized = llm_quantized.generate(test_prompts, sampling_params)

        print("\nComparison:")
        for i, prompt in enumerate(test_prompts):
            print(f"\n--- Prompt: {prompt} ---")
            print(f"Original: {outputs_original[i].outputs[0].text[:150]}...")
            print(f"Quantized: {outputs_quantized[i].outputs[0].text[:150]}...")

        return True

    except Exception as e:
        print(f"ERROR: Comparison failed: {e}")
        return False


def main() -> int:
    """Main entry point.

    Returns:
        Exit code (0 = success, 1 = error)
    """
    parser = argparse.ArgumentParser(
        description="Model Quantization with GPTQ",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic quantization (4-bit)
  python quantization-config.py --model meta-llama/Llama-3.2-1B-Instruct

  # 8-bit quantization with validation
  python quantization-config.py --model facebook/opt-1.3b --bits 8 --validate

  # Domain-specific calibration for code models
  python quantization-config.py --model codellama/CodeLlama-7b-hf --domain code
        """,
    )
    parser.add_argument(
        "--model",
        required=True,
        help="HuggingFace model ID or path",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output directory (default: {model}-gptq-{bits}bit)",
    )
    parser.add_argument(
        "--bits",
        type=int,
        default=4,
        choices=[2, 3, 4, 8],
        help="Quantization bits (default: 4)",
    )
    parser.add_argument(
        "--group-size",
        type=int,
        default=128,
        choices=[32, 64, 128],
        help="Group size (default: 128)",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=512,
        help=f"Number of calibration samples ({MIN_CALIBRATION_SAMPLES}-{MAX_CALIBRATION_SAMPLES}, default: 512)",
    )
    parser.add_argument(
        "--domain",
        default=None,
        choices=["code", "medical", "legal", "finance"],
        help="Domain-specific calibration data",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate quantized model after creation",
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Compare original and quantized outputs",
    )
    parser.add_argument(
        "--check-deps",
        action="store_true",
        help="Check dependencies and exit",
    )

    args = parser.parse_args()

    # Check dependencies first
    print("Checking dependencies...")
    if not check_dependencies():
        return 1

    if args.check_deps:
        print("\nAll dependencies satisfied!")
        return 0

    # Build output path
    if args.output is None:
        model_name = args.model.split("/")[-1]
        args.output = f"{model_name}-gptq-{args.bits}bit"

    # Create config with validation
    try:
        config = QuantConfig(
            model_name=args.model,
            output_dir=args.output,
            bits=args.bits,
            group_size=args.group_size,
            calibration_samples=args.samples,
        )
    except ValueError as e:
        print(f"ERROR: Invalid configuration: {e}")
        return 1

    # Get calibration data
    try:
        if args.domain:
            calibration_data = get_domain_calibration_data(args.domain, args.samples)
        else:
            calibration_data = get_calibration_data(args.samples)
    except RuntimeError as e:
        print(f"ERROR: Failed to load calibration data: {e}")
        return 1

    # Quantize
    try:
        output_path = quantize_model(config, calibration_data)
    except (RuntimeError, ValueError) as e:
        print(f"ERROR: Quantization failed: {e}")
        return 1

    # Optional validation
    if args.validate:
        if not validate_quantized_model(output_path):
            print("WARNING: Model validation failed, but quantization completed")

    # Optional comparison
    if args.compare:
        if not compare_models(args.model, output_path):
            print("WARNING: Model comparison failed")

    print(f"\nQuantized model saved to: {output_path}")
    print("\nUsage with vLLM:")
    print(f'  llm = LLM(model="{output_path}", quantization="gptq")')

    return 0


if __name__ == "__main__":
    sys.exit(main())
