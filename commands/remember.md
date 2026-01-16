---
description: Store decisions and patterns in semantic memory with success/failure tracking
allowed-tools: Read
---

# Remember - Store Decisions and Patterns

Load and follow the skill instructions from the `skills/remember/SKILL.md` file.

Store important decisions, patterns, or context in mem0 for future sessions.

## Usage
- `/remember <text>` - Store with auto-detected category
- `/remember --category <category> <text>` - Specify category
- `/remember --success <text>` - Mark as successful pattern
- `/remember --failed <text>` - Mark as anti-pattern
- `/remember --graph <text>` - Enable graph memory for relationships
- `/remember --agent <agent-id> <text>` - Store in agent-specific scope
- `/remember --global <text>` - Store as cross-project best practice

## Categories
decision, architecture, pattern, blocker, constraint, preference, pagination, database, authentication, api, frontend, performance

## Arguments
- Text: What to remember (decision, pattern, or context)
