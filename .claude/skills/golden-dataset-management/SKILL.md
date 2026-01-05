---
name: golden-dataset-management
description: Use when backing up, restoring, or validating golden datasets. Prevents data loss and ensures test data integrity for AI/ML evaluation systems.
version: 1.0.0
author: SkillForge AI Agent Hub
tags: [golden-dataset, backup, data-protection, testing, regression, 2025]
---

# Golden Dataset Management

**Protect and maintain high-quality test datasets for AI/ML systems**

## Overview

A **golden dataset** is a curated collection of high-quality examples used for:
- **Regression testing:** Ensure new code doesn't break existing functionality
- **Retrieval evaluation:** Measure search quality (precision, recall, MRR)
- **Model benchmarking:** Compare different models/approaches
- **Reproducibility:** Consistent results across environments

**When to use this skill:**
- Building test datasets for RAG systems
- Implementing backup/restore for critical data
- Validating data integrity (URL contracts, embeddings)
- Migrating data between environments

---

## SkillForge's Golden Dataset

**Stats (Production):**
- **98 analyses** (completed content analyses)
- **415 chunks** (embedded text segments)
- **203 test queries** (with expected results)
- **91.6% pass rate** (retrieval quality metric)

**Purpose:**
- Test hybrid search (vector + BM25 + RRF)
- Validate metadata boosting strategies
- Detect regressions in retrieval quality
- Benchmark new embedding models

---

## Core Concepts

### 1. Data Integrity Contracts

**The URL Contract:**

Golden dataset analyses MUST store **real canonical URLs**, not placeholders.

```python
# WRONG - Placeholder URL (breaks restore)
analysis.url = "https://skillforge.dev/placeholder/123"

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
        if "skillforge.dev" in analysis.url or "placeholder" in analysis.url:
            invalid.append(analysis.id)
    return invalid
```

---

### 2. Backup Strategies

#### Strategy 1: JSON Backup (Recommended)

**Pros:**
- Version controlled (commit to git)
- Human-readable (easy to inspect)
- Portable (works across DB versions)
- Incremental diffs (see what changed)

**Cons:**
- Must regenerate embeddings on restore
- Larger file size than SQL dump

**SkillForge uses JSON backup.**

#### Strategy 2: SQL Dump

**Pros:**
- Fast restore (includes embeddings)
- Exact replica (binary-identical)
- Native PostgreSQL format

**Cons:**
- Not version controlled (binary format)
- DB version dependent
- No easy inspection

**Use case:** Local snapshots, not version control.

---

### 3. Backup Format

```json
{
  "version": "1.0",
  "created_at": "2025-12-19T10:30:00Z",
  "metadata": {
    "total_analyses": 98,
    "total_chunks": 415,
    "total_artifacts": 98
  },
  "analyses": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://docs.python.org/3/library/asyncio.html",
      "content_type": "documentation",
      "status": "completed",
      "created_at": "2025-11-15T08:20:00Z",
      "findings": [
        {
          "agent": "security_agent",
          "category": "best_practices",
          "content": "Always use asyncio.run() for top-level entry point",
          "confidence": 0.92
        }
      ],
      "chunks": [
        {
          "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
          "content": "asyncio is a library to write concurrent code...",
          "section_title": "Introduction to asyncio",
          "section_path": "docs/python/asyncio/intro.md",
          "content_type": "paragraph",
          "chunk_index": 0
          // Note: embedding NOT included (regenerated on restore)
        }
      ],
      "artifact": {
        "id": "a1b2c3d4-e5f6-4a5b-8c7d-9e8f7a6b5c4d",
        "summary": "Comprehensive guide to asyncio...",
        "key_findings": ["..."],
        "metadata": {}
      }
    }
  ]
}
```

**Key Design Decisions:**
- Embeddings excluded (regenerate on restore with current model)
- Nested structure (analyses → chunks → artifacts)
- Metadata for validation
- ISO timestamps for reproducibility

---

## Backup Implementation

### Script Structure

```python
# backend/scripts/backup_golden_dataset.py

import asyncio
import json
from datetime import datetime, UTC
from pathlib import Path
from sqlalchemy import select
from app.db.session import get_session
from app.db.models import Analysis, Chunk, Artifact

BACKUP_DIR = Path("backend/data")
BACKUP_FILE = BACKUP_DIR / "golden_dataset_backup.json"
METADATA_FILE = BACKUP_DIR / "golden_dataset_metadata.json"

async def backup_golden_dataset():
    """Backup golden dataset to JSON."""

    async with get_session() as session:
        # Fetch all completed analyses
        query = (
            select(Analysis)
            .where(Analysis.status == "completed")
            .order_by(Analysis.created_at)
        )
        result = await session.execute(query)
        analyses = result.scalars().all()

        # Serialize to JSON
        backup_data = {
            "version": "1.0",
            "created_at": datetime.now(UTC).isoformat(),
            "metadata": {
                "total_analyses": len(analyses),
                "total_chunks": sum(len(a.chunks) for a in analyses),
                "total_artifacts": len([a for a in analyses if a.artifact])
            },
            "analyses": [
                serialize_analysis(a) for a in analyses
            ]
        }

        # Write backup file
        BACKUP_DIR.mkdir(exist_ok=True)
        with open(BACKUP_FILE, "w") as f:
            json.dump(backup_data, f, indent=2, default=str)

        # Write metadata file (quick stats)
        with open(METADATA_FILE, "w") as f:
            json.dump(backup_data["metadata"], f, indent=2)

        print(f"✅ Backup completed: {BACKUP_FILE}")
        print(f"   Analyses: {backup_data['metadata']['total_analyses']}")
        print(f"   Chunks: {backup_data['metadata']['total_chunks']}")

def serialize_analysis(analysis: Analysis) -> dict:
    """Serialize analysis to dict."""
    return {
        "id": str(analysis.id),
        "url": analysis.url,
        "content_type": analysis.content_type,
        "status": analysis.status,
        "created_at": analysis.created_at.isoformat(),
        "findings": [serialize_finding(f) for f in analysis.findings],
        "chunks": [serialize_chunk(c) for c in analysis.chunks],
        "artifact": serialize_artifact(analysis.artifact) if analysis.artifact else None
    }

def serialize_chunk(chunk: Chunk) -> dict:
    """Serialize chunk (WITHOUT embedding)."""
    return {
        "id": str(chunk.id),
        "content": chunk.content,
        "section_title": chunk.section_title,
        "section_path": chunk.section_path,
        "content_type": chunk.content_type,
        "chunk_index": chunk.chunk_index
        # embedding excluded (regenerate on restore)
    }
```

**Detailed Implementation:** See `templates/backup-script.py`

---

## Restore Implementation

### Process Overview

1. **Load JSON backup**
2. **Validate structure** (version, required fields)
3. **Create analyses** (without embeddings yet)
4. **Create chunks** (without embeddings yet)
5. **Generate embeddings** (using current embedding model)
6. **Create artifacts**
7. **Verify integrity** (counts, URL contract)

### Key Challenge: Regenerating Embeddings

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

        print("✅ Restore completed")
```

**Why regenerate embeddings?**
- Embedding models improve over time
- Ensures consistency with current model
- Smaller backup files (exclude large vectors)

**Detailed Implementation:** See `references/backup-restore.md`

---

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
            Analysis.url.like("%skillforge.dev%") |
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

**Detailed Validation:** See `references/validation-contracts.md`

---

## CLI Usage

```bash
cd backend

# Backup golden dataset
poetry run python scripts/backup_golden_dataset.py backup

# Verify backup integrity
poetry run python scripts/backup_golden_dataset.py verify

# Restore from backup (WARNING: Deletes existing data)
poetry run python scripts/backup_golden_dataset.py restore --replace

# Restore without deleting (adds to existing)
poetry run python scripts/backup_golden_dataset.py restore
```

---

## CI/CD Integration

### Automated Backups

```yaml
# .github/workflows/backup-golden-dataset.yml
name: Backup Golden Dataset

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday at 2am
  workflow_dispatch:  # Manual trigger

jobs:
  backup:
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

      - name: Run backup
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
        run: |
          cd backend
          poetry run python scripts/backup_golden_dataset.py backup

      - name: Commit backup
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add backend/data/golden_dataset_backup.json
          git add backend/data/golden_dataset_metadata.json
          git commit -m "chore: automated golden dataset backup"
          git push
```

---

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
# ✅ Validation passed
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

---

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
git clone https://github.com/your-org/skillforge
cd skillforge/backend

# 2. Setup DB
docker compose up -d postgres
alembic upgrade head

# 3. Restore golden dataset
poetry run python scripts/backup_golden_dataset.py restore

# 4. Verify
poetry run pytest tests/integration/test_retrieval_quality.py
```

---

## References

### SkillForge Implementation
- `backend/scripts/backup_golden_dataset.py` - Main backup script
- `backend/data/golden_dataset_backup.json` - JSON backup (version controlled)
- `backend/data/golden_dataset_metadata.json` - Quick stats

### Related Skills
- `pgvector-search` - Retrieval evaluation using golden dataset
- `ai-native-development` - Embedding generation for restore
- `devops-deployment` - CI/CD backup automation

---

**Version:** 1.0.0 (December 2025)
**Status:** Production-ready patterns from SkillForge's 98-analysis golden dataset
