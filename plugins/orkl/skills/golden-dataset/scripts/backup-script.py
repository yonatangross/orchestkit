"""
Production-ready golden dataset backup/restore script.

Usage:
    python scripts/backup_golden_dataset.py backup
    python scripts/backup_golden_dataset.py verify
    python scripts/backup_golden_dataset.py restore [--replace]

Features:
- JSON backup (version controlled)
- Regenerate embeddings on restore
- URL contract validation
- Comprehensive verification
"""

import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import structlog
from app.db.models import Analysis, Artifact, Chunk
from app.db.session import get_session
from app.shared.services.embeddings import embed_text
from sqlalchemy import delete, func, select

logger = structlog.get_logger()

# ============================================================================
# CONFIGURATION
# ============================================================================

BACKUP_DIR = Path(__file__).parent.parent / "data"
BACKUP_FILE = BACKUP_DIR / "golden_dataset_backup.json"
METADATA_FILE = BACKUP_DIR / "golden_dataset_metadata.json"


# ============================================================================
# BACKUP
# ============================================================================

async def backup_golden_dataset():
    """Export golden dataset to JSON."""

    logger.info("backup_started")

    async with get_session() as session:
        # Fetch all completed analyses
        query = (
            select(Analysis)
            .where(Analysis.status == "completed")
            .order_by(Analysis.created_at)
        )
        result = await session.execute(query)
        analyses = result.scalars().all()

        # Fetch related data
        for analysis in analyses:
            await session.refresh(analysis, ["chunks", "artifact"])

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

        # Write backup file
        BACKUP_DIR.mkdir(exist_ok=True)
        with open(BACKUP_FILE, "w") as f:
            json.dump(backup_data, f, indent=2, default=str)

        # Write metadata (quick stats)
        with open(METADATA_FILE, "w") as f:
            json.dump(backup_data["metadata"], f, indent=2)

        logger.info(
            "backup_completed",
            analyses=backup_data["metadata"]["total_analyses"],
            chunks=backup_data["metadata"]["total_chunks"],
            file=str(BACKUP_FILE)
        )

        print(f"\n✅ Backup completed: {BACKUP_FILE}")
        print(f"   Analyses: {backup_data['metadata']['total_analyses']}")
        print(f"   Chunks: {backup_data['metadata']['total_chunks']}")
        print(f"   Artifacts: {backup_data['metadata']['total_artifacts']}")


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


def serialize_finding(finding: dict) -> dict:
    """Serialize finding."""
    return {
        "agent": finding.get("agent"),
        "category": finding.get("category"),
        "content": finding.get("content"),
        "confidence": finding.get("confidence"),
        "metadata": finding.get("metadata", {})
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
        # embedding excluded - regenerated on restore
    }


def serialize_artifact(artifact: Artifact) -> dict:
    """Serialize artifact."""
    return {
        "id": str(artifact.id),
        "summary": artifact.summary,
        "key_findings": artifact.key_findings,
        "metadata": artifact.metadata
    }


# ============================================================================
# RESTORE
# ============================================================================

async def restore_golden_dataset(replace: bool = False):
    """Restore golden dataset from JSON backup."""

    logger.info("restore_started", replace=replace)

    # Load backup file
    if not BACKUP_FILE.exists():
        print(f"❌ Backup file not found: {BACKUP_FILE}")
        return False

    with open(BACKUP_FILE) as f:
        backup_data = json.load(f)

    # Validate structure
    required_keys = ["version", "created_at", "metadata", "analyses"]
    for key in required_keys:
        if key not in backup_data:
            print(f"❌ Invalid backup: missing '{key}'")
            return False

    print(f"\n📦 Loading backup from {backup_data['created_at']}")
    print(f"   Analyses: {backup_data['metadata']['total_analyses']}")
    print(f"   Chunks: {backup_data['metadata']['total_chunks']}")

    async with get_session() as session:
        # Clear existing data if replace mode
        if replace:
            print("\n⚠️  Deleting existing data...")
            await session.execute(delete(Chunk))
            await session.execute(delete(Artifact))
            await session.execute(delete(Analysis))
            await session.commit()
            print("✅ Existing data cleared")

        # Restore analyses and chunks
        print("\n📥 Restoring data...")
        total_chunks = 0
        total_analyses = len(backup_data["analyses"])

        for idx, analysis_data in enumerate(backup_data["analyses"], 1):
            url_preview = analysis_data["url"][:50] + ("..." if len(analysis_data["url"]) > 50 else "")
            print(f"[{idx}/{total_analyses}] {url_preview}")

            # Create analysis
            analysis = Analysis(
                id=UUID(analysis_data["id"]),
                url=analysis_data["url"],
                content_type=analysis_data["content_type"],
                status=analysis_data["status"],
                created_at=datetime.fromisoformat(analysis_data["created_at"])
            )
            # Add findings (stored as JSONB)
            analysis.findings = analysis_data.get("findings", [])
            session.add(analysis)

            # Restore chunks with regenerated embeddings
            for chunk_data in analysis_data["chunks"]:
                # Generate embedding using CURRENT model
                embedding = await embed_text(chunk_data["content"])

                chunk = Chunk(
                    id=UUID(chunk_data["id"]),
                    analysis_id=analysis.id,
                    content=chunk_data["content"],
                    embedding=embedding,  # Freshly generated!
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
                    key_findings=artifact_data.get("key_findings", []),
                    metadata=artifact_data.get("metadata", {})
                )
                session.add(artifact)

            # Commit every 10 analyses (avoid huge transactions)
            if idx % 10 == 0:
                await session.commit()

        # Final commit
        await session.commit()

        print("\n✅ Restore completed:")
        print(f"   Analyses: {total_analyses}")
        print(f"   Chunks: {total_chunks} (embeddings regenerated)")

        # Verify counts
        actual_analyses = await session.scalar(select(func.count(Analysis.id)))
        actual_chunks = await session.scalar(select(func.count(Chunk.id)))

        if actual_analyses != backup_data["metadata"]["total_analyses"]:
            print(f"⚠️  Count mismatch: analyses {actual_analyses} vs {backup_data['metadata']['total_analyses']}")
        if actual_chunks != backup_data["metadata"]["total_chunks"]:
            print(f"⚠️  Count mismatch: chunks {actual_chunks} vs {backup_data['metadata']['total_chunks']}")

        logger.info(
            "restore_completed",
            analyses=actual_analyses,
            chunks=actual_chunks
        )

    return True


# ============================================================================
# VERIFICATION
# ============================================================================

async def verify_golden_dataset():
    """Verify golden dataset integrity."""

    logger.info("verify_started")

    if not BACKUP_FILE.exists():
        print(f"❌ Backup file not found: {BACKUP_FILE}")
        return False

    # Load expected metadata
    with open(METADATA_FILE) as f:
        expected_metadata = json.load(f)

    print("\n🔍 Validating golden dataset...\n")

    errors = []
    warnings = []

    async with get_session() as session:
        # 1. Check counts
        print("1. Checking counts...")
        analysis_count = await session.scalar(select(func.count(Analysis.id)))
        chunk_count = await session.scalar(select(func.count(Chunk.id)))
        artifact_count = await session.scalar(select(func.count(Artifact.id)))

        if analysis_count != expected_metadata["total_analyses"]:
            errors.append(f"Analysis count: {analysis_count} vs {expected_metadata['total_analyses']}")
        if chunk_count != expected_metadata["total_chunks"]:
            errors.append(f"Chunk count: {chunk_count} vs {expected_metadata['total_chunks']}")

        print(f"   Analyses: {analysis_count} (expected: {expected_metadata['total_analyses']})")
        print(f"   Chunks: {chunk_count} (expected: {expected_metadata['total_chunks']})")
        print(f"   Artifacts: {artifact_count}")

        # 2. Check URL contract
        print("\n2. Checking URL contract...")
        query = select(Analysis).where(
            Analysis.url.like("%orchestkit.dev%") |
            Analysis.url.like("%placeholder%")
        )
        result = await session.execute(query)
        invalid_urls = result.scalars().all()

        if invalid_urls:
            errors.append(f"Found {len(invalid_urls)} analyses with placeholder URLs")
            for analysis in invalid_urls[:5]:  # Show first 5
                print(f"   ❌ {analysis.id}: {analysis.url}")
        else:
            print("   ✅ All URLs are canonical")

        # 3. Check embeddings
        print("\n3. Checking embeddings...")
        query = select(Chunk).where(Chunk.embedding.is_(None))
        result = await session.execute(query)
        missing_embeddings = result.scalars().all()

        if missing_embeddings:
            errors.append(f"Found {len(missing_embeddings)} chunks without embeddings")
        else:
            print("   ✅ All chunks have embeddings")

        # 4. Check for orphaned chunks
        print("\n4. Checking for orphaned data...")
        query = select(Chunk).outerjoin(Analysis).where(Analysis.id.is_(None))
        result = await session.execute(query)
        orphaned = result.scalars().all()

        if orphaned:
            warnings.append(f"Found {len(orphaned)} orphaned chunks")
        else:
            print("   ✅ No orphaned data")

    # Summary
    print("\n" + "="*50)
    if not errors:
        print("✅ All validation checks passed")
        if warnings:
            print(f"\n⚠️  {len(warnings)} warnings:")
            for warning in warnings:
                print(f"   - {warning}")
        logger.info("verify_completed", result="passed", warnings=len(warnings))
        return True
    else:
        print(f"❌ Validation failed with {len(errors)} errors:")
        for error in errors:
            print(f"   - {error}")
        logger.error("verify_failed", errors=errors)
        return False


# ============================================================================
# CLI
# ============================================================================

def main():
    """CLI entry point."""

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python backup_golden_dataset.py backup")
        print("  python backup_golden_dataset.py verify")
        print("  python backup_golden_dataset.py restore [--replace]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "backup":
        asyncio.run(backup_golden_dataset())
    elif command == "verify":
        success = asyncio.run(verify_golden_dataset())
        sys.exit(0 if success else 1)
    elif command == "restore":
        replace = "--replace" in sys.argv
        success = asyncio.run(restore_golden_dataset(replace=replace))
        sys.exit(0 if success else 1)
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
