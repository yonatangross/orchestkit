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

        # Parse schema - API expects JSON object, not string
        try:
            schema_obj = json.loads(args.schema) if args.schema else {"format": "json"}
        except json.JSONDecodeError:
            # If not valid JSON, treat as format string and wrap in object
            schema_obj = {"format": args.schema}
        
        # Parse filters - API requires filters with user_id, agent_id, run_id, app_id, or memory_export_id
        filters = json.loads(args.filters) if args.filters else {}
        if args.user_id:
            filters["user_id"] = args.user_id
        
        # API requires at least one filter: user_id, agent_id, run_id, app_id, or memory_export_id
        if not filters or not any(key in filters for key in ["user_id", "agent_id", "run_id", "app_id", "memory_export_id"]):
            raise ValueError("Filters must include one of: user_id, agent_id, run_id, app_id, or memory_export_id")
        
        # SDK method signature: create_memory_export(schema: str, **kwargs)
        # But API expects schema as JSON object, so we pass it as JSON string
        # Filters should be passed as kwargs (user_id, agent_id, etc.)
        # Extract filter values and pass as kwargs
        export_kwargs = {}
        if "user_id" in filters:
            export_kwargs["user_id"] = filters["user_id"]
        if "agent_id" in filters:
            export_kwargs["agent_id"] = filters["agent_id"]
        if "run_id" in filters:
            export_kwargs["run_id"] = filters["run_id"]
        if "app_id" in filters:
            export_kwargs["app_id"] = filters["app_id"]
        if "memory_export_id" in filters:
            export_kwargs["memory_export_id"] = filters["memory_export_id"]
        
        # SDK expects schema as string, but API validates it as JSON object
        # Pass as JSON string - SDK/API will handle conversion
        if isinstance(schema_obj, dict):
            schema_str = json.dumps(schema_obj)
        else:
            schema_str = str(schema_obj)
        
        result = client.create_memory_export(schema=schema_str, **export_kwargs)

        print(json.dumps({
            "success": True,
            "export_id": result.get("export_id") if isinstance(result, dict) else None,
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
