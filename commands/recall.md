---
description: Search and retrieve decisions and patterns from semantic memory
allowed-tools: Read
---

# Recall - Search Semantic Memory

Load and follow the skill instructions from the `skills/recall/SKILL.md` file.

Search past decisions and patterns stored in mem0.

## Usage
- `/recall <search query>` - Basic search
- `/recall --category <category> <query>` - Filter by category
- `/recall --limit <number> <query>` - Limit results
- `/recall --graph <query>` - Search with graph relationships
- `/recall --agent <agent-id> <query>` - Filter by agent scope
- `/recall --global <query>` - Search cross-project best practices

## Categories
decision, architecture, pattern, blocker, constraint, preference, pagination, database, authentication, api, frontend, performance

## Arguments
- Search query: What to search for in memory
