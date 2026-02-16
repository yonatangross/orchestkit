---
title: Storage Patterns
impact: HIGH
impactDescription: "Choosing the wrong backup strategy or violating the URL contract leads to data loss, broken restores, and unrecoverable golden datasets"
tags: storage, backup-strategy, url-contract, data-integrity, json
---

## Storage Patterns

Backup strategies, URL contract enforcement, and data integrity checks.

**Backup Strategy Comparison:**

| Strategy | Version Control | Restore Speed | Portability | Inspection |
|----------|-----------------|---------------|-------------|------------|
| **JSON** (recommended) | Yes | Slower (regen embeddings) | High | Easy |
| **SQL Dump** | No (binary) | Fast | DB-version dependent | Hard |

**The URL Contract:**

Golden dataset analyses MUST store **real canonical URLs**, not placeholders.

```python
# WRONG - Placeholder URL (breaks restore)
analysis.url = "https://orchestkit.dev/placeholder/123"

# CORRECT - Real canonical URL (enables re-fetch if needed)
analysis.url = "https://docs.python.org/3/library/asyncio.html"
```

**Why this matters:**
- Enables re-fetching content if embeddings need regeneration
- Allows validation that source content hasn't changed
- Provides audit trail for data provenance

**URL Validation:**
```python
FORBIDDEN_URL_PATTERNS = [
    "orchestkit.dev",
    "placeholder",
    "example.com",
    "localhost",
    "127.0.0.1",
]

def validate_url(url: str) -> tuple[bool, str]:
    """Validate URL is not a placeholder."""
    for pattern in FORBIDDEN_URL_PATTERNS:
        if pattern in url.lower():
            return False, f"URL contains forbidden pattern: {pattern}"

    if not url.startswith("https://"):
        if not url.startswith("http://arxiv.org"):  # arXiv redirects
            return False, "URL must use HTTPS"

    return True, "OK"
```

**Data Integrity Checks:**

| Check | Error/Warning | Description |
|-------|---------------|-------------|
| Count mismatch | Error | Analysis/chunk count differs from metadata |
| Placeholder URLs | Error | URLs containing orchestkit.dev or placeholder |
| Missing embeddings | Error | Chunks without embeddings after restore |
| Orphaned chunks | Warning | Chunks with no parent analysis |

**Verification Implementation:**
```python
async def verify_golden_dataset() -> dict:
    """Verify golden dataset integrity."""

    errors = []
    warnings = []

    async with get_session() as session:
        # 1. Check counts
        analysis_count = await session.scalar(select(func.count(Analysis.id)))
        chunk_count = await session.scalar(select(func.count(Chunk.id)))

        expected = load_metadata()
        if analysis_count != expected["total_analyses"]:
            errors.append(f"Analysis count mismatch: {analysis_count} vs {expected['total_analyses']}")

        # 2. Check URL contract
        query = select(Analysis).where(
            Analysis.url.like("%orchestkit.dev%") |
            Analysis.url.like("%placeholder%")
        )
        result = await session.execute(query)
        invalid_urls = result.scalars().all()

        if invalid_urls:
            errors.append(f"Found {len(invalid_urls)} analyses with placeholder URLs")

        # 3. Check embeddings exist
        query = select(Chunk).where(Chunk.embedding.is_(None))
        result = await session.execute(query)
        missing_embeddings = result.scalars().all()

        if missing_embeddings:
            errors.append(f"Found {len(missing_embeddings)} chunks without embeddings")

        # 4. Check orphaned chunks
        query = select(Chunk).outerjoin(Analysis).where(Analysis.id.is_(None))
        result = await session.execute(query)
        orphaned = result.scalars().all()

        if orphaned:
            warnings.append(f"Found {len(orphaned)} orphaned chunks")

        return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}
```

**Best Practices:**
1. **Version control backups** -- commit JSON to git for history and diffs
2. **Validate before deployment** -- run verify before production changes
3. **Test restore in staging** -- never test restore in production first
4. **Document changes** -- track additions/removals in metadata

**Incorrect — Missing URL validation:**
```python
# No URL contract enforcement
analysis.url = url  # Could be placeholder
session.add(analysis)
await session.commit()
```

**Correct — Enforcing URL contract:**
```python
# Validate before saving
valid, msg = validate_url(url)
if not valid:
    raise ValueError(f"Invalid URL: {msg}")

analysis.url = url  # Guaranteed to be real canonical URL
session.add(analysis)
await session.commit()
```

**Key rules:**
- Always use JSON backup for version control and portability
- Never store placeholder URLs -- enforce the URL contract
- Run all 4 integrity checks (counts, URLs, embeddings, orphans) after every restore
- SQL dumps for local snapshots only, not version control
