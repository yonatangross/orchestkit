#!/usr/bin/env python3
"""
Search memories in mem0 via direct API.
Usage: ./search-memories.py --query "text" --user-id "scope" [--limit 5]
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
    parser = argparse.ArgumentParser(description="Search mem0 memories")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--user-id", help="Filter by user_id")
    parser.add_argument("--agent-id", help="Filter by agent_id")
    parser.add_argument("--agent-filter", help="Filter by agent_name (metadata filter)")
    parser.add_argument("--shared-only", action="store_true", help="Only search shared knowledge (metadata.shared=True)")
    parser.add_argument("--limit", type=int, default=10, help="Max results")
    parser.add_argument("--filters", default="{}", help="JSON filters")
    parser.add_argument("--enable-graph", action="store_true", help="Enable graph memory")
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

        # Build filters - mem0 API requires filters to be non-empty
        filters = json.loads(args.filters) if args.filters else {}
        if args.user_id:
            filters["user_id"] = args.user_id
        if args.agent_id:
            filters["agent_id"] = args.agent_id
        if args.agent_filter:
            # Add metadata filter for agent_name
            if "metadata" not in filters:
                filters["metadata"] = {}
            filters["metadata"]["agent_name"] = args.agent_filter
        if args.shared_only:
            # Add metadata filter for shared knowledge
            if "metadata" not in filters:
                filters["metadata"] = {}
            filters["metadata"]["shared"] = True
        
        # mem0 API requires filters, so if none provided, use empty dict (API will handle)
        # But better: if user_id provided, use it; otherwise use empty filters
        search_filters = filters if filters else ({"user_id": args.user_id} if args.user_id else {})

        result = client.search(
            query=args.query,
            filters=search_filters if search_filters else None,
            limit=args.limit,
            enable_graph=args.enable_graph
        )

        # Format relations array for better visibility
        relations = result.get("relations", []) if args.enable_graph else []
        formatted_relations = []
        for rel in relations:
            formatted_relations.append({
                "type": rel.get("type", "unknown"),
                "source_id": rel.get("source_id"),
                "target_id": rel.get("target_id") or rel.get("memory_id"),
                "strength": rel.get("strength", 1.0),
                "description": f"{rel.get('type', 'related')} -> {rel.get('target_id', 'unknown')}"
            })
        
        # Add relationship context to results
        results_with_relations = []
        for res in result.get("results", []):
            res_copy = res.copy()
            # Find relations for this result
            result_relations = [
                r for r in formatted_relations
                if r.get("target_id") == res.get("id") or r.get("source_id") == res.get("id")
            ]
            if result_relations:
                res_copy["related_via"] = result_relations
            results_with_relations.append(res_copy)
        
        print(json.dumps({
            "success": True,
            "count": len(result.get("results", [])),
            "results": results_with_relations,
            "relations": formatted_relations,
            "graph_enabled": args.enable_graph,
            "relationship_summary": {
                "total_relations": len(formatted_relations),
                "relation_types": list(set(r.get("type", "unknown") for r in formatted_relations))
            } if formatted_relations else None
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
