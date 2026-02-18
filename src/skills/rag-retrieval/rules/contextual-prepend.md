---
title: Contextual Retrieval — Context Prepending
impact: HIGH
impactDescription: "Chunks lose document-level context during retrieval — prepending situational context reduces retrieval failures by 35%"
tags: contextual, anthropic, context-prepend, chunks
---

## Contextual Retrieval — Context Prepending

Prepend situational context to chunks before embedding to preserve document-level meaning.

**The Problem:**
```
Original: "ACME Q3 2024 Earnings Report..."
Chunk: "Revenue increased 15% compared to the previous quarter."
Query: "What was ACME's Q3 2024 revenue growth?"
Result: Chunk doesn't mention "ACME" or "Q3 2024" — retrieval fails
```

**Context Generation:**
```python
import anthropic
client = anthropic.Anthropic()

CONTEXT_PROMPT = """
<document>
{document}
</document>

Here is the chunk we want to situate within the document:
<chunk>
{chunk}
</chunk>

Please give a short, succinct context (1-2 sentences) to situate this chunk
within the overall document. Focus on information that would help retrieval.
Answer only with the context, nothing else.
"""

def contextualize_chunk(document: str, chunk: str) -> str:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=150,
        messages=[{"role": "user",
                   "content": CONTEXT_PROMPT.format(document=document, chunk=chunk)}]
    )
    return f"{response.content[0].text}\n\n{chunk}"
```

**With Prompt Caching (90% cost reduction):**
```python
def contextualize_cached(document: str, chunk: str) -> str:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=150,
        messages=[{"role": "user", "content": [
            {"type": "text", "text": f"<document>\n{document}\n</document>",
             "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": f"Situate this chunk (1-2 sentences):\n<chunk>\n{chunk}\n</chunk>"}
        ]}]
    )
    return f"{response.content[0].text}\n\n{chunk}"
```

**Incorrect — chunk without document context:**
```python
def index_chunk(chunk: str) -> str:
    # Missing document context — retrieval will fail
    embedding = embed_model.embed([chunk])[0]
    return embedding
```

**Correct — prepend situational context before embedding:**
```python
def contextualize_chunk(document: str, chunk: str) -> str:
    context = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=150,
        messages=[{"role": "user", "content": [
            {"type": "text", "text": f"<document>\n{document}\n</document>",
             "cache_control": {"type": "ephemeral"}},  # Cache for 90% cost reduction
            {"type": "text", "text": f"Situate this chunk (1-2 sentences):\n<chunk>\n{chunk}\n</chunk>"}
        ]}]
    )
    return f"{context.content[0].text}\n\n{chunk}"  # Prepend context
```

**Key rules:**
- Good context: "This chunk is from ACME Corp's Q3 2024 earnings report, specifically the revenue section."
- Bad context: "This is a chunk from the document." (too generic)
- Context length: 1-2 sentences — enough without excessive token overhead
- Use prompt caching (ephemeral) for 90% cost reduction when processing many chunks from same doc
