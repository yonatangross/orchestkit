# Data Validation & Contracts

## The URL Contract

**Rule:** Golden dataset analyses MUST store real canonical URLs, not placeholders.

### Why This Matters

```python
# WRONG - Placeholder URL
analysis.url = "https://orchestkit.dev/placeholder/doc-123"

# Problems:
# 1. Can't re-fetch content if needed
# 2. Can't verify source hasn't changed
# 3. No audit trail for data provenance
# 4. Breaks restore on different domains

# CORRECT - Real canonical URL
analysis.url = "https://docs.python.org/3/library/asyncio.html"

# Benefits:
# 1. Can re-fetch if embeddings model changes
# 2. Can validate content hasn't been updated
# 3. Clear data provenance
# 4. Works across environments
```

### Validation Check

```python
async def check_url_contract() -> list[str]:
    """Find analyses with placeholder URLs."""

    async with get_session() as session:
        query = select(Analysis).where(
            Analysis.url.like("%orchestkit.dev%") |
            Analysis.url.like("%placeholder%") |
            Analysis.url.like("%example.com%") |
            Analysis.url.like("%test.local%")
        )
        result = await session.execute(query)
        invalid = result.scalars().all()

        if invalid:
            print(f"❌ Found {len(invalid)} analyses with placeholder URLs:")
            for analysis in invalid:
                print(f"   - {analysis.id}: {analysis.url}")
            return [str(a.id) for a in invalid]

        print("✅ URL contract validated: All URLs are canonical")
        return []
```

---

## Data Integrity Checks

### 1. Count Validation

```python
async def validate_counts(expected_metadata: dict) -> dict:
    """Verify counts match expected values."""

    async with get_session() as session:
        actual = {
            "analyses": await session.scalar(select(func.count(Analysis.id))),
            "chunks": await session.scalar(select(func.count(Chunk.id))),
            "artifacts": await session.scalar(select(func.count(Artifact.id)))
        }

        expected = {
            "analyses": expected_metadata["total_analyses"],
            "chunks": expected_metadata["total_chunks"],
            "artifacts": expected_metadata["total_artifacts"]
        }

        errors = []
        for key in ["analyses", "chunks", "artifacts"]:
            if actual[key] != expected[key]:
                errors.append(f"{key}: expected {expected[key]}, got {actual[key]}")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "actual": actual,
            "expected": expected
        }
```

### 2. Embedding Validation

```python
async def validate_embeddings() -> dict:
    """Check all chunks have embeddings."""

    async with get_session() as session:
        # Find chunks without embeddings
        query = select(Chunk).where(Chunk.embedding.is_(None))
        result = await session.execute(query)
        missing = result.scalars().all()

        if missing:
            return {
                "valid": False,
                "error": f"Found {len(missing)} chunks without embeddings",
                "chunk_ids": [str(c.id) for c in missing]
            }

        # Check embedding dimensions
        query = select(Chunk).limit(1)
        result = await session.execute(query)
        sample = result.scalar_one()

        if len(sample.embedding) != 1024:
            return {
                "valid": False,
                "error": f"Invalid embedding dimensions: {len(sample.embedding)} (expected 1024)"
            }

        return {"valid": True, "message": "All chunks have valid embeddings"}
```

### 3. Orphaned Data Check

```python
async def check_orphaned_data() -> dict:
    """Find orphaned chunks (no parent analysis)."""

    async with get_session() as session:
        # Find chunks without parent analysis
        query = (
            select(Chunk)
            .outerjoin(Analysis, Chunk.analysis_id == Analysis.id)
            .where(Analysis.id.is_(None))
        )
        result = await session.execute(query)
        orphaned = result.scalars().all()

        if orphaned:
            return {
                "valid": False,
                "warning": f"Found {len(orphaned)} orphaned chunks",
                "chunk_ids": [str(c.id) for c in orphaned]
            }

        return {"valid": True, "message": "No orphaned data found"}
```

### 4. Duplicate Check

```python
async def check_duplicates() -> dict:
    """Find duplicate analyses (same URL)."""

    async with get_session() as session:
        # Find URLs that appear more than once
        query = (
            select(Analysis.url, func.count(Analysis.id).label("count"))
            .group_by(Analysis.url)
            .having(func.count(Analysis.id) > 1)
        )
        result = await session.execute(query)
        duplicates = result.all()

        if duplicates:
            return {
                "valid": False,
                "warning": f"Found {len(duplicates)} duplicate URLs",
                "urls": [(url, count) for url, count in duplicates]
            }

        return {"valid": True, "message": "No duplicates found"}
```

---

## Comprehensive Validation

```python
async def verify_golden_dataset() -> dict:
    """Run all validation checks."""

    print("🔍 Validating golden dataset...")

    # Load expected metadata
    with open(METADATA_FILE) as f:
        expected_metadata = json.load(f)

    results = {
        "timestamp": datetime.now(UTC).isoformat(),
        "checks": {}
    }

    # 1. URL Contract
    print("\n1. Checking URL contract...")
    invalid_urls = await check_url_contract()
    results["checks"]["url_contract"] = {
        "passed": len(invalid_urls) == 0,
        "invalid_count": len(invalid_urls),
        "invalid_ids": invalid_urls
    }

    # 2. Count Validation
    print("\n2. Validating counts...")
    count_result = await validate_counts(expected_metadata)
    results["checks"]["counts"] = count_result

    # 3. Embedding Validation
    print("\n3. Validating embeddings...")
    embedding_result = await validate_embeddings()
    results["checks"]["embeddings"] = embedding_result

    # 4. Orphaned Data
    print("\n4. Checking for orphaned data...")
    orphan_result = await check_orphaned_data()
    results["checks"]["orphaned_data"] = orphan_result

    # 5. Duplicates
    print("\n5. Checking for duplicates...")
    duplicate_result = await check_duplicates()
    results["checks"]["duplicates"] = duplicate_result

    # Overall result
    all_passed = all(
        check.get("valid") or check.get("passed")
        for check in results["checks"].values()
    )

    results["overall"] = {
        "passed": all_passed,
        "total_checks": len(results["checks"]),
        "passed_checks": sum(
            1 for check in results["checks"].values()
            if check.get("valid") or check.get("passed")
        )
    }

    # Print summary
    print("\n" + "="*50)
    if all_passed:
        print("✅ All validation checks passed")
    else:
        print("❌ Validation failed")
        for name, check in results["checks"].items():
            if not (check.get("valid") or check.get("passed")):
                print(f"   - {name}: {check.get('error') or check.get('warning')}")

    return results
```

---

## Pre-Deployment Checklist

```bash
# Run before deploying to production

cd backend

# 1. Backup current data
poetry run python scripts/backup_golden_dataset.py backup

# 2. Verify backup integrity
poetry run python scripts/backup_golden_dataset.py verify

# 3. Run retrieval quality tests
poetry run pytest tests/integration/test_retrieval_quality.py

# 4. Check for regressions
# Expected: 91.6% pass rate, 0.777 MRR
# If lower, investigate before deploying
```

---

## Automated Validation (CI)

```yaml
# .github/workflows/validate-golden-dataset.yml
name: Validate Golden Dataset

on:
  pull_request:
    paths:
      - 'backend/data/golden_dataset_backup.json'
  schedule:
    - cron: '0 8 * * 1'  # Weekly on Monday 8am

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          poetry install

      - name: Start PostgreSQL
        run: docker compose up -d postgres

      - name: Run migrations
        run: |
          cd backend
          poetry run alembic upgrade head

      - name: Restore golden dataset
        run: |
          cd backend
          poetry run python scripts/backup_golden_dataset.py restore

      - name: Validate dataset
        run: |
          cd backend
          poetry run python scripts/backup_golden_dataset.py verify

      - name: Run retrieval tests
        run: |
          cd backend
          poetry run pytest tests/integration/test_retrieval_quality.py -v
```

---

## References

- OrchestKit: `backend/scripts/backup_golden_dataset.py`
- OrchestKit: `backend/tests/integration/test_retrieval_quality.py`
