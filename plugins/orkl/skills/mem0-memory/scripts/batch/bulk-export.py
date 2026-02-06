#!/usr/bin/env python3
"""
Bulk export multiple user_ids from mem0.
Usage: ./bulk-export.py --user-ids "user1,user2,user3" --schema '{"format":"json"}'
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
    parser = argparse.ArgumentParser(description="Bulk export multiple user_ids from mem0")
    parser.add_argument("--user-ids", required=True, help="Comma-separated list of user IDs")
    parser.add_argument("--schema", default='{"format":"json"}', help="Export schema JSON object")
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

        # Parse user IDs
        user_ids = [uid.strip() for uid in args.user_ids.split(",")]
        
        # Parse schema
        try:
            schema_obj = json.loads(args.schema) if args.schema else {"format": "json"}
        except json.JSONDecodeError:
            schema_obj = {"format": args.schema}

        # Create exports for each user_id
        exports = []
        for user_id in user_ids:
            try:
                # Create export with filters for this user_id
                result = client.create_memory_export(
                    schema=json.dumps(schema_obj) if isinstance(schema_obj, dict) else str(schema_obj),
                    user_id=user_id
                )
                exports.append({
                    "user_id": user_id,
                    "export_id": result.get("export_id") if isinstance(result, dict) else None,
                    "status": "created",
                    "result": result
                })
            except Exception as e:
                exports.append({
                    "user_id": user_id,
                    "status": "error",
                    "error": str(e)
                })

        print(json.dumps({
            "success": True,
            "count": len(user_ids),
            "exports": exports
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
