# Storage Patterns

Backup strategies and storage formats for golden datasets.

## Backup Strategies

### Strategy 1: JSON Backup (Recommended)

**Pros:**
- Version controlled (commit to git)
- Human-readable (easy to inspect)
- Portable (works across DB versions)
- Incremental diffs (see what changed)

**Cons:**
- Must regenerate embeddings on restore
- Larger file size than SQL dump

**SkillForge uses JSON backup.**

### Strategy 2: SQL Dump

**Pros:**
- Fast restore (includes embeddings)
- Exact replica (binary-identical)
- Native PostgreSQL format

**Cons:**
- Not version controlled (binary format)
- DB version dependent
- No easy inspection

**Use case:** Local snapshots, not version control.

## Backup Format

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
- Nested structure (analyses -> chunks -> artifacts)
- Metadata for validation
- ISO timestamps for reproducibility

## Backup Implementation

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

        print(f"Backup completed: {BACKUP_FILE}")
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