---
title: Validate schema and content quality to prevent invalid entries from degrading evaluations
impact: CRITICAL
impactDescription: "Without schema and content quality validation, invalid entries degrade evaluation accuracy and produce misleading benchmark results"
tags: schema, validation, content-quality, referential-integrity, quality
---

## Quality Validation

Schema validation, content quality checks, and referential integrity enforcement.

**Document Schema (v2.0):**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "title", "source_url", "content_type", "sections"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Unique kebab-case identifier"
    },
    "title": {
      "type": "string",
      "minLength": 10,
      "maxLength": 200
    },
    "source_url": {
      "type": "string",
      "format": "uri",
      "description": "Canonical source URL (NOT placeholder)"
    },
    "content_type": {
      "type": "string",
      "enum": ["article", "tutorial", "research_paper", "documentation", "video_transcript", "code_repository"]
    },
    "tags": {
      "type": "array",
      "items": {"type": "string"},
      "minItems": 2,
      "maxItems": 10
    },
    "sections": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "title", "content"],
        "properties": {
          "id": {"type": "string", "pattern": "^[a-z0-9-/]+$"},
          "title": {"type": "string"},
          "content": {"type": "string", "minLength": 50}
        }
      }
    }
  }
}
```

**Content Quality Validation:**
```python
def validate_content_quality(document: dict) -> list[str]:
    """Validate document content meets quality standards."""
    warnings = []

    # Title length
    title = document.get("title", "")
    if len(title) < 10:
        warnings.append("Title too short (min 10 chars)")
    if len(title) > 200:
        warnings.append("Title too long (max 200 chars)")

    # Section content
    for section in document.get("sections", []):
        content = section.get("content", "")
        if len(content) < 50:
            warnings.append(f"Section {section['id']} content too short (min 50 chars)")
        if len(content) > 50000:
            warnings.append(f"Section {section['id']} content very long (>50k chars)")

    # Tags
    tags = document.get("tags", [])
    if len(tags) < 2:
        warnings.append("Too few tags (min 2)")
    if len(tags) > 10:
        warnings.append("Too many tags (max 10)")

    return warnings
```

**Unique ID Validation:**
```python
def validate_unique_ids(documents: list[dict], queries: list[dict]) -> list[str]:
    """Ensure all IDs are unique across documents and queries."""
    errors = []

    # Document IDs
    doc_ids = [d["id"] for d in documents]
    if len(doc_ids) != len(set(doc_ids)):
        duplicates = [id for id in doc_ids if doc_ids.count(id) > 1]
        errors.append(f"Duplicate document IDs: {set(duplicates)}")

    # Query IDs
    query_ids = [q["id"] for q in queries]
    if len(query_ids) != len(set(query_ids)):
        duplicates = [id for id in query_ids if query_ids.count(id) > 1]
        errors.append(f"Duplicate query IDs: {set(duplicates)}")

    # Section IDs within documents
    for doc in documents:
        section_ids = [s["id"] for s in doc.get("sections", [])]
        if len(section_ids) != len(set(section_ids)):
            errors.append(f"Duplicate section IDs in document: {doc['id']}")

    return errors
```

**Referential Integrity:**
```python
def validate_references(documents: list[dict], queries: list[dict]) -> list[str]:
    """Ensure query expected_chunks reference valid section IDs."""
    errors = []

    # Build set of all valid section IDs
    valid_sections = set()
    for doc in documents:
        for section in doc.get("sections", []):
            valid_sections.add(section["id"])

    # Check query references
    for query in queries:
        for chunk_id in query.get("expected_chunks", []):
            if chunk_id not in valid_sections:
                errors.append(
                    f"Query {query['id']} references invalid section: {chunk_id}"
                )

    return errors
```

**Validation Rules Summary:**

| Rule | Purpose | Severity |
|------|---------|----------|
| No Placeholder URLs | Ensure real canonical URLs | Error |
| Unique Identifiers | No duplicate doc/query/section IDs | Error |
| Referential Integrity | Query chunks reference valid sections | Error |
| Content Quality | Title/content length, tag count | Warning |
| Difficulty Distribution | Balanced query difficulty levels | Warning |

**Incorrect — Missing referential integrity check:**
```python
# Query references non-existent section
query = {
    "id": "q-test",
    "expected_chunks": ["section-999"],  # Doesn't exist!
}
queries.append(query)  # No validation
```

**Correct — Validate references exist:**
```python
# Build set of valid section IDs
valid_sections = set()
for doc in documents:
    for section in doc.get("sections", []):
        valid_sections.add(section["id"])

# Validate query references
for chunk_id in query.get("expected_chunks", []):
    if chunk_id not in valid_sections:
        raise ValueError(f"Query references invalid section: {chunk_id}")
```

**Key rules:**
- All documents must pass schema validation before inclusion
- IDs must be unique across documents, queries, and sections
- Query expected_chunks must reference existing section IDs
- Content quality checks are warnings (non-blocking) but should be addressed
