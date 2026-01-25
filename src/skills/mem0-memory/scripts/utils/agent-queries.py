#!/usr/bin/env python3
"""
Agent query helper functions for cross-agent and agent-specific memory queries.
Provides convenient functions for querying mem0 with metadata filtering.
"""
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add lib directory to path
_SCRIPT_DIR = Path(__file__).parent
# From utils/ -> scripts/ -> lib/
_LIB_DIR = _SCRIPT_DIR.parent / "lib"
if str(_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(_LIB_DIR))
from mem0_client import get_mem0_client  # type: ignore  # noqa: E402


def search_agent_specific(
    query: str,
    agent_name: str,
    limit: int = 10,
    user_id: str = "orchestkit:all-agents",
    enable_graph: bool = True
) -> Dict[str, Any]:
    """
    Query memories for a specific agent.
    
    Args:
        query: Search query text
        agent_name: Name of the agent (e.g., "backend-system-architect")
        limit: Maximum number of results
        user_id: Mem0 user_id (default: "orchestkit:all-agents")
        enable_graph: Enable graph relationships in results
    
    Returns:
        Dict with search results including memories and relationships
    """
    client = get_mem0_client()
    
    filters = {
        "user_id": user_id,
        "metadata": {
            "agent_name": agent_name
        }
    }
    
    result = client.search(
        query=query,
        filters=filters,
        limit=limit,
        enable_graph=enable_graph
    )
    
    return result


def search_cross_agent(
    query: str,
    limit: int = 10,
    user_id: str = "orchestkit:all-agents",
    enable_graph: bool = True
) -> Dict[str, Any]:
    """
    Query all agent memories (cross-agent search).
    This is the default behavior - searches all memories without agent filter.
    
    Args:
        query: Search query text
        limit: Maximum number of results
        user_id: Mem0 user_id (default: "orchestkit:all-agents")
        enable_graph: Enable graph relationships in results
    
    Returns:
        Dict with search results including memories and relationships
    """
    client = get_mem0_client()
    
    filters = {
        "user_id": user_id
    }
    
    result = client.search(
        query=query,
        filters=filters,
        limit=limit,
        enable_graph=enable_graph
    )
    
    return result


def search_shared_knowledge(
    query: str,
    limit: int = 10,
    user_id: str = "orchestkit:all-agents",
    enable_graph: bool = True
) -> Dict[str, Any]:
    """
    Query shared knowledge (skills, technologies, categories).
    These are memories marked with shared=True in metadata.
    
    Args:
        query: Search query text
        limit: Maximum number of results
        user_id: Mem0 user_id (default: "orchestkit:all-agents")
        enable_graph: Enable graph relationships in results
    
    Returns:
        Dict with search results including memories and relationships
    """
    client = get_mem0_client()
    
    filters = {
        "user_id": user_id,
        "metadata": {
            "shared": True
        }
    }
    
    result = client.search(
        query=query,
        filters=filters,
        limit=limit,
        enable_graph=enable_graph
    )
    
    return result


def search_by_category(
    query: str,
    category: str,
    limit: int = 10,
    user_id: str = "orchestkit:all-agents",
    enable_graph: bool = True
) -> Dict[str, Any]:
    """
    Query memories by category (e.g., "api", "database", "security").
    
    Args:
        query: Search query text
        category: Category name to filter by
        limit: Maximum number of results
        user_id: Mem0 user_id (default: "orchestkit:all-agents")
        enable_graph: Enable graph relationships in results
    
    Returns:
        Dict with search results including memories and relationships
    """
    client = get_mem0_client()
    
    filters = {
        "user_id": user_id,
        "metadata": {
            "category": category
        }
    }
    
    result = client.search(
        query=query,
        filters=filters,
        limit=limit,
        enable_graph=enable_graph
    )
    
    return result


def search_agent_and_shared(
    query: str,
    agent_name: str,
    limit: int = 10,
    user_id: str = "orchestkit:all-agents",
    enable_graph: bool = True
) -> Dict[str, Any]:
    """
    Query both agent-specific memories and shared knowledge.
    Useful for comprehensive context retrieval.
    
    Args:
        query: Search query text
        agent_name: Name of the agent
        limit: Maximum number of results per query (total may be up to 2*limit)
        user_id: Mem0 user_id (default: "orchestkit:all-agents")
        enable_graph: Enable graph relationships in results
    
    Returns:
        Dict with combined search results from both queries
    """
    # Query agent-specific
    agent_results = search_agent_specific(
        query=query,
        agent_name=agent_name,
        limit=limit,
        user_id=user_id,
        enable_graph=enable_graph
    )
    
    # Query shared knowledge
    shared_results = search_shared_knowledge(
        query=query,
        limit=limit,
        user_id=user_id,
        enable_graph=enable_graph
    )
    
    # Combine results (deduplicate by memory ID)
    agent_memories = {mem.get("id"): mem for mem in agent_results.get("results", [])}
    shared_memories = {mem.get("id"): mem for mem in shared_results.get("results", [])}
    
    # Merge, preferring agent-specific if duplicate
    combined_memories = {**shared_memories, **agent_memories}
    
    # Combine relations
    combined_relations = agent_results.get("relations", []) + shared_results.get("relations", [])
    # Deduplicate relations by source_id + target_id
    seen_relations = set()
    unique_relations = []
    for rel in combined_relations:
        key = (rel.get("source_id"), rel.get("target_id"))
        if key not in seen_relations:
            seen_relations.add(key)
            unique_relations.append(rel)
    
    return {
        "results": list(combined_memories.values())[:limit * 2],
        "relations": unique_relations,
        "count": len(combined_memories),
        "agent_count": len(agent_memories),
        "shared_count": len(shared_memories)
    }


def main():
    """CLI interface for agent query helpers."""
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description="Agent query helper functions")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--agent-name", help="Filter by agent name (for agent-specific search)")
    parser.add_argument("--shared-only", action="store_true", help="Only search shared knowledge")
    parser.add_argument("--category", help="Filter by category")
    parser.add_argument("--agent-and-shared", action="store_true", help="Search both agent-specific and shared (requires --agent-name)")
    parser.add_argument("--limit", type=int, default=10, help="Max results")
    parser.add_argument("--user-id", default="orchestkit:all-agents", help="Mem0 user_id")
    parser.add_argument("--enable-graph", action="store_true", help="Enable graph relationships")
    args = parser.parse_args()
    
    try:
        if args.agent_and_shared:
            if not args.agent_name:
                print("Error: --agent-and-shared requires --agent-name", file=sys.stderr)
                sys.exit(1)
            result = search_agent_and_shared(
                query=args.query,
                agent_name=args.agent_name,
                limit=args.limit,
                user_id=args.user_id,
                enable_graph=args.enable_graph
            )
        elif args.agent_name:
            result = search_agent_specific(
                query=args.query,
                agent_name=args.agent_name,
                limit=args.limit,
                user_id=args.user_id,
                enable_graph=args.enable_graph
            )
        elif args.shared_only:
            result = search_shared_knowledge(
                query=args.query,
                limit=args.limit,
                user_id=args.user_id,
                enable_graph=args.enable_graph
            )
        elif args.category:
            result = search_by_category(
                query=args.query,
                category=args.category,
                limit=args.limit,
                user_id=args.user_id,
                enable_graph=args.enable_graph
            )
        else:
            # Default: cross-agent search
            result = search_cross_agent(
                query=args.query,
                limit=args.limit,
                user_id=args.user_id,
                enable_graph=args.enable_graph
            )
        
        print(json.dumps(result, indent=2, default=str))
        
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "type": type(e).__name__
        }, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
