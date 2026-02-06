#!/usr/bin/env python3
"""
Bulk metadata migration for mem0 memories.
Usage: ./migrate-metadata.py --old-key "category" --new-key "type" --filters '{"user_id":"..."}'
"""
import argparse
import json
import sys
from pathlib import Path

# Add lib directory to path
_SCRIPT_DIR = Path(__file__).parent
_LIB_DIR = _SCRIPT_DIR.parent / "lib"
if str(_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(_LIB_DIR))
from mem0_client import get_mem0_client  # type: ignore  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Bulk metadata migration for mem0 memories")
    parser.add_argument("--old-key", required=True, help="Old metadata key to migrate")
    parser.add_argument("--new-key", required=True, help="New metadata key name")
    parser.add_argument("--filters", default="{}", help="JSON filters to select memories")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without updating")
    parser.add_argument("--api-key", help="Or use MEM0_API_KEY env")
    parser.add_argument("--org-id", help="Or use MEM0_ORG_ID env")
    parser.add_argument("--project-id", help="Or use MEM0_PROJECT_ID env")
    args = parser.parse_args()

    try:
        client = get_mem0_client(
            api_key=args.api_key,
            org_id=args.org_id,
            project_id=args.project_id
        )

        # Parse filters
        filters = json.loads(args.filters) if args.filters else {}
        
        # Get memories matching filters
        # Use search or get_memories to find memories to migrate
        if filters:
            # Search for memories with the old key in metadata
            search_result = client.search(
                query="",  # Empty query to get all
                filters=filters,
                limit=1000  # Max batch size
            )
            memories = search_result.get("results", [])
        else:
            # Get all memories (may be limited)
            memories_result = client.get_memories(filters=filters)
            memories = memories_result.get("memories", memories_result.get("results", []))

        # Filter memories that have the old key
        memories_to_migrate = []
        for memory in memories:
            metadata = memory.get("metadata", {})
            if args.old_key in metadata:
                memories_to_migrate.append(memory)

        if not memories_to_migrate:
            print(json.dumps({
                "success": True,
                "message": "No memories found with old key",
                "count": 0
            }, indent=2))
            return

        if args.dry_run:
            print(json.dumps({
                "success": True,
                "dry_run": True,
                "count": len(memories_to_migrate),
                "migrations": [
                    {
                        "memory_id": m.get("id"),
                        "old_value": m.get("metadata", {}).get(args.old_key),
                        "new_key": args.new_key
                    }
                    for m in memories_to_migrate
                ]
            }, indent=2))
            return

        # Perform batch update
        batch_updates = []
        for memory in memories_to_migrate:
            memory_id = memory.get("id")
            metadata = memory.get("metadata", {}).copy()
            old_value = metadata.pop(args.old_key)
            metadata[args.new_key] = old_value
            
            batch_updates.append({
                "memory_id": memory_id,
                "metadata": metadata
            })

        # Use batch-update if available
        if hasattr(client, 'batch_update'):
            result = client.batch_update(memories=batch_updates)
        else:
            # Fallback: individual updates
            updated = 0
            for update in batch_updates:
                try:
                    client.update(
                        memory_id=update["memory_id"],
                        metadata=update["metadata"]
                    )
                    updated += 1
                except Exception as e:
                    print(f"Error updating {update['memory_id']}: {e}", file=sys.stderr)
            
            result = {"updated": updated, "total": len(batch_updates)}

        print(json.dumps({
            "success": True,
            "count": len(memories_to_migrate),
            "migrated": result.get("updated", len(memories_to_migrate)),
            "result": result
        }, indent=2))

    except ValueError as e:
        print(json.dumps({
            "error": str(e),
            "type": "ValueError"
        }, indent=2), file=sys.stderr)
        sys.exit(1)
    except ImportError as e:
        print(json.dumps({
            "error": str(e),
            "type": "ImportError"
        }, indent=2), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "type": type(e).__name__
        }, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
