---
title: Vision Model Selection
impact: MEDIUM
impactDescription: "Wrong model selection wastes cost on simple tasks or produces low-quality results on complex vision tasks"
tags: vision, models, comparison, cost, limits, provider
---

## Vision Model Selection

Choose the right vision provider based on accuracy, cost, and context needs.

**Model comparison:**

| Model | Context | Strengths | Max Images |
|-------|---------|-----------|------------|
| **GPT-5.2** | 128K | Best general reasoning | 10/request |
| **Claude Opus 4.6** | 1M | Best coding, sustained agent tasks | 100/request |
| **Gemini 2.5 Pro** | 1M+ | Longest context, native video | 3,600/request |
| **Gemini 3 Pro** | 1M | Deep Think, enhanced segmentation | 3,600/request |
| **Grok 4** | 2M | Real-time X integration | Limited |

**Token cost by detail level:**

| Provider | Detail Level | Token Cost | Use For |
|----------|-------------|------------|---------|
| OpenAI | `low` | 65 tokens | Classification (yes/no) |
| OpenAI | `high` | 129+ tokens/tile | OCR, charts, detailed analysis |
| Gemini | base | 258 tokens | Scales with resolution |
| Claude | per-image | Fixed | Batch for efficiency |

**Incorrect — using expensive model for simple classification:**
```python
# Wastes tokens: high detail + large model for yes/no
response = client.chat.completions.create(
    model="gpt-5.2",
    messages=[{"role": "user", "content": [
        {"type": "text", "text": "Is there a person? Reply: yes/no"},
        {"type": "image_url", "image_url": {"url": img_url, "detail": "high"}}
    ]}]
)
```

**Correct — cost-optimized for simple tasks:**
```python
response = client.chat.completions.create(
    model="gpt-5.2-mini",  # Cheaper model
    messages=[{"role": "user", "content": [
        {"type": "text", "text": "Is there a person? Reply: yes/no"},
        {"type": "image_url", "image_url": {"url": img_url, "detail": "low"}}  # 65 tokens
    ]}]
)
```

**Image size limits:**

| Provider | Max Size | Max Images | Notes |
|----------|----------|------------|-------|
| OpenAI | 20MB | 10/request | GPT-5 series |
| Claude | 8000x8000 px | 100/request | 2000px if >20 images |
| Gemini | 20MB | 3,600/request | Best for batch |
| Grok | 20MB | Limited | |

**Selection guide:**

| Scenario | Recommendation |
|----------|----------------|
| High accuracy | Claude Opus 4.6 or GPT-5 |
| Long documents | Gemini 2.5 Pro (1M context) |
| Cost efficiency | Gemini 2.5 Flash ($0.15/M tokens) |
| Real-time/X data | Grok 4 with DeepSearch |
| Video analysis | Gemini 2.5/3 Pro (native) |
| Batch images | Claude (100/req) or Gemini (3,600/req) |

**Key rules:**
- Cannot identify specific people (privacy restriction, all providers)
- May hallucinate on low-quality or rotated images (<200px)
- No real-time video except Gemini — use frame extraction for others
- Validate image format before encoding (corrupt files cause silent failures)
- Always check rate limits on vision endpoints — they are lower than text-only
