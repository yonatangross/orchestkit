"""
vLLM Production Server Template

Production-ready vLLM server with:
- Optimized configuration
- Health checks
- Metrics endpoint
- Graceful shutdown

Usage:
    python vllm-server.py

Environment Variables:
    MODEL_NAME: HuggingFace model ID (default: meta-llama/Meta-Llama-3.1-8B-Instruct)
    TENSOR_PARALLEL_SIZE: Number of GPUs (default: 1)
    MAX_MODEL_LEN: Maximum context length (default: 4096)
    GPU_MEMORY_UTILIZATION: GPU memory fraction (default: 0.9)
    QUANTIZATION: Quantization method (default: none)
    HOST: Server host (default: 0.0.0.0)
    PORT: Server port (default: 8000)
    API_KEY: API key for authentication (optional)
"""

import os
import signal
import sys
from dataclasses import dataclass


@dataclass
class ServerConfig:
    """Server configuration from environment."""

    model_name: str = os.getenv(
        "MODEL_NAME",
        "meta-llama/Meta-Llama-3.1-8B-Instruct",
    )
    tensor_parallel_size: int = int(os.getenv("TENSOR_PARALLEL_SIZE", "1"))
    max_model_len: int = int(os.getenv("MAX_MODEL_LEN", "4096"))
    gpu_memory_utilization: float = float(os.getenv("GPU_MEMORY_UTILIZATION", "0.9"))
    quantization: str | None = os.getenv("QUANTIZATION") or None
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    api_key: str | None = os.getenv("API_KEY")

    # Advanced options
    enable_prefix_caching: bool = os.getenv("ENABLE_PREFIX_CACHING", "true").lower() == "true"
    max_num_seqs: int = int(os.getenv("MAX_NUM_SEQS", "256"))
    enable_chunked_prefill: bool = os.getenv("ENABLE_CHUNKED_PREFILL", "true").lower() == "true"

    # Speculative decoding
    speculative_method: str | None = os.getenv("SPECULATIVE_METHOD")  # ngram, draft_model
    speculative_tokens: int = int(os.getenv("SPECULATIVE_TOKENS", "5"))
    draft_model: str | None = os.getenv("DRAFT_MODEL")


def build_speculative_config(config: ServerConfig) -> dict | None:
    """Build speculative decoding configuration."""
    if not config.speculative_method:
        return None

    if config.speculative_method == "ngram":
        return {
            "method": "ngram",
            "num_speculative_tokens": config.speculative_tokens,
            "prompt_lookup_max": 5,
            "prompt_lookup_min": 2,
        }
    elif config.speculative_method == "draft_model":
        if not config.draft_model:
            raise ValueError("DRAFT_MODEL required for draft_model speculation")
        return {
            "method": "draft_model",
            "draft_model": config.draft_model,
            "num_speculative_tokens": config.speculative_tokens,
        }
    else:
        raise ValueError(f"Unknown speculative method: {config.speculative_method}")


def check_vllm_installed() -> bool:
    """Check if vLLM is installed and CUDA is available."""
    try:
        import vllm
        import torch
        if not torch.cuda.is_available():
            print("ERROR: CUDA is not available. vLLM requires GPU support.")
            return False
        print(f"vLLM version: {vllm.__version__}")
        print(f"CUDA devices: {torch.cuda.device_count()}")
        return True
    except ImportError as e:
        print(f"ERROR: vLLM is not installed. Install with: pip install vllm")
        print(f"Details: {e}")
        return False


def create_engine(config: ServerConfig):
    """Create vLLM engine with configuration."""
    if not check_vllm_installed():
        raise RuntimeError("vLLM is not properly installed or CUDA is unavailable")

    try:
        from vllm import LLM

        speculative_config = build_speculative_config(config)

        engine = LLM(
            model=config.model_name,
            tensor_parallel_size=config.tensor_parallel_size,
            max_model_len=config.max_model_len,
            gpu_memory_utilization=config.gpu_memory_utilization,
            quantization=config.quantization,
            enable_prefix_caching=config.enable_prefix_caching,
            max_num_seqs=config.max_num_seqs,
            enable_chunked_prefill=config.enable_chunked_prefill,
            speculative_config=speculative_config,
            trust_remote_code=True,
        )

        return engine

    except Exception as e:
        print(f"ERROR: Failed to create vLLM engine: {e}")
        print("Common issues:")
        print("  - Model not found: Check MODEL_NAME is a valid HuggingFace model ID")
        print("  - Out of memory: Reduce MAX_MODEL_LEN or GPU_MEMORY_UTILIZATION")
        print("  - CUDA error: Check GPU drivers and torch.cuda.is_available()")
        raise


def run_openai_server(config: ServerConfig):
    """Run OpenAI-compatible API server."""
    import subprocess

    cmd = [
        sys.executable, "-m", "vllm.entrypoints.openai.api_server",
        "--model", config.model_name,
        "--host", config.host,
        "--port", str(config.port),
        "--tensor-parallel-size", str(config.tensor_parallel_size),
        "--max-model-len", str(config.max_model_len),
        "--gpu-memory-utilization", str(config.gpu_memory_utilization),
        "--max-num-seqs", str(config.max_num_seqs),
    ]

    # Optional: quantization
    if config.quantization:
        cmd.extend(["--quantization", config.quantization])

    # Optional: prefix caching
    if config.enable_prefix_caching:
        cmd.append("--enable-prefix-caching")

    # Optional: chunked prefill
    if config.enable_chunked_prefill:
        cmd.append("--enable-chunked-prefill")

    # Optional: API key
    if config.api_key:
        cmd.extend(["--api-key", config.api_key])

    # Optional: speculative decoding
    if config.speculative_method:
        import json
        spec_config = build_speculative_config(config)
        cmd.extend(["--speculative-config", json.dumps(spec_config)])

    # Enable metrics
    cmd.append("--enable-metrics")

    print(f"Starting vLLM server: {' '.join(cmd)}")

    try:
        process = subprocess.Popen(cmd, stderr=subprocess.PIPE)
    except FileNotFoundError:
        print("ERROR: vLLM is not installed or not in PATH")
        print("Install with: pip install vllm")
        sys.exit(1)
    except PermissionError:
        print("ERROR: Permission denied to execute vLLM")
        sys.exit(1)

    # Graceful shutdown handler
    def shutdown(_signum, _frame):
        print("\nShutting down vLLM server...")
        process.terminate()
        try:
            process.wait(timeout=30)
        except subprocess.TimeoutExpired:
            print("Server didn't stop gracefully, force killing...")
            process.kill()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Monitor for startup errors
    return_code = process.wait()
    if return_code != 0:
        stderr = process.stderr.read().decode() if process.stderr else ""
        print(f"ERROR: vLLM server exited with code {return_code}")
        if stderr:
            print(f"Stderr: {stderr[:500]}")
        sys.exit(return_code)


def benchmark_engine(config: ServerConfig, num_prompts: int = 10):
    """Benchmark the engine configuration."""
    import time
    from vllm import SamplingParams

    print(f"Benchmarking with {num_prompts} prompts...")

    engine = create_engine(config)
    sampling_params = SamplingParams(max_tokens=256, temperature=0.7)

    # Test prompts
    prompts = [
        f"Write a short paragraph about topic {i}."
        for i in range(num_prompts)
    ]

    # Warmup
    engine.generate(["Warmup prompt"], SamplingParams(max_tokens=10))

    # Benchmark
    start = time.perf_counter()
    outputs = engine.generate(prompts, sampling_params)
    elapsed = time.perf_counter() - start

    total_tokens = sum(len(o.outputs[0].token_ids) for o in outputs)
    throughput = total_tokens / elapsed

    print(f"\nBenchmark Results:")
    print(f"  Prompts: {num_prompts}")
    print(f"  Total tokens: {total_tokens}")
    print(f"  Time: {elapsed:.2f}s")
    print(f"  Throughput: {throughput:.1f} tokens/s")
    print(f"  Avg latency: {elapsed/num_prompts*1000:.1f}ms per request")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="vLLM Production Server")
    parser.add_argument(
        "--mode",
        choices=["serve", "benchmark"],
        default="serve",
        help="Run mode: serve (default) or benchmark",
    )
    parser.add_argument(
        "--num-prompts",
        type=int,
        default=10,
        help="Number of prompts for benchmarking",
    )

    args = parser.parse_args()
    config = ServerConfig()

    print(f"Configuration:")
    print(f"  Model: {config.model_name}")
    print(f"  Tensor Parallel: {config.tensor_parallel_size}")
    print(f"  Max Context: {config.max_model_len}")
    print(f"  GPU Memory: {config.gpu_memory_utilization}")
    print(f"  Quantization: {config.quantization or 'none'}")
    print(f"  Speculative: {config.speculative_method or 'disabled'}")
    print()

    if args.mode == "serve":
        run_openai_server(config)
    elif args.mode == "benchmark":
        benchmark_engine(config, args.num_prompts)


if __name__ == "__main__":
    main()
