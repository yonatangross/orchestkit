---
title: Use LLM reranking for domain-adaptive scoring without deploying a dedicated model
impact: MEDIUM
impactDescription: "LLM reranking scores all documents in a single call — slower but no model to deploy and adapts to any domain"
tags: reranking, llm, batch, scoring, cohere
---

## LLM Reranking

Score document relevance using LLM in a single batch call.

**LLM Batch Reranking:**
```python
async def llm_rerank(query: str, documents: list[dict], llm: AsyncOpenAI, top_k: int = 10) -> list[dict]:
    docs_text = "\n\n".join([f"[Doc {i+1}]\n{doc['content'][:300]}..." for i, doc in enumerate(documents)])

    response = await llm.chat.completions.create(
        model="gpt-5.2-mini",
        messages=[
            {"role": "system", "content": "Rate each document's relevance to the query (0.0-1.0).\nOutput one score per line."},
            {"role": "user", "content": f"Query: {query}\n\nDocuments:\n{docs_text}"}
        ],
        temperature=0,
    )

    scores = parse_scores(response.choices[0].message.content, len(documents))
    scored_docs = sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
    return [{**doc, "score": score} for doc, score in scored_docs[:top_k]]

def parse_scores(response: str, expected_count: int) -> list[float]:
    scores = []
    for line in response.strip().split("\n"):
        try:
            scores.append(max(0.0, min(1.0, float(line.strip()))))
        except ValueError:
            scores.append(0.5)
    while len(scores) < expected_count:
        scores.append(0.5)
    return scores[:expected_count]
```

**Cohere Rerank API:**
```python
import cohere

class CohereReranker:
    def __init__(self, api_key: str):
        self.client = cohere.Client(api_key)

    def rerank(self, query: str, documents: list[dict], top_k: int = 10) -> list[dict]:
        results = self.client.rerank(
            model="rerank-english-v3.0", query=query,
            documents=[doc["content"] for doc in documents], top_n=top_k
        )
        return [{**documents[r.index], "score": r.relevance_score} for r in results.results]
```

**Incorrect — one LLM call per document, extremely slow:**
```python
async def llm_rerank(query: str, documents: list[dict]) -> list[dict]:
    scores = []
    for doc in documents:  # Sequential LLM calls!
        response = await llm.chat.completions.create(
            model="gpt-5.2-mini",
            messages=[{"role": "user", "content": f"Rate relevance (0-1):\nQuery: {query}\nDoc: {doc['content']}"}]
        )
        scores.append(float(response.choices[0].message.content))
    return sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
```

**Correct — batch all docs in one LLM call:**
```python
async def llm_rerank(query: str, documents: list[dict], top_k: int = 10) -> list[dict]:
    # Batch all docs in ONE LLM call
    docs_text = "\n\n".join([
        f"[Doc {i+1}]\n{doc['content'][:300]}..."  # Truncate
        for i, doc in enumerate(documents)
    ])

    response = await llm.chat.completions.create(
        model="gpt-5.2-mini",
        messages=[
            {"role": "system", "content": "Rate each document's relevance (0.0-1.0). One score per line."},
            {"role": "user", "content": f"Query: {query}\n\nDocuments:\n{docs_text}"}
        ],
        temperature=0
    )

    scores = parse_scores(response.choices[0].message.content, len(documents))
    scored_docs = sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
    return [{**doc, "score": score} for doc, score in scored_docs[:top_k]]
```

**Key rules:**
- Batch all docs in one LLM call (reduces latency vs per-doc calls)
- Truncate to 200-400 chars per doc for LLM reranking
- Parse scores defensively (default 0.5 on parse error)
- LLM reranking at ~500ms, Cohere at ~200ms
- Set timeout with fallback to base ranking
