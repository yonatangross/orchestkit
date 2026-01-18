---
description: Search and retrieve decisions and patterns from knowledge graph (graph-first architecture)
allowed-tools: Read
---

# Recall - Search Knowledge Graph

Load and follow the skill instructions from the `skills/recall/SKILL.md` file.

Search past decisions and patterns stored in the knowledge graph. Optionally include mem0 cloud search with `--mem0` flag.

## Usage
- `/recall <search query>` - Search knowledge graph (default)
- `/recall --mem0 <query>` - Search BOTH graph and mem0 cloud
- `/recall --category <category> <query>` - Filter by category
- `/recall --limit <number> <query>` - Limit results
- `/recall --agent <agent-id> <query>` - Filter by agent scope
- `/recall --global <query>` - Search cross-project best practices

## Categories
decision, architecture, pattern, blocker, constraint, preference, pagination, database, authentication, api, frontend, performance

## Arguments
- Search query: What to search for in memory

## Graph-First Architecture
Knowledge graph is PRIMARY - always available, zero-config. Mem0 cloud is an optional enhancement for semantic search.
