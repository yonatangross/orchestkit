# Speculative Decoding

## Overview

Speculative decoding accelerates autoregressive generation by predicting multiple tokens at once, then verifying in parallel.

**How it works**:
1. Draft model (or n-gram) proposes N candidate tokens
2. Target model verifies all N tokens in one forward pass
3. Accept verified tokens, reject incorrect ones
4. Repeat from first rejected position

**Expected gains**: 1.5-2.5x throughput for compatible workloads.

---

## N-gram Speculation

No extra model needed - uses prompt patterns:

```bash
# vLLM CLI with n-gram speculation
vllm serve meta-llama/Meta-Llama-3.1-70B-Instruct \
    --speculative-config '{
        "method": "ngram",
        "num_speculative_tokens": 5,
        "prompt_lookup_max": 5,
        "prompt_lookup_min": 2
    }'
```

```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Meta-Llama-3.1-70B-Instruct",
    speculative_config={
        "method": "ngram",
        "num_speculative_tokens": 5,
        "prompt_lookup_max": 5,
        "prompt_lookup_min": 2,
    },
)

# Works best with repetitive/structured output
outputs = llm.generate(
    ["Generate a JSON object with user data:"],
    SamplingParams(max_tokens=500),
)
```

**Best for**:
- Structured output (JSON, code)
- Repetitive patterns
- Low additional memory

---

## Draft Model Speculation

Use a smaller model to draft tokens:

```bash
# Draft model speculation
vllm serve meta-llama/Meta-Llama-3.1-70B-Instruct \
    --speculative-config '{
        "method": "draft_model",
        "draft_model": "meta-llama/Llama-3.2-1B-Instruct",
        "num_speculative_tokens": 3
    }' \
    --tensor-parallel-size 4
```

```python
from vllm import LLM

llm = LLM(
    model="meta-llama/Meta-Llama-3.1-70B-Instruct",
    speculative_config={
        "method": "draft_model",
        "draft_model": "meta-llama/Llama-3.2-1B-Instruct",
        "num_speculative_tokens": 3,
    },
    tensor_parallel_size=4,
)
```

**Draft model selection**:
| Target Model | Recommended Draft | Size Ratio |
|--------------|-------------------|------------|
| 70B | 7B or 8B | ~10% |
| 70B | 1B-3B | ~2-5% |
| 8B | 1B | ~12% |
| 405B | 8B-70B | ~2-17% |

---

## Medusa-style Speculation

Multiple prediction heads for parallel token generation:

```python
# Medusa-style model (requires trained heads)
llm = LLM(
    model="lmsys/vicuna-7b-v1.5-16k-medusa",
    speculative_config={
        "method": "medusa",
        "num_heads": 4,  # Number of speculation heads
    },
)
```

**Advantages**:
- No separate draft model
- Lower memory than draft model
- Works well with fine-tuned models

---

## Performance Tuning

### Optimal Token Count

```python
# Benchmark different speculation depths
for num_tokens in [1, 3, 5, 7]:
    llm = LLM(
        model="meta-llama/Meta-Llama-3.1-70B-Instruct",
        speculative_config={
            "method": "ngram",
            "num_speculative_tokens": num_tokens,
        },
    )
    throughput = benchmark(llm)
    print(f"Tokens: {num_tokens}, Throughput: {throughput:.1f} tok/s")
```

**General guidelines**:
| Scenario | Recommended Tokens |
|----------|-------------------|
| Code generation | 5-7 |
| JSON output | 5-7 |
| Free-form text | 2-4 |
| Creative writing | 1-3 |

### Acceptance Rate Monitoring

```python
# vLLM logs acceptance rates
# Look for: "Speculative decoding acceptance rate: X%"

# High acceptance (>70%): Increase num_speculative_tokens
# Low acceptance (<40%): Decrease or disable speculation
```

---

## When NOT to Use

Speculative decoding may hurt performance when:

1. **High randomness** (temperature > 1.0)
2. **Short outputs** (overhead > benefit)
3. **Diverse outputs** (low acceptance rate)
4. **Memory constrained** (draft model overhead)

```python
# Disable speculation for creative tasks
sampling_params = SamplingParams(
    temperature=1.2,
    top_p=0.95,
    max_tokens=100,  # Short output
)
# Use standard decoding instead
```

---

## Benchmarking

```python
import time
from vllm import LLM, SamplingParams

def benchmark_speculation(model_path: str, prompts: list[str]):
    """Compare with and without speculative decoding."""

    # Without speculation
    llm_base = LLM(model=model_path)
    start = time.perf_counter()
    outputs_base = llm_base.generate(prompts, SamplingParams(max_tokens=512))
    time_base = time.perf_counter() - start

    # With speculation
    llm_spec = LLM(
        model=model_path,
        speculative_config={
            "method": "ngram",
            "num_speculative_tokens": 5,
        },
    )
    start = time.perf_counter()
    outputs_spec = llm_spec.generate(prompts, SamplingParams(max_tokens=512))
    time_spec = time.perf_counter() - start

    tokens_base = sum(len(o.outputs[0].token_ids) for o in outputs_base)
    tokens_spec = sum(len(o.outputs[0].token_ids) for o in outputs_spec)

    print(f"Baseline: {tokens_base/time_base:.1f} tok/s")
    print(f"Speculative: {tokens_spec/time_spec:.1f} tok/s")
    print(f"Speedup: {(time_base/time_spec):.2f}x")


# JSON/code prompts benefit most
prompts = [
    "Generate a Python function that implements binary search:",
    "Create a JSON schema for a user profile with validation:",
    "Write a SQL query to find top 10 customers by revenue:",
]
benchmark_speculation("meta-llama/Meta-Llama-3.1-8B-Instruct", prompts)
```

---

## Related Skills

- `llm-streaming` - Streaming with speculation
- `prompt-caching` - Combine with prefix caching
