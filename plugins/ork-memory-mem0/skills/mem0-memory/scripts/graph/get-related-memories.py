#!/usr/bin/env python3
"""
Get related memories from mem0 via graph relationships.
Usage: ./get-related-memories.py --memory-id "mem_123" [--depth 2] [--relation-type "recommends"]
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


def get_related_memories(client, memory_id: str, depth: int = 1, relation_type: str | None = None):
    """
    Get memories related to a given memory via graph traversal.
    
    Args:
        client: mem0 MemoryClient instance
        memory_id: Starting memory ID
        depth: Traversal depth (1 = direct relations, 2 = 2-hop, etc.)
        relation_type: Optional filter by relation type
    
    Returns:
        List of related memories with relationship context
    """
    # First, get the starting memory
    try:
        start_memory = client.get(memory_id=memory_id)
    except Exception as e:
        raise ValueError(f"Failed to get memory {memory_id}: {str(e)}")
    
    related_memories = []
    visited = {memory_id}
    
    # Extract entities and relationships from the starting memory
    # Graph memory stores relationships in the memory metadata
    memory_metadata = start_memory.get("metadata", {})
    relations = memory_metadata.get("relations", [])
    
    # If no relations in metadata, try searching with graph enabled to get relations
    if not relations:
        # Use search with graph enabled to find related memories
        # Search for memories that might be related based on entities
        entities = memory_metadata.get("entities", [])
        if entities:
            # Search for memories mentioning the same entities
            query = " ".join([e.get("name", "") for e in entities[:3]])  # Use first 3 entities
            search_result = client.search(
                query=query,
                filters={"user_id": start_memory.get("user_id")} if start_memory.get("user_id") else None,
                limit=20,
                enable_graph=True
            )
            relations = search_result.get("relations", [])
    
    # Process direct relations (depth 1)
    for relation in relations:
        if relation_type and relation.get("type") != relation_type:
            continue
        
        related_id = relation.get("target_id") or relation.get("memory_id")
        if related_id and related_id not in visited:
            try:
                related_memory = client.get(memory_id=related_id)
                related_memories.append({
                    "memory": related_memory,
                    "relation": {
                        "type": relation.get("type"),
                        "source_id": memory_id,
                        "target_id": related_id,
                        "strength": relation.get("strength", 1.0)
                    },
                    "depth": 1
                })
                visited.add(related_id)
            except Exception:
                # Skip if memory not found
                continue
    
    # For depth > 1, recursively traverse
    if depth > 1:
        for item in related_memories[:]:  # Copy list to avoid modification during iteration
            if item["depth"] < depth:
                deeper_relations = get_related_memories(
                    client,
                    item["memory"]["id"],
                    depth=depth - 1,
                    relation_type=relation_type
                )
                # Add deeper relations with incremented depth
                for rel in deeper_relations:
                    if rel["memory"]["id"] not in visited:
                        rel["depth"] = item["depth"] + 1
                        related_memories.append(rel)
                        visited.add(rel["memory"]["id"])
    
    return related_memories


def main():
    parser = argparse.ArgumentParser(description="Get related memories via graph traversal")
    parser.add_argument("--memory-id", required=True, help="Starting memory ID")
    parser.add_argument("--depth", type=int, default=1, help="Traversal depth (default: 1)")
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

        related = get_related_memories(
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
            "count": len(related),
            "related_memories": related
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
