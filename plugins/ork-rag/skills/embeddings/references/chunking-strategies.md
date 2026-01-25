# Chunking Strategies

Optimal text chunking for embedding quality and retrieval accuracy.

## Semantic Chunking

```python
import re
from typing import Iterator

def semantic_chunk(
    text: str,
    max_tokens: int = 512,
    overlap_tokens: int = 50
) -> Iterator[dict]:
    """Split text at semantic boundaries with overlap."""
    # Split at paragraph/section boundaries first
    sections = re.split(r'\n\n+|\n(?=#+\s)', text)

    current_chunk = []
    current_tokens = 0

    for section in sections:
        section_tokens = len(section.split())

        if current_tokens + section_tokens > max_tokens:
            if current_chunk:
                yield {
                    "text": "\n\n".join(current_chunk),
                    "tokens": current_tokens
                }
                # Keep overlap from end of previous chunk
                overlap_text = current_chunk[-1] if current_chunk else ""
                current_chunk = [overlap_text] if overlap_text else []
                current_tokens = len(overlap_text.split())

        current_chunk.append(section)
        current_tokens += section_tokens

    if current_chunk:
        yield {"text": "\n\n".join(current_chunk), "tokens": current_tokens}
```

## Code-Aware Chunking

```python
def chunk_code(
    code: str,
    language: str,
    max_tokens: int = 512
) -> list[dict]:
    """Chunk code at function/class boundaries."""
    patterns = {
        "python": r'(?=^(?:def |class |async def ))',
        "typescript": r'(?=^(?:function |class |export ))',
        "go": r'(?=^func )'
    }

    pattern = patterns.get(language, r'\n\n+')
    blocks = re.split(pattern, code, flags=re.MULTILINE)

    chunks = []
    for block in blocks:
        if len(block.split()) <= max_tokens:
            chunks.append({"text": block, "type": "function"})
        else:
            # Split large blocks further
            for sub in semantic_chunk(block, max_tokens):
                chunks.append(sub)

    return chunks
```

## Configuration

| Content Type | Chunk Size | Overlap | Boundary |
|-------------|------------|---------|----------|
| Documentation | 512 | 50 | Paragraph |
| Code | 512 | 0 | Function/class |
| Chat/logs | 256 | 25 | Message |
| Legal/technical | 1024 | 100 | Section |

## Cost Optimization

- Deduplicate chunks before embedding
- Cache embeddings by content hash
- Batch embed (100-500 texts per call)
- Use smaller model for high-volume ingestion