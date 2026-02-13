# Quantization Guide

## Overview

Quantization reduces model precision to decrease memory usage and increase throughput.

| Method | Bits | Calibration | Memory Savings | Throughput | Quality Loss |
|--------|------|-------------|----------------|------------|--------------|
| FP16 | 16 | None | Baseline | Baseline | None |
| FP8 | 8 | None | 50% | +30-50% | Minimal |
| INT8 | 8 | Optional | 50% | +10-20% | Minimal |
| AWQ | 4 | Required | 75% | +20-40% | Small |
| GPTQ | 4 | Required | 75% | +15-30% | Small |

---

## AWQ (Activation-aware Weight Quantization)

Best 4-bit method for quality preservation:

```bash
# Use pre-quantized AWQ model
vllm serve TheBloke/Llama-2-70B-chat-AWQ \
    --quantization awq \
    --tensor-parallel-size 2
```

```python
from vllm import LLM

# AWQ quantized model
llm = LLM(
    model="TheBloke/Llama-2-70B-chat-AWQ",
    quantization="awq",
    dtype="half",
    tensor_parallel_size=2,
)
```

**AWQ Benefits**:
- Activation-aware: Preserves important weights
- Better quality than GPTQ at same bit-width
- Faster inference on modern GPUs

---

## GPTQ Quantization

Create your own GPTQ quantized model:

```python
from gptqmodel import GPTQModel, QuantizeConfig
from datasets import load_dataset

# Load calibration data
calibration_data = load_dataset(
    "allenai/c4",
    data_files="en/c4-train.00001-of-01024.json.gz",
    split="train",
).select(range(1024))["text"]

# Configure quantization
quant_config = QuantizeConfig(
    bits=4,              # 4-bit quantization
    group_size=128,      # Group size for quantization
    damp_percent=0.1,    # Dampening for Hessian
    desc_act=True,       # Activation order (better quality)
)

# Load and quantize
model = GPTQModel.load(
    "meta-llama/Llama-3.2-1B-Instruct",
    quant_config,
)
model.quantize(calibration_data, batch_size=4)

# Save quantized model
model.save("Llama-3.2-1B-Instruct-gptq-4bit")
```

**Using GPTQ with vLLM**:

```python
from vllm import LLM

llm = LLM(
    model="TheBloke/Llama-2-70B-GPTQ",
    quantization="gptq",
    dtype="half",
)
```

---

## FP8 Quantization

Best for H100/H200 GPUs with native FP8 support:

```python
from vllm import LLM

# FP8 on H100
llm = LLM(
    model="meta-llama/Meta-Llama-3.1-70B-Instruct",
    quantization="fp8",  # Native FP8
    kv_cache_dtype="fp8",  # FP8 KV cache
)
```

**FP8 Advantages**:
- Near-FP16 quality
- 50% memory reduction
- Best throughput on H100/H200
- No calibration needed

---

## INT8 Quantization

Balanced option with minimal quality loss:

```python
# INT8 weight quantization
llm = LLM(
    model="meta-llama/Meta-Llama-3.1-70B-Instruct",
    quantization="int8",
    dtype="float16",
)
```

---

## Quantization Comparison

### Memory Usage (70B Model)

| Precision | Memory (per GPU) | GPUs Needed |
|-----------|------------------|-------------|
| FP32 | ~280 GB | 8x A100 80GB |
| FP16 | ~140 GB | 4x A100 80GB |
| INT8/FP8 | ~70 GB | 2x A100 80GB |
| AWQ/GPTQ | ~35 GB | 1x A100 80GB |

### Quality Benchmarks (MMLU)

| Model | FP16 | INT8 | AWQ-4bit | GPTQ-4bit |
|-------|------|------|----------|-----------|
| Llama-3.1-8B | 66.2% | 65.8% | 65.1% | 64.8% |
| Llama-3.1-70B | 79.3% | 79.0% | 78.2% | 77.9% |

---

## Best Practices

### Calibration Data

Use representative data for your use case:

```python
# Domain-specific calibration
calibration_data = [
    # Include examples similar to production queries
    "Customer support query example...",
    "Technical documentation example...",
    "Code generation example...",
]

# Minimum 128 samples, recommended 512-1024
assert len(calibration_data) >= 128
```

### Group Size Selection

| Group Size | Memory | Quality | Speed |
|------------|--------|---------|-------|
| 32 | Lowest | Best | Slowest |
| 64 | Low | Very Good | Fast |
| 128 | Medium | Good | Fastest |

```python
# Higher group size = faster but lower quality
quant_config = QuantizeConfig(
    bits=4,
    group_size=128,  # Balance of speed and quality
)
```

### Mixed Precision

Keep critical layers at higher precision:

```python
# Some layers benefit from higher precision
quant_config = QuantizeConfig(
    bits=4,
    group_size=128,
    inside_layer_modules=[
        # Keep attention at higher precision
        "self_attn.q_proj",
        "self_attn.k_proj",
        "self_attn.v_proj",
    ],
)
```

---

## Troubleshooting

### OOM During Quantization

```python
# Reduce batch size
model.quantize(calibration_data, batch_size=1)

# Use gradient checkpointing
model.quantize(
    calibration_data,
    batch_size=2,
    use_checkpoint=True,
)
```

### Quality Degradation

1. Increase calibration data diversity
2. Reduce group size (32 or 64)
3. Try AWQ instead of GPTQ
4. Enable `desc_act=True` for GPTQ

---

## Related Skills

- `ollama-local` - Local inference with quantized models
- `embeddings` - Quantized embedding models
