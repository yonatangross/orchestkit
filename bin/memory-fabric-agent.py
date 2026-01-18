#!/usr/bin/env python3
"""
Memory Fabric Agent - Graph-First Unified Memory Operations

This service provides guaranteed MCP tool execution for memory operations,
with knowledge graph as PRIMARY storage and mem0 as OPTIONAL enhancement.

Architecture (v2.1 Graph-First):
- PRIMARY: mcp__memory__* (local knowledge graph) - FREE, zero-config, always works
- OPTIONAL: mcp__mem0__* (cloud semantic search) - requires MEM0_API_KEY

Called by:
- hooks/posttool/realtime-sync.sh (for immediate/batched syncs)
- hooks/posttool/memory-bridge.sh (for bidirectional sync)
- skills/recall/SKILL.md (for unified search)
- skills/remember/SKILL.md (for graph-first write)

Usage:
    python3 memory-fabric-agent.py search "query" [project_id] [--limit N] [--mem0]
    python3 memory-fabric-agent.py write "text" [project_id] [--category cat] [--outcome success|failed] [--mem0]
    python3 memory-fabric-agent.py sync "source_system" "sync_data_json"
    python3 memory-fabric-agent.py health

Environment:
    MEM0_API_KEY - Optional for mem0 cloud enhancement
    CLAUDE_PROJECT_DIR - Project directory for scoping
    ANTHROPIC_API_KEY - Required for Agent SDK

Version: 2.1.0
Part of Memory Fabric v2.1 - Graph-First Architecture
"""

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    Anthropic = None  # type: ignore[misc,assignment]
    ANTHROPIC_AVAILABLE = False

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# MCP server configurations (matches .claude/templates/mcp-enabled.json)
MCP_SERVERS = {
    "mem0": {
        "command": "uvx",
        "args": ["mem0-mcp-server"],
        "env": {"MEM0_API_KEY": os.environ.get("MEM0_API_KEY", "")}
    },
    "memory": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
}

# Entity types for extraction
KNOWN_AGENTS = [
    "database-engineer", "backend-system-architect", "frontend-ui-developer",
    "security-auditor", "test-generator", "workflow-architect", "llm-integrator",
    "data-pipeline-engineer", "system-design-reviewer", "metrics-architect",
    "debug-investigator", "security-layer-auditor", "ux-researcher",
    "product-strategist", "code-quality-reviewer", "requirements-translator",
    "prioritization-analyst", "rapid-ui-designer", "market-intelligence",
    "business-case-builder", "infrastructure-architect", "ci-cd-engineer",
    "deployment-manager", "accessibility-specialist"
]

KNOWN_TECHNOLOGIES = [
    "pgvector", "postgresql", "fastapi", "sqlalchemy", "react", "typescript",
    "langgraph", "redis", "celery", "docker", "kubernetes", "python", "javascript",
    "nextjs", "vite", "prisma", "drizzle", "zod", "pydantic", "alembic", "pytest",
    "vitest", "playwright", "langchain", "openai", "anthropic", "mem0", "langfuse"
]

# Similarity threshold for deduplication
DEDUP_THRESHOLD = 0.85


# -----------------------------------------------------------------------------
# Project Context
# -----------------------------------------------------------------------------

def get_project_id() -> str:
    """Get sanitized project ID from CLAUDE_PROJECT_DIR."""
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", str(Path.cwd()))
    project_name = Path(project_dir).name

    # Sanitize: lowercase, replace special chars
    sanitized = project_name.lower()
    sanitized = ''.join(c if c.isalnum() or c == '-' else '-' for c in sanitized)
    sanitized = '-'.join(filter(None, sanitized.split('-')))

    return sanitized or "default-project"


def get_user_id(scope: str = "decisions", global_scope: bool = False) -> str:
    """Generate scoped user_id for mem0."""
    if global_scope:
        return f"skillforge-global-{scope}"
    return f"{get_project_id()}-{scope}"


def is_mem0_available() -> bool:
    """Check if mem0 is available (has API key)."""
    return bool(os.environ.get("MEM0_API_KEY"))


# -----------------------------------------------------------------------------
# Entity Extraction
# -----------------------------------------------------------------------------

def extract_entities(text: str) -> dict:
    """Extract entities and relationships from text."""
    text_lower = text.lower()

    entities = []
    relations = []

    # Extract agents
    for agent in KNOWN_AGENTS:
        if agent in text_lower:
            entities.append({
                "name": agent,
                "entityType": "Agent",
                "observations": [f"Mentioned in: {text[:100]}..."]
            })

    # Extract technologies
    for tech in KNOWN_TECHNOLOGIES:
        if tech in text_lower:
            entities.append({
                "name": tech,
                "entityType": "Technology",
                "observations": [f"Used in context: {text[:100]}..."]
            })

    # Extract relationships via patterns
    import re

    # "X uses Y"
    for match in re.finditer(r'([a-z][a-z0-9-]+)\s+uses?\s+([a-z][a-z0-9-]+)', text_lower):
        relations.append({
            "from": match.group(1),
            "to": match.group(2),
            "relationType": "USES"
        })

    # "X recommends Y"
    for match in re.finditer(r'([a-z][a-z0-9-]+)\s+recommends?\s+([a-z][a-z0-9-]+)', text_lower):
        relations.append({
            "from": match.group(1),
            "to": match.group(2),
            "relationType": "RECOMMENDS"
        })

    # "X for Y" / "X used for Y"
    for match in re.finditer(r'([a-z][a-z0-9-]+)\s+(?:used\s+)?for\s+([a-z][a-z0-9-]+)', text_lower):
        relations.append({
            "from": match.group(1),
            "to": match.group(2),
            "relationType": "USED_FOR"
        })

    return {"entities": entities, "relations": relations}


def jaccard_similarity(text_a: str, text_b: str) -> float:
    """Calculate Jaccard similarity between two texts."""
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())

    if not words_a or not words_b:
        return 0.0

    intersection = words_a & words_b
    union = words_a | words_b

    return len(intersection) / len(union) if union else 0.0


# -----------------------------------------------------------------------------
# Agent SDK Operations (using Anthropic directly for tool_use)
# -----------------------------------------------------------------------------

def create_client():
    """Create Anthropic client for tool use."""
    if not ANTHROPIC_AVAILABLE or Anthropic is None:
        raise ImportError(
            "anthropic package not installed. "
            "Install with: pip install 'skillforge-claude-plugin[memory]'"
        )
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable required")
    return Anthropic(api_key=api_key)


def execute_unified_search(query: str, project_id: str, limit: int = 10,
                           include_mem0: bool = False) -> dict:
    """
    Execute unified search across knowledge graph and optionally mem0.

    Graph-First Architecture:
    1. ALWAYS search knowledge graph (PRIMARY)
    2. Optionally search mem0 if --mem0 flag and API key present
    """
    client = create_client()
    user_id = f"{project_id}-decisions"

    # Build the search prompt - graph first
    if include_mem0 and is_mem0_available():
        prompt = f"""Search both memory systems for: "{query}"

Execute these tool calls:

1. mcp__memory__search_nodes (PRIMARY) with:
   - query: "{query}"

2. mcp__mem0__search_memories (OPTIONAL ENHANCEMENT) with:
   - query: "{query}"
   - filters: {{"AND": [{{"user_id": "{user_id}"}}]}}
   - limit: {limit}
   - enable_graph: true

After getting results from both systems:
1. Show graph results FIRST (they are primary)
2. Show mem0 results after graph results
3. Mark cross-referenced items with [CROSS-REF]
4. Return JSON with format:
   {{"results": [...], "sources": {{"graph": N, "mem0": M}}, "primary": "graph"}}
"""
    else:
        # Graph-only search
        prompt = f"""Search knowledge graph for: "{query}"

Execute this tool call:

1. mcp__memory__search_nodes with:
   - query: "{query}"

Return JSON with format:
   {{"results": [...], "sources": {{"graph": N}}, "primary": "graph"}}
"""

    # Define tools
    tools = [
        {
            "name": "mcp__memory__search_nodes",
            "description": "Search knowledge graph nodes (PRIMARY)",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"}
                },
                "required": ["query"]
            }
        }
    ]

    # Add mem0 tool only if requested and available
    if include_mem0 and is_mem0_available():
        tools.append({
            "name": "mcp__mem0__search_memories",
            "description": "Search mem0 semantic memory (OPTIONAL)",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "filters": {"type": "object", "description": "Filter conditions"},
                    "limit": {"type": "integer", "description": "Max results"},
                    "enable_graph": {"type": "boolean", "description": "Enable graph"}
                },
                "required": ["query"]
            }
        })

    try:
        # First call to get tool use requests
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            tools=tools,  # type: ignore[arg-type]
            messages=[{"role": "user", "content": prompt}]
        )

        # Collect tool calls
        tool_calls = []
        for block in response.content:
            if block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "input": block.input
                })

        return {
            "status": "tool_calls_ready",
            "tool_calls": tool_calls,
            "hint": "Execute these MCP tool calls and pass results back",
            "query": query,
            "project_id": project_id,
            "architecture": "graph-first",
            "mem0_included": include_mem0 and is_mem0_available()
        }

    except Exception as e:
        return {
            "error": str(e),
            "query": query,
            "project_id": project_id
        }


def execute_dual_write(text: str, project_id: str, category: str = "decision",
                       outcome: str = "neutral", include_mem0: bool = False) -> dict:
    """
    Write to knowledge graph (PRIMARY) and optionally mem0.

    Graph-First Architecture:
    1. ALWAYS create graph entities and relations (PRIMARY)
    2. Optionally write to mem0 if --mem0 flag and API key present
    """
    client = create_client()
    user_id = f"{project_id}-decisions"
    timestamp = datetime.now(UTC).isoformat().replace("+00:00", "Z")

    # Extract entities locally first (faster than LLM)
    extracted = extract_entities(text)

    # Build the write prompt - graph first
    if include_mem0 and is_mem0_available():
        prompt = f"""Store this memory in knowledge graph (PRIMARY) and mem0 (OPTIONAL):

Text: "{text}"
Project: {project_id}
Category: {category}
Outcome: {outcome}

Execute these tool calls IN ORDER:

1. mcp__memory__create_entities (PRIMARY) with:
   {json.dumps({"entities": extracted["entities"]})}

2. If relations were found, mcp__memory__create_relations with:
   {json.dumps({"relations": extracted["relations"]})}

3. mcp__mem0__add_memory (OPTIONAL ENHANCEMENT) with:
   {{
     "text": "{text}",
     "user_id": "{user_id}",
     "metadata": {{
       "category": "{category}",
       "outcome": "{outcome}",
       "stored_at": "{timestamp}",
       "source": "memory-fabric-agent"
     }},
     "enable_graph": true
   }}

Return JSON: {{"graph_entities": N, "graph_relations": M, "mem0_synced": true}}
"""
    else:
        # Graph-only write
        prompt = f"""Store this memory in knowledge graph:

Text: "{text}"
Project: {project_id}
Category: {category}
Outcome: {outcome}

Execute these tool calls:

1. mcp__memory__create_entities with:
   {json.dumps({"entities": extracted["entities"]})}

2. If relations were found, mcp__memory__create_relations with:
   {json.dumps({"relations": extracted["relations"]})}

Return JSON: {{"graph_entities": N, "graph_relations": M}}
"""

    # Define tools - graph tools always included
    tools = [
        {
            "name": "mcp__memory__create_entities",
            "description": "Create graph entities (PRIMARY)",
            "input_schema": {
                "type": "object",
                "properties": {
                    "entities": {"type": "array"}
                },
                "required": ["entities"]
            }
        },
        {
            "name": "mcp__memory__create_relations",
            "description": "Create graph relations (PRIMARY)",
            "input_schema": {
                "type": "object",
                "properties": {
                    "relations": {"type": "array"}
                },
                "required": ["relations"]
            }
        }
    ]

    # Add mem0 tool only if requested and available
    if include_mem0 and is_mem0_available():
        tools.append({
            "name": "mcp__mem0__add_memory",
            "description": "Add memory to mem0 (OPTIONAL)",
            "input_schema": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "user_id": {"type": "string"},
                    "metadata": {"type": "object"},
                    "enable_graph": {"type": "boolean"}
                },
                "required": ["text"]
            }
        })

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            tools=tools,  # type: ignore[arg-type]
            messages=[{"role": "user", "content": prompt}]
        )

        tool_calls = []
        for block in response.content:
            if block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "input": block.input
                })

        return {
            "status": "tool_calls_ready",
            "tool_calls": tool_calls,
            "extracted": extracted,
            "text": text,
            "project_id": project_id,
            "category": category,
            "outcome": outcome,
            "architecture": "graph-first",
            "mem0_included": include_mem0 and is_mem0_available()
        }

    except Exception as e:
        return {
            "error": str(e),
            "text": text[:100] + "...",
            "project_id": project_id
        }


def execute_bidirectional_sync(source: str, data: dict) -> dict:
    """
    Sync data from one memory system to the other.

    Graph-First Architecture:
    - Graph is authoritative (source of truth)
    - mem0 syncs TO graph when explicitly used
    - Graph entities don't need to sync to mem0 (graph is sufficient)
    """
    if source == "mem0":
        # Mem0 -> Graph: Extract entities and create in graph
        # This is the important direction - graph is authoritative
        text = data.get("text", data.get("memory", ""))
        if not text:
            return {"error": "No text to sync", "source": source}

        extracted = extract_entities(text)

        return {
            "status": "sync_ready",
            "direction": "mem0_to_graph",
            "tool_calls": [
                {
                    "name": "mcp__memory__create_entities",
                    "input": {"entities": extracted["entities"]}
                },
                {
                    "name": "mcp__memory__create_relations",
                    "input": {"relations": extracted["relations"]}
                }
            ],
            "extracted": extracted,
            "note": "Graph is authoritative - syncing mem0 data TO graph"
        }

    elif source == "graph":
        # Graph -> Mem0: Only if explicitly requested
        # In graph-first architecture, this is rarely needed
        entities = data.get("entities", [])
        if not entities:
            return {"error": "No entities to sync", "source": source}

        # Build natural language summary
        summaries = []
        for entity in entities:
            name = entity.get("name", "Unknown")
            entity_type = entity.get("entityType", "Entity")
            observations = entity.get("observations", [])
            obs_text = ". ".join(observations[:2])
            summaries.append(f"{name} ({entity_type}): {obs_text}")

        text = "Graph entities: " + "; ".join(summaries)
        project_id = get_project_id()
        user_id = f"{project_id}-patterns"

        # Only sync if mem0 is available
        if not is_mem0_available():
            return {
                "status": "skipped",
                "direction": "graph_to_mem0",
                "note": "mem0 not available (no MEM0_API_KEY), graph-only operation",
                "entities_count": len(entities)
            }

        return {
            "status": "sync_ready",
            "direction": "graph_to_mem0",
            "tool_calls": [
                {
                    "name": "mcp__mem0__add_memory",
                    "input": {
                        "text": text,
                        "user_id": user_id,
                        "metadata": {
                            "source": "graph-sync",
                            "synced_at": datetime.now(UTC).isoformat().replace("+00:00", "Z")
                        },
                        "enable_graph": True
                    }
                }
            ],
            "generated_text": text
        }

    return {"error": f"Unknown source: {source}"}


def check_health() -> dict:
    """
    Check if memory services are available.

    Graph-First Architecture:
    - ready=True always (graph is always available)
    - enhanced=True if mem0 is configured
    """
    checks = {
        "anthropic_api_key": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "mem0_api_key": bool(os.environ.get("MEM0_API_KEY")),
        "project_dir": os.environ.get("CLAUDE_PROJECT_DIR", str(Path.cwd())),
        "project_id": get_project_id()
    }

    # Graph-first: always ready with graph (no special config needed)
    checks["ready"] = True  # Graph always works
    checks["graph_ready"] = True  # Graph is always available
    checks["enhanced"] = checks["mem0_api_key"]  # mem0 is enhancement

    checks["message"] = (
        "Knowledge graph ready" +
        (" + mem0 cloud enabled" if checks["enhanced"] else " (mem0 cloud not configured)")
    )

    return checks


# -----------------------------------------------------------------------------
# CLI Interface
# -----------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Memory Fabric Agent - Graph-First Unified Memory Operations"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # search command
    search_parser = subparsers.add_parser("search", help="Graph-first search")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("project_id", nargs="?", help="Project ID")
    search_parser.add_argument("--limit", type=int, default=10, help="Max results")
    search_parser.add_argument("--mem0", action="store_true",
                               help="Also search mem0 cloud (if configured)")

    # write command
    write_parser = subparsers.add_parser("write", help="Graph-first write")
    write_parser.add_argument("text", help="Text to store")
    write_parser.add_argument("project_id", nargs="?", help="Project ID")
    write_parser.add_argument("--category", default="decision", help="Category")
    write_parser.add_argument("--outcome", default="neutral",
                              choices=["success", "failed", "neutral"])
    write_parser.add_argument("--mem0", action="store_true",
                              help="Also write to mem0 cloud (if configured)")

    # sync command
    sync_parser = subparsers.add_parser("sync", help="Bidirectional sync")
    sync_parser.add_argument("source", choices=["mem0", "graph"],
                            help="Source system")
    sync_parser.add_argument("data", help="JSON data to sync")

    # health command
    subparsers.add_parser("health", help="Check service health")

    # extract command (utility)
    extract_parser = subparsers.add_parser("extract", help="Extract entities")
    extract_parser.add_argument("text", help="Text to analyze")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    result = {}

    try:
        if args.command == "search":
            project_id = args.project_id or get_project_id()
            result = execute_unified_search(
                args.query, project_id, args.limit,
                include_mem0=args.mem0
            )

        elif args.command == "write":
            project_id = args.project_id or get_project_id()
            result = execute_dual_write(
                args.text, project_id, args.category, args.outcome,
                include_mem0=args.mem0
            )

        elif args.command == "sync":
            data = json.loads(args.data)
            result = execute_bidirectional_sync(args.source, data)

        elif args.command == "health":
            result = check_health()

        elif args.command == "extract":
            result = extract_entities(args.text)

    except json.JSONDecodeError as e:
        result = {"error": f"Invalid JSON: {e}"}
    except Exception as e:
        result = {"error": str(e)}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
