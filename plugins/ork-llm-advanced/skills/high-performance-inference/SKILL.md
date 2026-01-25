---
name: high-performance-inference
description: High-performance LLM inference with vLLM, quantization (AWQ, GPTQ, FP8), speculative decoding, and edge deployment. Use when optimizing inference latency, throughput, or memory.
version: 1.0.0
tags: [vllm, quantization, inference, performance, edge, speculative, 2026]
context: fork
agent: llm-integrator
author: OrchestKit
user-invocable: false
---

# High-Performance Inference

Optimize LLM inference for production with vLLM 0.14.x, quantization, and speculative decoding.

> **vLLM 0.14.0** (Jan 2026): PyTorch 2.9.0, CUDA 12.9, AttentionConfig API, Python 3.12+ recommended.

## Overview

- Deploying LLMs with low latency requirements
- Reducing GPU memory for larger models
- Maximizing throughput for batch inference
- Edge/mobile deployment with constrained resources
- Cost optimization through efficient hardware utilization

## Quick Reference

```bash
# Basic vLLM server
vllm serve meta-llama/Meta-Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 8192

# With quantization + speculative decoding
vllm serve meta-llama/Meta-Llama-3.1-70B-Instruct \
    --quantization awq \
    --speculative-config '{"method": "ngram", "num_speculative_tokens": 5}' \
    --tensor-parallel-size 4 \
    --gpu-memory-utilization 0.9
```

## vLLM 0.14.x Key Features

| Feature | Benefit |
|---------|---------|
| **PagedAttention** | Up to 24x throughput via efficient KV cache |
| **Continuous Batching** | Dynamic request batching for max utilization |
| **CUDA Graphs** | Fast model execution with graph capture |
| **Tensor Parallelism** | Scale across multiple GPUs |
| **Prefix Caching** | Reuse KV cache for shared prefixes |
| **AttentionConfig** | New API replacing VLLM_ATTENTION_BACKEND env |
| **Semantic Router** | vLLM SR v0.1 "Iris" for intelligent LLM routing |

## Python vLLM Integration

```python
from vllm import LLM, SamplingParams

# Initialize with optimization flags
llm = LLM(
    model="meta-llama/Meta-Llama-3.1-8B-Instruct",
    quantization="awq",
    tensor_parallel_size=2,
    gpu_memory_utilization=0.9,
    enable_prefix_caching=True,
)

# Sampling parameters
sampling_params = SamplingParams(
    temperature=0.7,
    top_p=0.9,
    max_tokens=1024,
)

# Generate
outputs = llm.generate(prompts, sampling_params)
for output in outputs:
    print(output.outputs[0].text)
```

## Quantization Methods

| Method | Bits | Memory Savings | Speed | Quality |
|--------|------|----------------|-------|---------|
| FP16 | 16 | Baseline | Baseline | Best |
| INT8 | 8 | 50% | +10-20% | Very Good |
| AWQ | 4 | 75% | +20-40% | Good |
| GPTQ | 4 | 75% | +15-30% | Good |
| FP8 | 8 | 50% | +30-50% | Very Good |

**When to Use Each:**
- **FP16**: Maximum quality, sufficient memory
- **INT8/FP8**: Balance of quality and efficiency
- **AWQ**: Best 4-bit quality, activation-aware
- **GPTQ**: Faster quantization, good quality

## Speculative Decoding

Accelerate generation by predicting multiple tokens:

```python
# N-gram based (no extra model)
speculative_config = {
    "method": "ngram",
    "num_speculative_tokens": 5,
    "prompt_lookup_max": 5,
    "prompt_lookup_min": 2,
}

# Draft model (higher quality)
speculative_config = {
    "method": "draft_model",
    "draft_model": "meta-llama/Llama-3.2-1B-Instruct",
    "num_speculative_tokens": 3,
}
```

**Expected Gains**: 1.5-2.5x throughput for autoregressive tasks.

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| **Quantization** | AWQ for 4-bit, FP8 for H100/H200 |
| **Batch size** | Dynamic via continuous batching |
| **GPU memory** | 0.85-0.95 utilization |
| **Parallelism** | Tensor parallel across GPUs |
| **KV cache** | Enable prefix caching for shared contexts |

## Common Mistakes

- Using GPTQ without calibration data (poor quality)
- Over-allocating GPU memory (OOM on peak loads)
- Ignoring warmup requests (cold start latency)
- Not benchmarking actual workload patterns
- Mixing quantization with incompatible features

## Performance Benchmarking

```python
from vllm import LLM, SamplingParams
import time

def benchmark_throughput(llm, prompts, sampling_params, num_runs=3):
    """Benchmark tokens per second."""
    total_tokens = 0
    total_time = 0

    for _ in range(num_runs):
        start = time.perf_counter()
        outputs = llm.generate(prompts, sampling_params)
        elapsed = time.perf_counter() - start

        tokens = sum(len(o.outputs[0].token_ids) for o in outputs)
        total_tokens += tokens
        total_time += elapsed

    return total_tokens / total_time  # tokens/sec
```

## Advanced Patterns

See `references/` for:
- **vLLM Deployment**: PagedAttention, batching, production config
- **Quantization Guide**: AWQ, GPTQ, INT8, FP8 comparison
- **Speculative Decoding**: Draft models, n-gram, throughput tuning
- **Edge Deployment**: Mobile, resource-constrained optimization

## Related Skills

- `llm-streaming` - Streaming token responses
- `function-calling` - Tool use with inference
- `ollama-local` - Local inference with Ollama
- `prompt-caching` - Reduce redundant computation
- `semantic-caching` - Cache full responses

## Capability Details

### vllm-deployment
**Keywords:** vllm, inference server, deploy, serve, production
**Solves:**
- Deploy LLMs with vLLM for production
- Configure tensor parallelism and batching
- Optimize GPU memory utilization

### quantization
**Keywords:** quantize, AWQ, GPTQ, INT8, FP8, compress, reduce memory
**Solves:**
- Reduce model memory footprint
- Choose appropriate quantization method
- Maintain quality with lower precision

### speculative-decoding
**Keywords:** speculative, draft model, faster generation, predict tokens
**Solves:**
- Accelerate autoregressive generation
- Configure draft models or n-gram speculation
- Tune speculative token count

### edge-inference
**Keywords:** edge, mobile, embedded, constrained, optimization
**Solves:**
- Deploy on resource-constrained devices
- Optimize for mobile/edge hardware
- Balance quality and resource usage

### throughput-optimization
**Keywords:** throughput, latency, performance, benchmark, optimize
**Solves:**
- Maximize requests per second
- Reduce time to first token
- Benchmark and tune performance
