---
title: Model Quantization
impact: MEDIUM
impactDescription: "Quantization reduces model size 2-4x with minimal quality loss, enabling larger models on fewer GPUs"
tags: quantization, awq, gptq, fp8, int8, vram, precision, llm
---

# Model Quantization

Reduce model memory footprint and increase throughput with quantization.

## Method Decision Matrix

| Method | Precision | Speed | Quality | Best For |
|--------|-----------|-------|---------|----------|
| FP16 | 16-bit | Baseline | Best | When VRAM allows |
| FP8 | 8-bit | 1.5x | Near-FP16 | Hopper/Ada GPUs (H100, L40S) |
| AWQ | 4-bit | 1.8x | Good | Production serving, speed priority |
| GPTQ | 4-bit | 1.6x | Better | Quality-sensitive tasks |
| GGUF | 2-8 bit | Varies | Varies | CPU/hybrid inference (llama.cpp) |

## vLLM with AWQ

```bash
# Serve a pre-quantized AWQ model
docker run --gpus '"device=0"' \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model TheBloke/Llama-3.1-8B-Instruct-AWQ \
  --quantization awq \
  --max-model-len 8192
```

## vLLM with FP8 (Hopper GPUs)

```bash
# FP8 on H100 — native hardware support, no pre-quantized model needed
docker run --gpus all \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-70B-Instruct \
  --quantization fp8 \
  --tensor-parallel-size 4
```

## VRAM Requirements (Approximate)

```
Model       FP16    FP8     AWQ/GPTQ (4-bit)
7-8B        16 GB   9 GB    5 GB
13B         26 GB   14 GB   8 GB
70B         140 GB  75 GB   40 GB

Formula: VRAM ≈ params × bytes_per_param × 1.2 (KV cache overhead)
```

## Quality Validation

```python
# Always benchmark quantized vs full precision on YOUR task
def eval_quantized(client, test_cases):
    results = []
    for case in test_cases:
        response = client.chat.completions.create(
            model="quantized-model",
            messages=case["messages"],
            max_tokens=case["max_tokens"],
        )
        results.append(score(response, case["expected"]))
    return sum(results) / len(results)

# Accept quantization if quality >= 95% of FP16 baseline
```

**Incorrect — FP16 on smaller GPUs wastes VRAM:**
```bash
docker run --gpus all \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-70B-Instruct \
  --tensor-parallel-size 8
# Requires 140 GB VRAM
```

**Correct — FP8 quantization reduces VRAM by ~45%:**
```bash
docker run --gpus all \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-70B-Instruct \
  --quantization fp8 \
  --tensor-parallel-size 4
# Requires 75 GB VRAM
```

**Key rules:**
- **Use** FP8 on Hopper/Ada GPUs (best speed/quality tradeoff)
- **Use** AWQ for maximum throughput on older GPUs
- **Use** GPTQ when quality matters more than speed
- **Always** validate quantized model quality on your specific task
- **Pre-quantized** models (e.g., TheBloke) save quantization time
