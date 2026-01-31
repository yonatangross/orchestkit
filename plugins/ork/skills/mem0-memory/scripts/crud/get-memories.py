#!/usr/bin/env python3
"""
Get all memories from mem0 with optional filters.
Usage: ./get-memories.py [--user-id "scope"] [--filters '{"key":"value"}']
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
    parser = argparse.ArgumentParser(description="Get all mem0 memories")
    parser.add_argument("--user-id", help="Filter by user_id")
    parser.add_argument("--agent-id", help="Filter by agent_id")
    parser.add_argument("--filters", default="{}", help="JSON filters")
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

        filters = json.loads(args.filters) if args.filters else {}
        if args.user_id:
            filters["user_id"] = args.user_id
        if args.agent_id:
            filters["agent_id"] = args.agent_id

        result = client.get_all(filters=filters if filters else None)

        # Handle both list and dict response formats from mem0 API
        if isinstance(result, dict):
            memories = result.get("results", result.get("memories", []))
            count = result.get("count", len(memories))
        elif isinstance(result, list):
            memories = result
            count = len(memories)
        else:
            memories = []
            count = 0

        print(json.dumps({
            "success": True,
            "count": count,
            "memories": memories
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
