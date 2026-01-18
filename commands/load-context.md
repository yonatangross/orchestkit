---
description: Auto-load relevant memories at session start from both mem0 and graph
allowed-tools: Read, mcp__mem0__search_memories, mcp__mem0__get_memories, mcp__memory__search_nodes, mcp__memory__read_graph
---

# Load Context - Memory Fabric Initialization

Load and follow the skill instructions from the `skills/load-context/SKILL.md` file.

Execute the `/load-context` command to load relevant memories from Mem0 and the knowledge graph.

This command:
1. Checks current context pressure and adapts loading
2. Queries Mem0 for recent sessions and decisions
3. Queries knowledge graph for entity relationships
4. Outputs formatted Memory Fabric context

## Usage

- `/load-context` - Load memories with context-aware defaults
- `/load-context --refresh` - Force reload even if recently loaded
- `/load-context --verbose` - Show detailed MCP query results

## Arguments

- No required arguments; automatically invoked at session start
