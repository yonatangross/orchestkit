---
title: Combined Scoring & Reranking Service
impact: MEDIUM
impactDescription: "Single scoring signal is unreliable — combining base, LLM, and recency scores provides robust ranking"
tags: reranking, combined, scoring, service, timeout
---

## Combined Scoring & Reranking Service

Combine multiple scoring signals with weighted average and timeout fallback.

**Combined Scoring:**
```python
def combined_rerank(
    documents: list[dict], llm_scores: dict[str, float],
    alpha: float = 0.3, beta: float = 0.5, gamma: float = 0.2
) -> list[dict]:
    scored = []
    for doc in documents:
        base = doc.get("score", 0.5)
        llm = llm_scores.get(doc["id"], 0.5)
        recency = calculate_recency_score(doc.get("created_at"))
        final = (alpha * base) + (beta * llm) + (gamma * recency)
        scored.append({**doc, "score": final,
                       "score_components": {"base": base, "llm": llm, "recency": recency}})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored
```

**Service with Timeout Fallback:**
```python
class ReRankingService:
    def __init__(self, llm: AsyncOpenAI, timeout_seconds: float = 5.0):
        self.llm = llm
        self.timeout = timeout_seconds

    async def rerank(self, query: str, documents: list[dict], top_k: int = 10) -> list[dict]:
        if len(documents) <= top_k:
            return documents
        try:
            async with asyncio.timeout(self.timeout):
                return await llm_rerank(query, documents, self.llm, top_k)
        except TimeoutError:
            return sorted(documents, key=lambda x: x.get("score", 0), reverse=True)[:top_k]
```

**Key rules:**
- Default weights: 30% base retrieval + 50% LLM score + 20% recency
- Always set timeout (5s) with fallback to base ranking
- Skip reranking if document count <= top_k (no benefit)
- Cache scores: same query+doc pair = same score
- Store score components for debugging and tuning
