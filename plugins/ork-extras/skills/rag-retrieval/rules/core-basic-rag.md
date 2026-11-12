---
title: Construct basic RAG pipeline with proper context assembly and citation tracking
impact: CRITICAL
impactDescription: "Without proper context construction and citation tracking, RAG outputs are unverifiable and prone to hallucination"
tags: rag, retrieval, context, citations, grounding
---

## Basic RAG Pattern

Retrieve relevant documents, construct context, and generate grounded responses with citations.

**Basic RAG:**
```python
async def rag_query(question: str, top_k: int = 5) -> str:
    """Basic RAG: retrieve then generate."""
    docs = await vector_db.search(question, limit=top_k)

    context = "\n\n".join([
        f"[{i+1}] {doc.text}"
        for i, doc in enumerate(docs)
    ])

    response = await llm.chat([
        {"role": "system", "content":
            "Answer using ONLY the provided context. "
            "If not in context, say 'I don't have that information.'"},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
    ])

    return response.content
```

**RAG with Citations:**
```python
async def rag_with_citations(question: str) -> dict:
    """RAG with inline citations [1], [2], etc."""
    docs = await vector_db.search(question, limit=5)

    context = "\n\n".join([
        f"[{i+1}] {doc.text}\nSource: {doc.metadata['source']}"
        for i, doc in enumerate(docs)
    ])

    response = await llm.chat([
        {"role": "system", "content":
            "Answer with inline citations like [1], [2]. "
            "End with a Sources section."},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
    ])

    return {
        "answer": response.content,
        "sources": [doc.metadata['source'] for doc in docs]
    }
```

**Incorrect — no citations, no grounding constraint:**
```python
async def rag_query(question: str) -> str:
    docs = await vector_db.search(question, limit=5)
    context = "\n\n".join([doc.text for doc in docs])  # No citations
    response = await llm.chat([
        {"role": "user", "content": f"{context}\n\n{question}"}  # No grounding instruction
    ])
    return response.content  # No source tracking
```

**Correct — citations with grounding constraint:**
```python
async def rag_with_citations(question: str) -> dict:
    docs = await vector_db.search(question, limit=5)
    context = "\n\n".join([
        f"[{i+1}] {doc.text}\nSource: {doc.metadata['source']}"  # Numbered citations
        for i, doc in enumerate(docs)
    ])

    response = await llm.chat([
        {"role": "system", "content": "Answer with inline citations like [1], [2]. Use ONLY the provided context."},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
    ])

    return {"answer": response.content, "sources": [doc.metadata['source'] for doc in docs]}
```

**Key rules:**
- Always include citation tracking (`[1]`, `[2]`) for verifiable answers
- Set system prompt to constrain answers to retrieved context only
- Use top-k of 3-10 documents, temperature 0.1-0.3 for factual tasks
- Return sources alongside answers for transparency
