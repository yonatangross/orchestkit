# Quality Metrics and Coverage Analysis

Metrics and analysis patterns for golden dataset quality.

## Coverage Analysis

### Gap Detection

```python
def analyze_coverage_gaps(
    documents: list[dict],
    queries: list[dict],
) -> dict:
    """Analyze dataset coverage and identify gaps."""

    # Content type distribution
    content_types = {}
    for doc in documents:
        ct = doc.get("content_type", "unknown")
        content_types[ct] = content_types.get(ct, 0) + 1

    # Domain/tag distribution
    all_tags = []
    for doc in documents:
        all_tags.extend(doc.get("tags", []))
    tag_counts = {}
    for tag in all_tags:
        tag_counts[tag] = tag_counts.get(tag, 0) + 1

    # Difficulty distribution
    difficulties = {}
    for query in queries:
        diff = query.get("difficulty", "unknown")
        difficulties[diff] = difficulties.get(diff, 0) + 1

    # Identify gaps
    gaps = []

    # Check content type balance
    total_docs = len(documents)
    if content_types.get("tutorial", 0) / total_docs < 0.15:
        gaps.append("Under-represented: tutorials (<15%)")
    if content_types.get("research_paper", 0) / total_docs < 0.05:
        gaps.append("Under-represented: research papers (<5%)")

    # Check domain coverage
    expected_domains = ["ai-ml", "backend", "frontend", "devops", "security"]
    for domain in expected_domains:
        if tag_counts.get(domain, 0) < 5:
            gaps.append(f"Under-represented domain: {domain} (<5 docs)")

    # Check difficulty balance
    total_queries = len(queries)
    if difficulties.get("hard", 0) / total_queries < 0.10:
        gaps.append("Under-represented: hard queries (<10%)")
    if difficulties.get("adversarial", 0) / total_queries < 0.05:
        gaps.append("Under-represented: adversarial queries (<5%)")

    return {
        "content_type_distribution": content_types,
        "tag_distribution": dict(sorted(tag_counts.items(), key=lambda x: -x[1])[:20]),
        "difficulty_distribution": difficulties,
        "gaps": gaps,
        "total_documents": total_docs,
        "total_queries": total_queries,
    }
```

## Validation Workflow

### Pre-Addition Validation

```python
async def validate_before_add(
    document: dict,
    existing_documents: list[dict],
    existing_queries: list[dict],
    source_url_map: dict[str, str],
    embedding_service,
) -> dict:
    """Run full validation before adding document.

    Returns:
        {
            "valid": bool,
            "errors": list[str],  # Blocking issues
            "warnings": list[str],  # Non-blocking issues
            "duplicate_check": {
                "is_duplicate": bool,
                "similar_to": str | None,
                "similarity": float | None,
            }
        }
    """
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

    # 4. Content quality
    quality_warnings = validate_content_quality(document)
    warnings.extend(quality_warnings)

    # 5. Semantic duplicate check
    content = " ".join(
        s.get("content", "") for s in document.get("sections", [])
    )
    existing_embeddings = await load_existing_embeddings(existing_documents)
    dup_result = await check_duplicate(
        content, existing_embeddings, embedding_service
    )

    duplicate_check = {
        "is_duplicate": dup_result is not None,
        "similar_to": dup_result[0] if dup_result else None,
        "similarity": dup_result[1] if dup_result else None,
    }

    if dup_result and dup_result[1] >= 0.90:
        errors.append(
            f"Content too similar to existing document: {dup_result[0]} "
            f"(similarity: {dup_result[1]:.2f})"
        )
    elif dup_result and dup_result[1] >= 0.80:
        warnings.append(
            f"Content similar to existing document: {dup_result[0]} "
            f"(similarity: {dup_result[1]:.2f})"
        )

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "duplicate_check": duplicate_check,
    }
```

### Full Dataset Validation

```python
async def validate_full_dataset() -> dict:
    """Run comprehensive validation on entire dataset.

    Use this for:
    - Pre-commit hooks
    - CI/CD validation
    - Periodic integrity checks
    """
    from backend.tests.smoke.retrieval.fixtures.loader import FixtureLoader

    loader = FixtureLoader(use_expanded=True)
    documents = loader.load_documents()
    queries = loader.load_queries()
    source_url_map = loader.load_source_url_map()

    all_errors = []
    all_warnings = []

    # 1. Schema validation for all documents
    for doc in documents:
        errors = validate_schema(doc)
        all_errors.extend([f"[{doc['id']}] {e}" for e in errors])

    # 2. Unique ID validation
    id_errors = validate_unique_ids(documents, queries)
    all_errors.extend(id_errors)

    # 3. Referential integrity
    ref_errors = validate_references(documents, queries)
    all_errors.extend(ref_errors)

    # 4. URL validation
    for doc in documents:
        valid, msg = validate_url(doc.get("source_url", ""))
        if not valid:
            all_errors.append(f"[{doc['id']}] {msg}")

    # 5. Difficulty distribution
    dist_warnings = validate_difficulty_distribution(queries)
    all_warnings.extend(dist_warnings)

    # 6. Coverage analysis
    coverage = analyze_coverage_gaps(documents, queries)
    all_warnings.extend(coverage["gaps"])

    return {
        "valid": len(all_errors) == 0,
        "errors": all_errors,
        "warnings": all_warnings,
        "coverage": coverage,
        "stats": {
            "documents": len(documents),
            "queries": len(queries),
            "sections": sum(len(d.get("sections", [])) for d in documents),
        }
    }
```

## CLI Integration

### Validation Commands

```bash
# Validate specific document
poetry run python scripts/data/add_to_golden_dataset.py validate \
    --document-id "new-doc-id"

# Validate full dataset
poetry run python scripts/data/add_to_golden_dataset.py validate-all

# Check for duplicates
poetry run python scripts/data/add_to_golden_dataset.py check-duplicate \
    --url "https://example.com/article"

# Analyze coverage gaps
poetry run python scripts/data/add_to_golden_dataset.py coverage
```

## Pre-Commit Hook

```bash
#!/bin/bash
# .claude/hooks/pretool/bash/validate-golden-dataset.sh

# Only run if golden dataset files changed
CHANGED_FILES=$(git diff --cached --name-only)

if echo "$CHANGED_FILES" | grep -q "fixtures/documents_expanded.json\|fixtures/queries.json\|fixtures/source_url_map.json"; then
    echo "Validating golden dataset changes..."

    cd backend
    poetry run python scripts/data/add_to_golden_dataset.py validate-all

    if [ $? -ne 0 ]; then
        echo "Golden dataset validation failed!"
        echo "Fix errors before committing."
        exit 1
    fi

    echo "Golden dataset validation passed"
fi
```