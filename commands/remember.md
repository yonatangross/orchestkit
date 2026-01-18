---
description: Store decisions and patterns in knowledge graph with success/failure tracking (graph-first architecture)
allowed-tools: Read
---

# Remember - Store Decisions and Patterns

Load and follow the skill instructions from the `skills/remember/SKILL.md` file.

Store important decisions, patterns, or context in the knowledge graph. Optionally sync to mem0 cloud with `--mem0` flag.

## Usage
- `/remember <text>` - Store in knowledge graph (default)
- `/remember --mem0 <text>` - Store in BOTH graph and mem0 cloud
- `/remember --category <category> <text>` - Specify category
- `/remember --success <text>` - Mark as successful pattern
- `/remember --failed <text>` - Mark as anti-pattern
- `/remember --agent <agent-id> <text>` - Store in agent-specific scope
- `/remember --global <text>` - Store as cross-project best practice

## Categories
decision, architecture, pattern, blocker, constraint, preference, pagination, database, authentication, api, frontend, performance

## Arguments
- Text: What to remember (decision, pattern, or context)

## Graph-First Architecture
Knowledge graph is PRIMARY - always available, zero-config. Mem0 cloud is an optional enhancement for semantic search.
