---
title: Manage context window size with sufficiency checks to balance relevance and cost
impact: HIGH
impactDescription: "Context too large dilutes relevance and wastes tokens — too small misses information. Sufficiency check prevents hallucination"
tags: context, tokens, budget, sufficiency, hallucination
---

## Context Window Management

Budget tokens for context and validate sufficiency before generation.

**Token Budget Fitting:**
```python
def fit_context(docs: list, max_tokens: int = 6000) -> list:
    """Truncate context to fit token budget."""
    total_tokens = 0
    selected = []

    for doc in docs:
        doc_tokens = count_tokens(doc.text)
        if total_tokens + doc_tokens > max_tokens:
            break
        selected.append(doc)
        total_tokens += doc_tokens

    return selected
```

**Sufficiency Check (Google Research 2025):**
```python
from pydantic import BaseModel

class SufficiencyCheck(BaseModel):
    is_sufficient: bool
    confidence: float  # 0.0-1.0
    missing_info: str | None = None

async def rag_with_sufficiency(question: str, top_k: int = 5) -> str:
    """RAG with hallucination prevention via sufficiency check."""
    docs = await vector_db.search(question, limit=top_k)
    context = "\n\n".join([f"[{i+1}] {doc.text}" for i, doc in enumerate(docs)])

    check = await llm.with_structured_output(SufficiencyCheck).ainvoke(
        f"Does this context contain sufficient information to answer?\n"
        f"Question: {question}\nContext:\n{context}"
    )

    if not check.is_sufficient and check.confidence > 0.7:
        return f"I don't have enough information. Missing: {check.missing_info}"

    if not check.is_sufficient and check.confidence <= 0.7:
        more_docs = await vector_db.search(question, limit=top_k * 2)
        context = "\n\n".join([f"[{i+1}] {doc.text}" for i, doc in enumerate(more_docs)])

    return await generate_with_context(question, context)
```

**Incorrect — no token budget or sufficiency check:**
```python
async def rag_query(question: str) -> str:
    docs = await vector_db.search(question, limit=100)  # No limit!
    context = "\n\n".join([doc.text for doc in docs])  # Could exceed context window
    return await generate_with_context(question, context)  # No sufficiency check
```

**Correct — token budget with sufficiency validation:**
```python
async def rag_with_sufficiency(question: str, top_k: int = 5) -> str:
    docs = await vector_db.search(question, limit=top_k)
    fitted = fit_context(docs, max_tokens=6000)  # Budget enforcement
    context = "\n\n".join([f"[{i+1}] {doc.text}" for i, doc in enumerate(fitted)])

    check = await llm.with_structured_output(SufficiencyCheck).ainvoke(
        f"Does this context contain sufficient information?\nQuestion: {question}\nContext:\n{context}"
    )

    if not check.is_sufficient and check.confidence > 0.7:
        return f"I don't have enough information. Missing: {check.missing_info}"

    return await generate_with_context(question, context)
```

**Key rules:**
- Keep context under 75% of model limit, reserve for system prompt + response
- Prioritize highest-relevance documents first
- Context budget: 4K-8K tokens typical for factual tasks
- RAG paradoxically increases hallucinations when context is insufficient — use sufficiency check
- Abstain when confidence > 0.7 and context is insufficient
