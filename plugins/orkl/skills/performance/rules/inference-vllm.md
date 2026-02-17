---
title: vLLM Deployment
impact: MEDIUM
impactDescription: "vLLM delivers 2-4x higher throughput than naive inference through PagedAttention and continuous batching"
tags: vllm, paged-attention, batching, tensor-parallel, llm, inference, gpu, serving
---

# vLLM Deployment

Deploy LLMs with vLLM for high-throughput, low-latency inference.

## Docker Deployment

```bash
# Single GPU
docker run --gpus '"device=0"' \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-8B-Instruct \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90

# Multi-GPU with tensor parallelism
docker run --gpus all \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-70B-Instruct \
  --tensor-parallel-size 4 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.92
```

## Python Client

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="unused")

response = client.chat.completions.create(
    model="meta-llama/Llama-3.1-8B-Instruct",
    messages=[{"role": "user", "content": "Explain PagedAttention briefly."}],
    max_tokens=256,
    temperature=0.7,
)
print(response.choices[0].message.content)
```

## Key Architecture Concepts

```
PagedAttention:
  - KV cache stored in non-contiguous pages (like OS virtual memory)
  - Eliminates memory waste from pre-allocated contiguous blocks
  - Enables 2-4x more concurrent sequences

Continuous Batching:
  - New requests join running batch immediately
  - No waiting for longest sequence to finish
  - Throughput: 10-30 requests/second on single A100 (8B model)

Tensor Parallelism:
  - Splits model across GPUs (--tensor-parallel-size N)
  - Rule: N = number of GPUs, must evenly divide model layers
  - Use for models > single GPU VRAM
```

**Incorrect — Default memory utilization wastes KV cache space:**
```bash
docker run --gpus '"device=0"' \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-8B-Instruct
# Uses default 0.70 GPU memory
```

**Correct — Higher utilization enables more concurrent requests:**
```bash
docker run --gpus '"device=0"' \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-8B-Instruct \
  --gpu-memory-utilization 0.90 \
  --max-model-len 8192
# 2-4x more concurrent requests
```

**Key rules:**
- **Set** `--gpu-memory-utilization 0.90` (leave headroom for KV cache)
- **Use** `--tensor-parallel-size` equal to the number of GPUs
- **Use** the OpenAI-compatible API for drop-in compatibility
- **Monitor** `vllm:num_requests_running` Prometheus metric for load
- **Set** `--max-model-len` to the actual max you need (lower = more concurrent requests)
