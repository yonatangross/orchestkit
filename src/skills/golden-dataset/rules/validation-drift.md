---
title: Drift Detection
impact: CRITICAL
impactDescription: "Without duplicate detection and coverage monitoring, datasets accumulate redundant entries and develop blind spots that skew evaluation results"
tags: duplicate-detection, semantic-similarity, coverage, drift, deduplication
---

## Drift Detection

Duplicate detection, semantic similarity checking, and coverage gap analysis.

**Duplicate Detection Thresholds:**

| Similarity | Action |
|------------|--------|
| >= 0.90 | **Block** -- Content too similar |
| >= 0.85 | **Warn** -- High similarity detected |
| >= 0.80 | **Note** -- Similar content exists |
| < 0.80 | **Allow** -- Sufficiently unique |

**Semantic Similarity Check:**
```python
import numpy as np
from typing import Optional

async def check_duplicate(
    new_content: str,
    existing_embeddings: list[tuple[str, np.ndarray]],
    embedding_service,
    threshold: float = 0.85,
) -> Optional[tuple[str, float]]:
    """Check if content is duplicate of existing document.

    Returns:
        (doc_id, similarity) if duplicate found, None otherwise
    """
    # Generate embedding for new content
    new_embedding = await embedding_service.generate_embedding(
        text=new_content[:8000],  # Truncate for embedding
        normalize=True,
    )
    new_vec = np.array(new_embedding)

    # Compare against existing
    max_similarity = 0.0
    most_similar_doc = None

    for doc_id, existing_vec in existing_embeddings:
        # Cosine similarity (vectors are normalized)
        similarity = np.dot(new_vec, existing_vec)

        if similarity > max_similarity:
            max_similarity = similarity
            most_similar_doc = doc_id

    if max_similarity >= threshold:
        return (most_similar_doc, max_similarity)

    return None
```

**URL Duplicate Check:**
```python
def check_url_duplicate(
    new_url: str,
    source_url_map: dict[str, str],
) -> Optional[str]:
    """Check if URL already exists in dataset."""
    normalized = normalize_url(new_url)

    for doc_id, existing_url in source_url_map.items():
        if normalize_url(existing_url) == normalized:
            return doc_id

    return None

def normalize_url(url: str) -> str:
    """Normalize URL for comparison."""
    from urllib.parse import urlparse, urlunparse

    parsed = urlparse(url.lower())
    netloc = parsed.netloc.replace("www.", "")
    path = parsed.path.rstrip("/")

    return urlunparse((
        parsed.scheme, netloc, path,
        "", "", "",  # params, query, fragment stripped
    ))
```

**Pre-Addition Validation Workflow:**
```python
async def validate_before_add(
    document: dict,
    existing_documents: list[dict],
    source_url_map: dict[str, str],
    embedding_service,
) -> dict:
    """Run full validation before adding document."""
    errors = []
    warnings = []

    # 1. Schema validation
    schema_errors = validate_schema(document)
    errors.extend(schema_errors)

    # 2. URL validation
    url_valid, url_msg = validate_url(document.get("source_url", ""))
    if not url_valid:
        errors.append(url_msg)

    # 3. URL duplicate check
    url_dup = check_url_duplicate(document.get("source_url", ""), source_url_map)
    if url_dup:
        errors.append(f"URL already exists in dataset as: {url_dup}")

    # 4. Semantic duplicate check
    content = " ".join(
        s.get("content", "") for s in document.get("sections", [])
    )
    existing_embeddings = await load_existing_embeddings(existing_documents)
    dup_result = await check_duplicate(content, existing_embeddings, embedding_service)

    if dup_result and dup_result[1] >= 0.90:
        errors.append(
            f"Content too similar to: {dup_result[0]} (similarity: {dup_result[1]:.2f})"
        )
    elif dup_result and dup_result[1] >= 0.80:
        warnings.append(
            f"Content similar to: {dup_result[0]} (similarity: {dup_result[1]:.2f})"
        )

    return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}
```

**Key rules:**
- Always run both URL and semantic duplicate checks before adding entries
- Block entries with >= 0.90 cosine similarity to existing content
- Normalize URLs before comparison (strip www, trailing slashes, query params)
- Run coverage gap analysis periodically to detect dataset drift
- Truncate content to 8000 chars for embedding comparison
