---
title: Speculative Decoding
impact: MEDIUM
impactDescription: "Speculative decoding generates 2-3 draft tokens in parallel and verifies them in a single forward pass, reducing latency by 30-60%"
tags: speculative, draft-model, ngram, acceptance-rate, latency, llm, decoding
---

# Speculative Decoding

Use speculative decoding to reduce per-token latency without sacrificing output quality.

## How It Works

```
Traditional:     token1 → token2 → token3 → token4  (4 forward passes)

Speculative:     draft: token1, token2, token3       (fast, cheap)
                 verify: accept/reject all 3          (1 forward pass)
                 Result: 3 tokens in ~1.3 forward passes
```

## N-Gram Speculation (No Draft Model)

```bash
# vLLM n-gram speculation — uses prompt tokens as draft source
# Best for repetitive/structured output (JSON, code, templates)
docker run --gpus '"device=0"' \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-8B-Instruct \
  --speculative-model [ngram] \
  --num-speculative-tokens 5 \
  --ngram-prompt-lookup-max 4
```

## Draft Model Speculation

```bash
# Use a smaller model as the draft (must share tokenizer)
docker run --gpus '"device=0"' \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-70B-Instruct \
  --speculative-model meta-llama/Llama-3.1-8B-Instruct \
  --num-speculative-tokens 5 \
  --tensor-parallel-size 4
```

## Acceptance Rate Tuning

```
--num-speculative-tokens:
  3  → Conservative, high acceptance rate (~85%)
  5  → Balanced (default recommendation)
  8  → Aggressive, lower acceptance rate (~60%)

Monitor via vLLM metrics:
  vllm:spec_decode_acceptance_rate  → target > 70%

If acceptance < 60%:
  1. Reduce --num-speculative-tokens
  2. Try n-gram for structured output
  3. Verify draft model matches target model's style
```

## When to Use Each Approach

```
N-gram speculation:
  + Structured output (JSON, SQL, code)
  + Repetitive patterns
  + No extra GPU memory needed
  - Creative / diverse text

Draft model speculation:
  + General text generation
  + Large target models (70B+)
  + Higher acceptance rates on diverse tasks
  - Requires extra GPU memory for draft model
```

**Incorrect — No speculation means sequential token generation:**
```bash
docker run --gpus '"device=0"' \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-8B-Instruct
# 4 tokens = 4 forward passes
```

**Correct — N-gram speculation reduces passes by 30-60%:**
```bash
docker run --gpus '"device=0"' \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-8B-Instruct \
  --speculative-model [ngram] \
  --num-speculative-tokens 5
# 4 tokens ≈ 1.3 forward passes
```

**Key rules:**
- **Use** n-gram speculation for structured/repetitive output (free, no extra VRAM)
- **Use** draft model speculation for general text with large target models
- **Start** with `--num-speculative-tokens 5` and tune based on acceptance rate
- **Monitor** acceptance rate; reduce tokens if below 60%
- **Output quality** is identical to non-speculative decoding (mathematically guaranteed)
