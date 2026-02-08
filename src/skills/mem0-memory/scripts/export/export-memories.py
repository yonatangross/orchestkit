#!/usr/bin/env python3
"""
Create structured export of memories.
Usage: ./export-memories.py --user-id "project-decisions" [--schema "json"]
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
    parser = argparse.ArgumentParser(description="Create mem0 memory export")
    parser.add_argument("--user-id", help="User ID to export (optional, use filters instead)")
    parser.add_argument("--filters", default="{}", help="JSON filters for export (required by API)")
    parser.add_argument("--schema", default='{"format":"json"}', help="Export schema JSON object (default: {\"format\":\"json\"})")
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

        # Parse schema - API expects JSON object
        try:
            schema_obj = json.loads(args.schema) if args.schema else {"format": "json"}
        except json.JSONDecodeError:
            schema_obj = {"format": args.schema}

        # Build filter conditions from flags and --filters JSON
        filter_conditions = []
        extra_filters = json.loads(args.filters) if args.filters else {}

        if args.user_id:
            filter_conditions.append({"user_id": args.user_id})
        for key in ["user_id", "agent_id", "run_id", "app_id", "memory_export_id"]:
            if key in extra_filters:
                filter_conditions.append({key: extra_filters[key]})

        if not filter_conditions:
            raise ValueError("Filters must include one of: user_id, agent_id, run_id, app_id, or memory_export_id")

        # Export API requires AND operator format: {"AND": [{...}, ...]}
        result = client.create_memory_export(
            schema=schema_obj,
            filters={"AND": filter_conditions}
        )

        # Response is an async job: {"message": "...", "id": "export-id"}
        export_id = None
        if isinstance(result, dict):
            export_id = result.get("id") or result.get("export_id")

        print(json.dumps({
            "success": True,
            "export_id": export_id,
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
