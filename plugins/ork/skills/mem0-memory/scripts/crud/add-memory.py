#!/usr/bin/env python3
"""
Add memory to mem0 via direct API call.
Usage: ./add-memory.py --text "content" --user-id "project-decisions" [--metadata '{"key":"value"}']
"""
import argparse
import json
import sys
from pathlib import Path

# Add lib directory to path (for standalone execution)
# If installed as package, use: from lib.mem0_client import get_mem0_client
_SCRIPT_DIR = Path(__file__).parent
_LIB_DIR = _SCRIPT_DIR.parent / "lib"
if str(_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(_LIB_DIR))

try:
    # Try installed package first
    from lib.mem0_client import get_mem0_client
except ImportError:
    # Fallback to standalone mode
    from mem0_client import get_mem0_client  # type: ignore  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Add memory to mem0")
    parser.add_argument("--text", required=True, help="Memory content")
    parser.add_argument("--user-id", required=True, help="User/scope ID")
    parser.add_argument("--agent-id", help="Agent ID (optional)")
    parser.add_argument("--metadata", default="{}", help="JSON metadata")
    parser.add_argument("--enable-graph", action="store_true", help="Enable graph memory")
    parser.add_argument("--api-key", help="Mem0 API key (or use MEM0_API_KEY env)")
    parser.add_argument("--org-id", help="Org ID (or use MEM0_ORG_ID env)")
    parser.add_argument("--project-id", help="Project ID (or use MEM0_PROJECT_ID env)")
    parser.add_argument("--no-infer", action="store_true",
                        help="Disable semantic inference (stores raw text, skips dedup)")
    args = parser.parse_args()

    try:
        # Initialize client
        client = get_mem0_client(
            api_key=args.api_key,
            org_id=args.org_id,
            project_id=args.project_id
        )

        # Parse metadata
        metadata = json.loads(args.metadata) if args.metadata else {}

        # Add memory (sync mode to get memory ID in response)
        add_kwargs = dict(
            messages=[{"role": "user", "content": args.text}],
            user_id=args.user_id,
            agent_id=args.agent_id,
            metadata=metadata,
            enable_graph=args.enable_graph,
            async_mode=False,
        )
        if args.no_infer:
            add_kwargs["infer"] = False
        result = client.add(**add_kwargs)

        # Extract memory ID from response
        memory_id = None
        if isinstance(result, list):
            if result and isinstance(result[0], dict):
                memory_id = result[0].get("id") or result[0].get("memory_id")
        elif isinstance(result, dict):
            if "results" in result and result["results"]:
                memory_id = result["results"][0].get("id") or result["results"][0].get("memory_id")
            elif "id" in result:
                memory_id = result["id"]
            elif "memory_id" in result:
                memory_id = result["memory_id"]

        # Fallback: if add returned empty results (dedup/merge), find the memory via get_all.
        # Only needed when infer=True (default) since dedup can swallow the response.
        if memory_id is None and args.user_id and not args.no_infer:
            import time
            time.sleep(1)
            try:
                all_result = client.get_all(filters={"user_id": args.user_id})
                memories = all_result.get("results", []) if isinstance(all_result, dict) else (all_result if isinstance(all_result, list) else [])
                if memories:
                    memory_id = memories[0].get("id") or memories[0].get("memory_id")
            except Exception:
                pass  # fallback failed, continue without ID

        print(json.dumps({
            "success": True,
            "memory_id": memory_id,
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
