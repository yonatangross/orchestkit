---
title: Dataset Versioning
impact: HIGH
impactDescription: "Without proper versioning and restore procedures, golden datasets cannot be reliably reproduced across environments or recovered after failures"
tags: versioning, backup, restore, embeddings, disaster-recovery
---

## Dataset Versioning

JSON backup format, embedding regeneration, and disaster recovery patterns.

**Backup Format:**
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
      "chunks": [
        {
          "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
          "content": "asyncio is a library...",
          "section_title": "Introduction to asyncio"
        }
      ]
    }
  ]
}
```

**Key design decisions:**
- Embeddings excluded (regenerate on restore with current model)
- Nested structure (analyses -> chunks -> artifacts)
- Metadata for validation
- ISO timestamps for reproducibility

**Restore with Embedding Regeneration:**
```python
async def restore_golden_dataset(replace: bool = False):
    """Restore golden dataset from JSON backup."""

    with open(BACKUP_FILE) as f:
        backup_data = json.load(f)

    async with get_session() as session:
        if replace:
            await session.execute(delete(Chunk))
            await session.execute(delete(Artifact))
            await session.execute(delete(Analysis))
            await session.commit()

        from app.shared.services.embeddings import embed_text

        for analysis_data in backup_data["analyses"]:
            analysis = Analysis(
                id=UUID(analysis_data["id"]),
                url=analysis_data["url"],
            )
            session.add(analysis)

            for chunk_data in analysis_data["chunks"]:
                # Regenerate embedding using CURRENT model
                embedding = await embed_text(chunk_data["content"])

                chunk = Chunk(
                    id=UUID(chunk_data["id"]),
                    analysis_id=analysis.id,
                    content=chunk_data["content"],
                    embedding=embedding,  # Freshly generated!
                )
                session.add(chunk)

            if idx % 10 == 0:
                await session.commit()

        await session.commit()
```

**Why regenerate embeddings?**
- Embedding models improve over time (Voyage AI v1 -> v2)
- Ensures consistency with current production model
- Smaller backup files (exclude large vectors)

**Disaster Recovery Scenarios:**

| Scenario | Steps |
|----------|-------|
| Accidental deletion | `restore --replace` -> `verify` -> run tests |
| Migration failure | `alembic downgrade -1` -> `restore --replace` -> fix migration |
| New environment | Clone repo -> setup DB -> `restore` -> run tests |

**CLI Commands:**
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

**Incorrect — Storing embeddings in backup:**
```python
# Embedding vectors bloat backup file
backup_data = {
    "chunks": [{
        "content": "...",
        "embedding": [0.123, 0.456, ...],  # 1024 floats!
    }]
}
```

**Correct — Regenerate embeddings on restore:**
```python
# Exclude embeddings from backup
backup_data = {
    "chunks": [{
        "content": "...",
        # No embedding field
    }]
}

# Regenerate during restore
embedding = await embed_text(chunk_data["content"])
chunk.embedding = embedding  # Fresh with current model
```

**Key rules:**
- Always regenerate embeddings on restore -- never store them in backup
- Commit backups every 10 analyses to avoid huge transactions
- Verify counts match metadata after every restore
- Test restore procedures in staging before production
