# Versioning and Recovery

Restore procedures, validation, and disaster recovery patterns.

## Restore Implementation

### Process Overview

1. **Load JSON backup**
2. **Validate structure** (version, required fields)
3. **Create analyses** (without embeddings yet)
4. **Create chunks** (without embeddings yet)
5. **Generate embeddings** (using current embedding model)
6. **Create artifacts**
7. **Verify integrity** (counts, URL contract)

### Regenerating Embeddings

```python
async def restore_golden_dataset(replace: bool = False):
    """Restore golden dataset from JSON backup."""

    # Load backup
    with open(BACKUP_FILE) as f:
        backup_data = json.load(f)

    async with get_session() as session:
        if replace:
            # Delete existing data
            await session.execute(delete(Chunk))
            await session.execute(delete(Artifact))
            await session.execute(delete(Analysis))
            await session.commit()

        # Restore analyses and chunks
        from app.shared.services.embeddings import embed_text

        for analysis_data in backup_data["analyses"]:
            # Create analysis
            analysis = Analysis(
                id=UUID(analysis_data["id"]),
                url=analysis_data["url"],
                # ... other fields ...
            )
            session.add(analysis)

            # Create chunks with regenerated embeddings
            for chunk_data in analysis_data["chunks"]:
                # Regenerate embedding using CURRENT model
                embedding = await embed_text(chunk_data["content"])

                chunk = Chunk(
                    id=UUID(chunk_data["id"]),
                    analysis_id=analysis.id,
                    content=chunk_data["content"],
                    embedding=embedding,  # Freshly generated!
                    # ... other fields ...
                )
                session.add(chunk)

            await session.commit()

        print("Restore completed")
```

**Why regenerate embeddings?**
- Embedding models improve over time
- Ensures consistency with current model
- Smaller backup files (exclude large vectors)

## Validation

### Validation Checklist

```python
async def verify_golden_dataset() -> dict:
    """Verify golden dataset integrity."""

    errors = []
    warnings = []

    async with get_session() as session:
        # 1. Check counts
        analysis_count = await session.scalar(select(func.count(Analysis.id)))
        chunk_count = await session.scalar(select(func.count(Chunk.id)))
        artifact_count = await session.scalar(select(func.count(Artifact.id)))

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

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "stats": {
                "analyses": analysis_count,
                "chunks": chunk_count,
                "artifacts": artifact_count
            }
        }
```

## Best Practices

### 1. Version Control Backups

```bash
# Commit backups to git
git add backend/data/golden_dataset_backup.json
git commit -m "chore: golden dataset backup (98 analyses, 415 chunks)"
```

### 2. Validate Before Deployment

```bash
# Pre-deployment check
poetry run python scripts/backup_golden_dataset.py verify

# Should output:
# Validation passed
#    Analyses: 98
#    Chunks: 415
#    Artifacts: 98
#    No errors found
```

### 3. Test Restore in Staging

```bash
# Never test restore in production first!

# Staging environment
export DATABASE_URL=$STAGING_DATABASE_URL
poetry run python scripts/backup_golden_dataset.py restore --replace

# Run tests to verify
poetry run pytest tests/integration/test_retrieval_quality.py
```

### 4. Document Changes

```json
// backend/data/golden_dataset_metadata.json
{
  "total_analyses": 98,
  "total_chunks": 415,
  "last_updated": "2025-12-19T10:30:00Z",
  "changes": [
    {
      "date": "2025-12-19",
      "action": "added",
      "count": 5,
      "description": "Added 5 new LangGraph tutorial analyses"
    },
    {
      "date": "2025-12-10",
      "action": "removed",
      "count": 2,
      "description": "Removed 2 outdated React 17 analyses"
    }
  ]
}
```

## Disaster Recovery

### Scenario 1: Accidental Deletion

```bash
# Oh no! Someone ran DELETE FROM analyses WHERE 1=1

# 1. Restore from backup
poetry run python scripts/backup_golden_dataset.py restore --replace

# 2. Verify
poetry run python scripts/backup_golden_dataset.py verify

# 3. Run tests
poetry run pytest tests/integration/test_retrieval_quality.py
```

### Scenario 2: Database Migration Gone Wrong

```bash
# Migration corrupted data

# 1. Rollback migration
alembic downgrade -1

# 2. Restore from backup
poetry run python scripts/backup_golden_dataset.py restore --replace

# 3. Re-run migration (fixed)
alembic upgrade head
```

### Scenario 3: New Environment Setup

```bash
# Fresh dev environment, need golden dataset

# 1. Clone repo (includes backup)
git clone https://github.com/your-org/orchestkit
cd orchestkit/backend

# 2. Setup DB
docker compose up -d postgres
alembic upgrade head

# 3. Restore golden dataset
poetry run python scripts/backup_golden_dataset.py restore

# 4. Verify
poetry run pytest tests/integration/test_retrieval_quality.py
```

## Data Integrity Contracts

### The URL Contract

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

**Verification:**
```python
# Check for placeholder URLs
def verify_url_contract(analyses: list[Analysis]) -> list[str]:
    """Find analyses with placeholder URLs."""
    invalid = []
    for analysis in analyses:
        if "orchestkit.dev" in analysis.url or "placeholder" in analysis.url:
            invalid.append(analysis.id)
    return invalid
```