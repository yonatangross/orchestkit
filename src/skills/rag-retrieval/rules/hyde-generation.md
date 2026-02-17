---
title: HyDE Generation
impact: HIGH
impactDescription: "Direct query embedding fails when queries don't match document vocabulary — HyDE bridges the gap with hypothetical documents"
tags: hyde, hypothetical, vocabulary-mismatch, generation
---

## HyDE Generation

Generate hypothetical answer documents to bridge vocabulary gaps in semantic search.

**The Problem:**
```
Query: "scaling async data pipelines"
Docs use: "event-driven messaging", "Apache Kafka", "message brokers"
-> Low similarity scores despite high relevance
```

**The Solution:**
```python
from openai import AsyncOpenAI
from pydantic import BaseModel

class HyDEResult(BaseModel):
    original_query: str
    hypothetical_doc: str
    embedding: list[float]

async def generate_hyde(
    query: str, llm: AsyncOpenAI, embed_fn: callable, max_tokens: int = 150
) -> HyDEResult:
    """Generate hypothetical document and embed it."""
    response = await llm.chat.completions.create(
        model="gpt-5.2-mini",
        messages=[
            {"role": "system", "content":
                "Write a short paragraph that would answer this query. "
                "Use technical terminology that documentation would use."},
            {"role": "user", "content": query}
        ],
        max_tokens=max_tokens,
        temperature=0.3,
    )

    hypothetical_doc = response.choices[0].message.content
    embedding = await embed_fn(hypothetical_doc)  # Embed the hypothetical doc, not the query

    return HyDEResult(
        original_query=query,
        hypothetical_doc=hypothetical_doc,
        embedding=embedding,
    )
```

**When to use HyDE:**

| Scenario | Use HyDE? |
|----------|-----------|
| Abstract/conceptual queries | Yes |
| Exact term searches | No (use keyword) |
| Code snippet searches | No |
| Natural language questions | Yes |
| Vocabulary mismatch suspected | Yes |

**Incorrect — embedding the query instead of hypothetical document:**
```python
async def generate_hyde(query: str) -> HyDEResult:
    response = await llm.chat.completions.create(
        model="gpt-5.2-mini",
        messages=[{"role": "user", "content": query}],
        max_tokens=150
    )
    hypothetical_doc = response.choices[0].message.content
    embedding = await embed_fn(query)  # WRONG: Embeds query, not hypothetical doc!
    return HyDEResult(query, hypothetical_doc, embedding)
```

**Correct — embed the hypothetical document:**
```python
async def generate_hyde(query: str) -> HyDEResult:
    response = await llm.chat.completions.create(
        model="gpt-5.2-mini",
        messages=[
            {"role": "system", "content": "Write a short paragraph that would answer this query."},
            {"role": "user", "content": query}
        ],
        max_tokens=150,
        temperature=0.3
    )

    hypothetical_doc = response.choices[0].message.content
    embedding = await embed_fn(hypothetical_doc)  # Embed the hypothetical doc!

    return HyDEResult(query, hypothetical_doc, embedding)
```

**Key rules:**
- Embed the hypothetical document, NOT the original query
- Use fast/cheap model (gpt-5.2-mini, claude-haiku-4-5) for generation
- Temperature 0.3 for consistent, factual hypothetical docs
- Keep hypothetical docs concise: 100-200 tokens
- Adds ~500ms latency — always implement with timeout fallback
