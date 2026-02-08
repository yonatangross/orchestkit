#!/usr/bin/env python3
"""
Batch Sync Script - Upload queued decisions/preferences to mem0 cloud

Part of Intelligent Decision Capture System

Usage:
    python batch-sync.py                    # Sync default queue
    python batch-sync.py --dry-run          # Show what would be synced
    python batch-sync.py --limit 100        # Sync at most 100 records
    python batch-sync.py --user-id global   # Only sync global best practices

Requires: MEM0_API_KEY environment variable

Storage paths:
    Input:  .claude/memory/mem0-queue.jsonl (queued records)
    Output: .claude/memory/mem0-synced.jsonl (successful syncs)
    Errors: .claude/memory/mem0-errors.jsonl (failed syncs)
"""

import os
import sys
import json
import argparse
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator

# Check for mem0 API key early
MEM0_API_KEY = os.environ.get("MEM0_API_KEY")


def get_project_dir() -> Path:
    """Get project directory from env or cwd."""
    return Path(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))


def get_queue_path() -> Path:
    """Get path to mem0 queue file."""
    return get_project_dir() / ".claude" / "memory" / "mem0-queue.jsonl"


def get_synced_path() -> Path:
    """Get path to synced records file."""
    return get_project_dir() / ".claude" / "memory" / "mem0-synced.jsonl"


def get_errors_path() -> Path:
    """Get path to error records file."""
    return get_project_dir() / ".claude" / "memory" / "mem0-errors.jsonl"


def read_queue(
    queue_path: Path,
    user_id_filter: str | None = None,
    limit: int | None = None,
) -> Generator[dict[str, Any], None, None]:
    """Read records from queue file, optionally filtering by user_id."""
    if not queue_path.exists():
        return

    count = 0
    with open(queue_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            try:
                record = json.loads(line)

                # Filter by user_id if specified
                if user_id_filter:
                    record_user = record.get("user_id", "")
                    if user_id_filter == "global":
                        if not record_user.startswith("orchestkit-global"):
                            continue
                    elif user_id_filter != record_user:
                        continue

                yield record
                count += 1

                if limit and count >= limit:
                    return

            except json.JSONDecodeError:
                continue


def append_to_file(path: Path, record: dict[str, Any]) -> None:
    """Append a record to a JSONL file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a") as f:
        f.write(json.dumps(record) + "\n")


def sync_to_mem0(record: dict[str, Any], dry_run: bool = False) -> tuple[bool, str]:
    """
    Sync a single record to mem0 cloud.

    Returns: (success, message)
    """
    if dry_run:
        return True, "dry-run"

    if not MEM0_API_KEY:
        return False, "MEM0_API_KEY not set"

    try:
        # Import mem0 here to avoid dependency issues if not installed
        from mem0 import MemoryClient

        client = MemoryClient(api_key=MEM0_API_KEY)

        # Extract data from record
        text = record.get("text", "")
        user_id = record.get("user_id", "unknown")
        metadata = record.get("metadata", {})

        if not text:
            return False, "empty text"

        # Add memory to mem0
        result = client.add(
            messages=[{"role": "user", "content": text}],
            user_id=user_id,
            metadata=metadata,
        )

        # Return success with memory ID
        memory_ids = [m.get("id", "unknown") for m in result.get("results", [])]
        return True, f"created: {','.join(memory_ids)}"

    except ImportError:
        return False, "mem0 package not installed (pip install mem0ai)"
    except Exception as e:
        return False, str(e)


def sync_batch(
    records: list[dict[str, Any]],
    dry_run: bool = False,
    delay_ms: int = 100,
) -> dict[str, int]:
    """
    Sync a batch of records to mem0.

    Returns: {"synced": N, "failed": M, "skipped": K}
    """
    stats = {"synced": 0, "failed": 0, "skipped": 0}
    synced_path = get_synced_path()
    errors_path = get_errors_path()

    for i, record in enumerate(records):
        timestamp = datetime.now(timezone.utc).isoformat()

        success, message = sync_to_mem0(record, dry_run)

        if success:
            stats["synced"] += 1
            # Record success
            append_to_file(synced_path, {
                **record,
                "synced_at": timestamp,
                "sync_message": message,
            })
            if not dry_run:
                print(f"  [{i+1}/{len(records)}] OK {record.get('user_id', 'unknown')}: {message}")
        else:
            stats["failed"] += 1
            # Record failure
            append_to_file(errors_path, {
                **record,
                "error_at": timestamp,
                "error_message": message,
            })
            if not dry_run:
                print(f"  [{i+1}/{len(records)}] FAIL {record.get('user_id', 'unknown')}: {message}")

        # Rate limiting
        if delay_ms > 0 and not dry_run and i < len(records) - 1:
            time.sleep(delay_ms / 1000)

    return stats


def rewrite_queue_without_synced(queue_path: Path, synced_records: set[str]) -> int:
    """Remove synced records from queue file. Returns count removed."""
    if not queue_path.exists():
        return 0

    # Read all lines
    with open(queue_path, "r") as f:
        lines = f.readlines()

    # Filter out synced records
    remaining = []
    removed = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            record = json.loads(line)
            # Create a unique key for the record
            key = f"{record.get('text', '')[:50]}_{record.get('queued_at', '')}"
            if key not in synced_records:
                remaining.append(line)
            else:
                removed += 1
        except json.JSONDecodeError:
            remaining.append(line)  # Keep unparseable lines

    # Rewrite queue
    with open(queue_path, "w") as f:
        for line in remaining:
            f.write(line + "\n")

    return removed


def main():
    parser = argparse.ArgumentParser(
        description="Sync queued decisions/preferences to mem0 cloud"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be synced without actually syncing",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of records to sync",
    )
    parser.add_argument(
        "--user-id",
        type=str,
        default=None,
        help="Filter by user_id (use 'global' for orchestkit-global-*)",
    )
    parser.add_argument(
        "--delay",
        type=int,
        default=100,
        help="Delay between API calls in milliseconds (default: 100)",
    )
    parser.add_argument(
        "--clean-queue",
        action="store_true",
        help="Remove synced records from queue after successful sync",
    )
    args = parser.parse_args()

    # Check API key unless dry run
    if not args.dry_run and not MEM0_API_KEY:
        print("Error: MEM0_API_KEY environment variable not set")
        print("Set it with: export MEM0_API_KEY=your-api-key")
        sys.exit(1)

    queue_path = get_queue_path()

    if not queue_path.exists():
        print(f"No queue file found at {queue_path}")
        sys.exit(0)

    # Read records
    records = list(read_queue(queue_path, args.user_id, args.limit))

    if not records:
        print("No records to sync" + (f" (filter: user_id={args.user_id})" if args.user_id else ""))
        sys.exit(0)

    print(f"Found {len(records)} records to sync")

    if args.dry_run:
        print("\nDry run - records that would be synced:")
        for i, record in enumerate(records[:10]):  # Show first 10
            user_id = record.get("user_id", "unknown")
            text = record.get("text", "")[:60] + "..." if len(record.get("text", "")) > 60 else record.get("text", "")
            print(f"  {i+1}. [{user_id}] {text}")
        if len(records) > 10:
            print(f"  ... and {len(records) - 10} more")
        sys.exit(0)

    # Sync
    print(f"\nSyncing to mem0 cloud...")
    stats = sync_batch(records, dry_run=False, delay_ms=args.delay)

    print(f"\nResults: {stats['synced']} synced, {stats['failed']} failed")

    # Clean queue if requested
    if args.clean_queue and stats["synced"] > 0:
        synced_keys = set()
        for record in records:
            key = f"{record.get('text', '')[:50]}_{record.get('queued_at', '')}"
            synced_keys.add(key)
        removed = rewrite_queue_without_synced(queue_path, synced_keys)
        print(f"Removed {removed} synced records from queue")


if __name__ == "__main__":
    main()
