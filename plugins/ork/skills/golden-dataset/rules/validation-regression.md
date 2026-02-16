---
title: Regression Testing
impact: CRITICAL
impactDescription: "Without systematic regression testing and difficulty distribution enforcement, dataset changes silently degrade evaluation reliability"
tags: regression, difficulty-distribution, pre-commit, full-validation, testing
---

## Regression Testing

Difficulty distribution enforcement, pre-commit hooks, and full dataset validation.

**Difficulty Distribution Validation:**
```python
def validate_difficulty_distribution(queries: list[dict]) -> list[str]:
    """Ensure balanced difficulty distribution."""
    warnings = []

    # Count by difficulty
    distribution = {}
    for query in queries:
        diff = query.get("difficulty", "unknown")
        distribution[diff] = distribution.get(diff, 0) + 1

    # Minimum requirements
    requirements = {
        "trivial": 3,
        "easy": 3,
        "medium": 5,  # Most common real-world case
        "hard": 3,
    }

    for level, min_count in requirements.items():
        actual = distribution.get(level, 0)
        if actual < min_count:
            warnings.append(
                f"Insufficient {level} queries: {actual}/{min_count}"
            )

    return warnings
```

**Query Schema:**
```json
{
  "type": "object",
  "required": ["id", "query", "difficulty", "expected_chunks", "min_score"],
  "properties": {
    "id": {"type": "string", "pattern": "^q-[a-z0-9-]+$"},
    "query": {"type": "string", "minLength": 5, "maxLength": 500},
    "modes": {"type": "array", "items": {"enum": ["semantic", "keyword", "hybrid"]}},
    "category": {"enum": ["specific", "broad", "negative", "edge", "coarse-to-fine"]},
    "difficulty": {"enum": ["trivial", "easy", "medium", "hard", "adversarial"]},
    "expected_chunks": {"type": "array", "items": {"type": "string"}, "minItems": 1},
    "min_score": {"type": "number", "minimum": 0, "maximum": 1}
  }
}
```

**Full Dataset Validation:**
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

**Pre-Commit Hook:**
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

**CLI Validation Commands:**
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

**Incorrect — Unbalanced difficulty distribution:**
```python
# All queries marked "easy"
queries = [
    {"id": "q-1", "difficulty": "easy"},
    {"id": "q-2", "difficulty": "easy"},
    {"id": "q-3", "difficulty": "easy"},
]
```

**Correct — Balanced difficulty distribution:**
```python
# Mix of difficulty levels
queries = [
    {"id": "q-1", "difficulty": "trivial"},  # 3+ trivial
    {"id": "q-2", "difficulty": "easy"},     # 3+ easy
    {"id": "q-3", "difficulty": "medium"},   # 5+ medium
    {"id": "q-4", "difficulty": "hard"},     # 3+ hard
]

# Validate distribution
validate_difficulty_distribution(queries)  # Checks minimums
```

**Key rules:**
- Run full dataset validation before every commit that modifies golden dataset files
- Enforce minimum difficulty distribution (trivial 3, easy 3, medium 5, hard 3)
- Run all 6 validation steps: schema, IDs, references, URLs, distribution, coverage
- Block commits that introduce schema errors or referential integrity violations
- Treat difficulty distribution and coverage gaps as warnings that should be addressed
