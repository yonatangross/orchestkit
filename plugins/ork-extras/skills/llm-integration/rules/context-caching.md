---
title: Apply context caching and budget allocation to reduce token costs by 60-80 percent
impact: HIGH
impactDescription: "Proper caching and budget allocation reduces token costs by 60-80% while maintaining task quality"
tags: context, caching, budget, compression, skill-scaling
---

## Context Caching and Budget Scaling

**Incorrect -- pre-loading all context:**
```python
# Loading entire knowledge base into every request
context = load_all_documents() + load_all_examples()
response = llm.chat(system=context, messages=[user_msg])
# Wastes tokens, hits limits, degrades quality
```

**Correct -- just-in-time loading with budget management:**
```python
# Just-in-time document loading with token budget
async def build_context(query: str, budget: int) -> list[dict]:
    # Retrieve only relevant documents
    relevant_docs = await retriever.search(query, top_k=5)

    # Truncate each doc to fit budget
    doc_budget = int(budget * 0.25)  # 25% for retrieval
    truncated = [truncate_to_tokens(doc, doc_budget // len(relevant_docs))
                 for doc in relevant_docs]

    return truncated
```

**Correct -- compression strategy selection:**

| Strategy | Compression | Interpretable | Best For |
|----------|-------------|---------------|----------|
| Anchored Iterative | 60-80% | Yes | Long sessions (recommended) |
| Sliding Window | 50-70% | Yes | Real-time chat |
| Regenerative Full | 70-85% | Partial | Simple tasks |
| Opaque | 95-99% | No | Storage-critical only |

**Correct -- probe-based evaluation of compression:**
```python
# Validate compression quality with functional probes
PROBES = [
    "What is the session intent?",
    "What files were modified?",
    "What decisions were made and why?",
]

async def evaluate_compression(summary: str) -> float:
    passed = 0
    for probe in PROBES:
        response = await llm.answer(f"Based on this summary:\n{summary}\n\n{probe}")
        if response_is_valid(response):
            passed += 1
    return passed / len(PROBES)  # Target: >90% pass rate
```

Key principles:
- CC 2.1.32+ auto-scales skill budget to 2% of context window
- Use just-in-time loading, not pre-loading entire knowledge bases
- Compress at 70% utilization, target 50% after compression
- Test compression with probes (>90% pass rate), not ROUGE/BLEU similarity metrics
