---
title: Chunking Strategies
impact: HIGH
impactDescription: "Poor chunking loses semantic context and hurts retrieval quality — chunk boundaries determine what can be found"
tags: chunking, splitting, overlap, semantic-boundaries
---

## Chunking Strategies

Split documents into optimal chunks that preserve semantic meaning.

**Basic Overlapping Chunks:**
```python
def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks for embedding."""
    words = text.split()
    chunks = []

    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)

    return chunks
```

**Semantic Boundary Chunking (OrchestKit Standard):**
```python
CHUNK_CONFIG = {
    "target_tokens": 500,      # ~400-600 tokens per chunk
    "max_tokens": 800,         # Hard limit
    "overlap_tokens": 75,      # ~15% overlap
    "boundary_markers": [      # Prefer splitting at:
        "\n## ",               # H2 headers
        "\n### ",              # H3 headers
        "\n\n",                # Paragraphs
        ". ",                  # Sentences (last resort)
    ]
}
```

**Sentence-Aware Chunking:**
```python
def chunk_by_sentences(text: str, chunk_size: int = 512) -> list[str]:
    sentences = text.split('. ')
    chunks, current, current_len = [], [], 0

    for sent in sentences:
        if current_len + len(sent) > chunk_size and current:
            chunks.append('. '.join(current) + '.')
            current, current_len = [sent], len(sent)
        else:
            current.append(sent)
            current_len += len(sent)

    if current:
        chunks.append('. '.join(current))
    return chunks
```

**Key rules:**
- Chunk size: 256-1024 tokens (512 typical sweet spot)
- Overlap: 10-20% for context continuity between chunks
- Include metadata (title, source, section) with each chunk
- Prefer semantic boundaries (headers, paragraphs) over fixed-size splits
- Not chunking long documents is a common mistake — context gets lost in embeddings
