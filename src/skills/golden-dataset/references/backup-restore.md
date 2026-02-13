# Backup & Restore Golden Dataset

## Backup Process

### 1. Export to JSON

```python
# backend/scripts/backup_golden_dataset.py backup

async def backup_golden_dataset():
    """Export golden dataset to JSON."""

    async with get_session() as session:
        # Fetch all completed analyses
        query = (
            select(Analysis)
            .where(Analysis.status == "completed")
            .options(
                selectinload(Analysis.chunks),
                selectinload(Analysis.artifact)
            )
            .order_by(Analysis.created_at)
        )
        result = await session.execute(query)
        analyses = result.scalars().all()

        # Serialize
        backup_data = {
            "version": "1.0",
            "created_at": datetime.now(UTC).isoformat(),
            "metadata": {
                "total_analyses": len(analyses),
                "total_chunks": sum(len(a.chunks) for a in analyses),
                "total_artifacts": sum(1 for a in analyses if a.artifact)
            },
            "analyses": [serialize_analysis(a) for a in analyses]
        }

        # Write to file
        BACKUP_FILE.parent.mkdir(exist_ok=True)
        with open(BACKUP_FILE, "w") as f:
            json.dump(backup_data, f, indent=2, default=str)

        # Write metadata (quick stats)
        with open(METADATA_FILE, "w") as f:
            json.dump(backup_data["metadata"], f, indent=2)

        print(f"✅ Backup completed: {len(analyses)} analyses, {backup_data['metadata']['total_chunks']} chunks")
```

### 2. Serialize Without Embeddings

```python
def serialize_chunk(chunk: Chunk) -> dict:
    """Serialize chunk WITHOUT embedding vector."""
    return {
        "id": str(chunk.id),
        "content": chunk.content,
        "section_title": chunk.section_title,
        "section_path": chunk.section_path,
        "content_type": chunk.content_type,
        "chunk_index": chunk.chunk_index
        # embedding excluded - regenerated on restore
    }
```

**Why exclude embeddings?**
- Smaller backup files (415 chunks × 1024 dims × 4 bytes = 1.7 MB saved)
- Model independence (can restore with different model)
- Version control friendly (JSON diffs are meaningful)

---

## Restore Process

### 1. Load and Validate Backup

```python
async def restore_golden_dataset(replace: bool = False):
    """Restore golden dataset from JSON backup."""

    # Load backup file
    if not BACKUP_FILE.exists():
        raise FileNotFoundError(f"Backup file not found: {BACKUP_FILE}")

    with open(BACKUP_FILE) as f:
        backup_data = json.load(f)

    # Validate structure
    required_keys = ["version", "created_at", "metadata", "analyses"]
    for key in required_keys:
        if key not in backup_data:
            raise ValueError(f"Invalid backup: missing '{key}'")

    print(f"📦 Loading backup from {backup_data['created_at']}")
    print(f"   Analyses: {backup_data['metadata']['total_analyses']}")
    print(f"   Chunks: {backup_data['metadata']['total_chunks']}")
```

### 2. Clear Existing Data (Optional)

```python
    async with get_session() as session:
        if replace:
            print("⚠️  Deleting existing data...")

            # Delete in correct order (respect foreign keys)
            await session.execute(delete(Chunk))
            await session.execute(delete(Artifact))
            await session.execute(delete(Analysis))
            await session.commit()

            print("✅ Existing data cleared")
```

### 3. Restore Analyses and Chunks

```python
        from app.shared.services.embeddings import embed_text

        total_chunks = 0

        for idx, analysis_data in enumerate(backup_data["analyses"], 1):
            print(f"[{idx}/{len(backup_data['analyses'])}] Restoring {analysis_data['url'][:50]}...")

            # Create analysis
            analysis = Analysis(
                id=UUID(analysis_data["id"]),
                url=analysis_data["url"],
                content_type=analysis_data["content_type"],
                status=analysis_data["status"],
                created_at=datetime.fromisoformat(analysis_data["created_at"])
                # ... other fields ...
            )
            session.add(analysis)

            # Restore chunks with regenerated embeddings
            for chunk_data in analysis_data["chunks"]:
                # Generate embedding using CURRENT model
                embedding = await embed_text(chunk_data["content"])

                chunk = Chunk(
                    id=UUID(chunk_data["id"]),
                    analysis_id=analysis.id,
                    content=chunk_data["content"],
                    embedding=embedding,  # Freshly generated
                    section_title=chunk_data.get("section_title"),
                    section_path=chunk_data.get("section_path"),
                    content_type=chunk_data["content_type"],
                    chunk_index=chunk_data["chunk_index"]
                )
                session.add(chunk)
                total_chunks += 1

            # Restore artifact
            if analysis_data.get("artifact"):
                artifact_data = analysis_data["artifact"]
                artifact = Artifact(
                    id=UUID(artifact_data["id"]),
                    analysis_id=analysis.id,
                    summary=artifact_data["summary"],
                    # ... other fields ...
                )
                session.add(artifact)

            # Commit every 10 analyses (avoid huge transactions)
            if idx % 10 == 0:
                await session.commit()

        # Final commit
        await session.commit()

        print(f"✅ Restore completed: {len(backup_data['analyses'])} analyses, {total_chunks} chunks")
```

### 4. Verify Restore

```python
        # Verify counts match
        analysis_count = await session.scalar(select(func.count(Analysis.id)))
        chunk_count = await session.scalar(select(func.count(Chunk.id)))

        assert analysis_count == backup_data["metadata"]["total_analyses"]
        assert chunk_count == backup_data["metadata"]["total_chunks"]

        print("✅ Verification passed")
```

---

## CLI Commands

```bash
cd backend

# Backup
poetry run python scripts/backup_golden_dataset.py backup

# Restore (add to existing data)
poetry run python scripts/backup_golden_dataset.py restore

# Restore (replace all data - DESTRUCTIVE!)
poetry run python scripts/backup_golden_dataset.py restore --replace

# Verify backup integrity
poetry run python scripts/backup_golden_dataset.py verify
```

---

## Regenerating Embeddings

**Why regenerate?**
- Embedding models improve over time (Voyage AI v1 → v2)
- Ensures consistency with current production model
- Smaller backup files

**Process:**

```python
from app.shared.services.embeddings import embed_text

async def regenerate_embeddings():
    """Regenerate embeddings for all chunks."""

    async with get_session() as session:
        # Fetch all chunks
        query = select(Chunk).order_by(Chunk.id)
        result = await session.execute(query)
        chunks = result.scalars().all()

        print(f"Regenerating embeddings for {len(chunks)} chunks...")

        for idx, chunk in enumerate(chunks, 1):
            # Generate new embedding
            embedding = await embed_text(chunk.content)

            # Update chunk
            chunk.embedding = embedding

            if idx % 50 == 0:
                await session.commit()
                print(f"  Progress: {idx}/{len(chunks)}")

        await session.commit()
        print("✅ Embeddings regenerated")
```

**Runtime:** ~415 chunks × 200ms = ~83 seconds

---

## SQL Dump (Alternative)

### Create SQL Dump

```bash
# Dump only golden dataset tables
pg_dump $DATABASE_URL \
  --table=analyses \
  --table=chunks \
  --table=artifacts \
  --data-only \
  --file=backend/data/golden_dataset_dump.sql

# ~5 MB for 98 analyses + 415 chunks (includes embeddings)
```

### Restore from SQL Dump

```bash
# Restore SQL dump
psql $DATABASE_URL < backend/data/golden_dataset_dump.sql
```

**Pros:**
- Fast (includes embeddings, no regeneration)
- Exact replica

**Cons:**
- Not version controlled (too large, binary)
- DB version dependent
- No easy inspection

**OrchestKit uses JSON (version controlled), SQL dump for local snapshots only.**

---

## Error Handling

```python
async def restore_with_error_handling():
    """Restore with proper error handling."""

    try:
        await restore_golden_dataset(replace=True)
    except FileNotFoundError as e:
        print(f"❌ Backup file not found: {e}")
        print(f"   Expected: {BACKUP_FILE}")
        return False
    except ValueError as e:
        print(f"❌ Invalid backup format: {e}")
        return False
    except Exception as e:
        print(f"❌ Restore failed: {e}")
        # Rollback handled by async context manager
        return False

    return True
```

---

## References

- OrchestKit: `backend/scripts/backup_golden_dataset.py`
- OrchestKit: `backend/data/golden_dataset_backup.json`
