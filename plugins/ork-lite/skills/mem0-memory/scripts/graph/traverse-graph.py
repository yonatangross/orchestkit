#!/usr/bin/env python3
"""
Traverse mem0 graph relationships for multi-hop queries.
Usage: ./traverse-graph.py --memory-id "mem_123" --depth 2 [--relation-type "recommends"]
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Add lib directory to path
_SCRIPT_DIR = Path(__file__).parent
_LIB_DIR = _SCRIPT_DIR.parent / "lib"
if str(_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(_LIB_DIR))
from mem0_client import get_mem0_client  # type: ignore  # noqa: E402


def traverse_graph(
    client,
    memory_id: str,
    depth: int = 2,
    relation_type: str | None = None,
    visited: set[str] | None = None,
    path: list[dict[str, Any]] | None = None
) -> list[dict[str, Any]]:
    """
    Traverse graph relationships from a memory with multi-hop support.
    
    Args:
        client: mem0 MemoryClient instance
        memory_id: Starting memory ID
        depth: Maximum traversal depth
        relation_type: Optional filter by relation type
        visited: Set of visited memory IDs (for cycle detection)
        path: Current traversal path
    
    Returns:
        List of traversal paths with related memories
    """
    if visited is None:
        visited = set()
    if path is None:
        path = []
    
    # Avoid cycles
    if memory_id in visited or depth <= 0:
        return []
    
    visited.add(memory_id)
    
    # Get the memory
    try:
        memory = client.get(memory_id=memory_id)
    except Exception:
        return []
    
    # Add to current path
    current_path = path + [{
        "memory_id": memory_id,
        "memory": memory,
        "depth": len(path)
    }]
    
    results = []
    
    # If we've reached max depth, return current path
    if depth == 1:
        return [{"path": current_path, "depth": len(current_path) - 1}]
    
    # Get relations from memory metadata or via search
    memory_metadata = memory.get("metadata", {})
    relations = memory_metadata.get("relations", [])
    
    # If no relations in metadata, try searching with graph enabled
    if not relations:
        entities = memory_metadata.get("entities", [])
        if entities:
            query = " ".join([e.get("name", "") for e in entities[:3]])
            search_result = client.search(
                query=query,
                filters={"user_id": memory.get("user_id")} if memory.get("user_id") else None,
                limit=10,
                enable_graph=True
            )
            relations = search_result.get("relations", [])
    
    # Traverse each relation
    for relation in relations:
        if relation_type and relation.get("type") != relation_type:
            continue
        
        related_id = relation.get("target_id") or relation.get("memory_id")
        if not related_id or related_id in visited:
            continue
        
        # Recursively traverse
        deeper_paths = traverse_graph(
            client,
            related_id,
            depth=depth - 1,
            relation_type=relation_type,
            visited=visited.copy(),  # Copy to allow parallel paths
            path=current_path
        )
        
        # Add relation info to paths
        for path_result in deeper_paths:
            if path_result["path"]:
                # Add relation info to the connection
                path_result["path"][-1]["relation"] = {
                    "type": relation.get("type"),
                    "source_id": memory_id,
                    "target_id": related_id,
                    "strength": relation.get("strength", 1.0)
                }
            results.append(path_result)
    
    # If no deeper paths, return current path as a result
    if not results and current_path:
        results.append({"path": current_path, "depth": len(current_path) - 1})
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Traverse mem0 graph relationships")
    parser.add_argument("--memory-id", required=True, help="Starting memory ID")
    parser.add_argument("--depth", type=int, default=2, help="Maximum traversal depth (default: 2)")
    parser.add_argument("--relation-type", help="Filter by relation type (e.g., 'recommends', 'uses')")
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

        paths = traverse_graph(
            client,
            memory_id=args.memory_id,
            depth=args.depth,
            relation_type=args.relation_type
        )

        print(json.dumps({
            "success": True,
            "memory_id": args.memory_id,
            "depth": args.depth,
            "relation_type": args.relation_type,
            "path_count": len(paths),
            "paths": paths
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
