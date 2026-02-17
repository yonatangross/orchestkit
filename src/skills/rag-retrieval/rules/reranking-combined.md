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

**Incorrect — single scoring signal without timeout:**
```python
async def rerank(query: str, documents: list[dict], top_k: int = 10) -> list[dict]:
    # Only uses LLM score, no timeout, no fallback
    llm_scores = await llm_rerank(query, documents, llm)  # May hang!
    return sorted(documents, key=lambda x: llm_scores.get(x["id"], 0), reverse=True)[:top_k]
```

**Correct — combined scoring with timeout fallback:**
```python
async def rerank(query: str, documents: list[dict], top_k: int = 10) -> list[dict]:
    if len(documents) <= top_k:
        return documents  # Skip if no benefit

    try:
        async with asyncio.timeout(5.0):  # 5s timeout
            llm_scores = await llm_rerank(query, documents, llm)

            # Combined scoring: 30% base + 50% LLM + 20% recency
            scored = []
            for doc in documents:
                base = doc.get("score", 0.5)
                llm = llm_scores.get(doc["id"], 0.5)
                recency = calculate_recency_score(doc.get("created_at"))
                final = 0.3 * base + 0.5 * llm + 0.2 * recency
                scored.append({**doc, "score": final})

            return sorted(scored, key=lambda x: x["score"], reverse=True)[:top_k]
    except TimeoutError:
        # Fallback to base ranking
        return sorted(documents, key=lambda x: x.get("score", 0), reverse=True)[:top_k]
```

**Key rules:**
- Default weights: 30% base retrieval + 50% LLM score + 20% recency
- Always set timeout (5s) with fallback to base ranking
- Skip reranking if document count <= top_k (no benefit)
- Cache scores: same query+doc pair = same score
- Store score components for debugging and tuning
