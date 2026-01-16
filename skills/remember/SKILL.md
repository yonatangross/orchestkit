---
name: remember
description: Store decisions and patterns in semantic memory with success/failure tracking. Use when saving patterns, storing decisions, remembering approaches that worked.
context: inherit
version: 1.1.0
author: SkillForge
tags: [memory, decisions, patterns, best-practices, mem0, graph-memory]
user-invocable: true
---

# Remember - Store Decisions and Patterns

Store important decisions, patterns, or context in mem0 for future sessions. Supports tracking success/failure outcomes for building a Best Practice Library.

## When to Use

- Recording architectural decisions
- Storing successful patterns
- Recording anti-patterns (things that failed)
- Saving project-specific context
- Building cross-project best practices library

## Usage

```
/remember <text>
/remember --category <category> <text>
/remember --success <text>     # Mark as successful pattern
/remember --failed <text>      # Mark as anti-pattern
/remember --success --category <category> <text>

# Advanced options (v1.1.0+)
/remember --graph <text>                    # Enable graph memory for relationships
/remember --agent <agent-id> <text>         # Store in agent-specific scope
/remember --global <text>                   # Store as cross-project best practice
/remember --global --success --graph <text> # Combine flags
```

## Advanced Flags

- `--graph` - Enable graph memory to extract entities and relationships (useful for "X uses Y" patterns)
- `--agent <agent-id>` - Scope memory to a specific agent (e.g., `database-engineer`, `backend-system-architect`)
- `--global` - Store as cross-project best practice (user_id: `skillforge-global-best-practices`)

## Categories

- `decision` - Why we chose X over Y (default)
- `architecture` - System design and patterns
- `pattern` - Code conventions and standards
- `blocker` - Known issues and workarounds
- `constraint` - Limitations and requirements
- `preference` - User/team preferences
- `pagination` - Pagination strategies
- `database` - Database patterns
- `authentication` - Auth approaches
- `api` - API design patterns
- `frontend` - Frontend patterns
- `performance` - Performance optimizations

## Outcome Flags

- `--success` - Pattern that worked well (positive outcome)
- `--failed` - Pattern that caused problems (anti-pattern)

If neither flag is provided, the memory is stored as neutral (informational).

## Workflow

### 1. Parse Input

```
Check for --success flag → outcome: success
Check for --failed flag → outcome: failed
Check for --category <category> flag
Check for --graph flag → enable_graph: true
Check for --agent <agent-id> flag → agent_id: "skf:{agent-id}"
Check for --global flag → use global user_id
Extract the text to remember
If no category specified, auto-detect from content
```

### 2. Auto-Detect Category

| Keywords | Category |
|----------|----------|
| chose, decided, selected | decision |
| architecture, design, system | architecture |
| pattern, convention, style | pattern |
| blocked, issue, bug, workaround | blocker |
| must, cannot, required, constraint | constraint |
| pagination, cursor, offset, page | pagination |
| database, sql, postgres, query | database |
| auth, jwt, oauth, token, session | authentication |
| api, endpoint, rest, graphql | api |
| react, component, frontend, ui | frontend |
| performance, slow, fast, cache | performance |

### 3. Extract Lesson (for anti-patterns)

If outcome is "failed", look for:
- "should have", "instead use", "better to"
- If not found, prompt user: "What should be done instead?"

### 4. Store in mem0

Use `mcp__mem0__add_memory` with:

```json
{
  "user_id": "skillforge-{project-name}-decisions",
  "text": "The user's text",
  "agent_id": "skf:{agent-id}",
  "enable_graph": true,
  "metadata": {
    "category": "detected_category",
    "outcome": "success|failed|neutral",
    "timestamp": "current_datetime",
    "project": "current_project_name",
    "source": "user",
    "lesson": "extracted_lesson_if_failed"
  }
}
```

**User ID Selection:**
- Default: `skillforge-{project-name}-decisions`
- With `--global`: `skillforge-global-best-practices`
- With `--agent`: Include `agent_id` field for agent-scoped retrieval

**Optional Parameters (include when flags set):**
- `enable_graph`: true (when `--graph` flag used)
- `agent_id`: "skf:{agent-id}" (when `--agent` flag used)

### 5. Confirm Storage

**For success:**
```
✅ Remembered SUCCESS (category): "summary of text"
   → Added to your Best Practice Library
   📊 Graph: enabled (if --graph used)
   🤖 Agent: {agent-id} (if --agent used)
   🌐 Scope: global (if --global used)
```

**For failed:**
```
❌ Remembered ANTI-PATTERN (category): "summary of text"
   → Added to your Best Practice Library
   💡 Lesson: {lesson if extracted}
```

**For neutral:**
```
✓ Remembered (category): "summary of text"
   → Will be recalled in future sessions
```

## Examples

### Success Pattern

**Input:** `/remember --success Cursor-based pagination scales well for large datasets`

**Output:**
```
✅ Remembered SUCCESS (pagination): "Cursor-based pagination scales well for large datasets"
   → Added to your Best Practice Library
```

### Anti-Pattern

**Input:** `/remember --failed Offset pagination caused timeouts on tables with 1M+ rows`

**Output:**
```
❌ Remembered ANTI-PATTERN (pagination): "Offset pagination caused timeouts on tables with 1M+ rows"
   → Added to your Best Practice Library
   💡 Lesson: Use cursor-based pagination for large datasets
```

### Graph Memory (New)

**Input:** `/remember --graph --success database-engineer uses pgvector for RAG applications`

**Output:**
```
✅ Remembered SUCCESS (database): "database-engineer uses pgvector for RAG applications"
   → Added to your Best Practice Library
   📊 Graph: enabled - extracted entities: database-engineer, pgvector, RAG
```

### Agent-Scoped Memory (New)

**Input:** `/remember --agent backend-system-architect Use connection pooling with min=5, max=20`

**Output:**
```
✓ Remembered (database): "Use connection pooling with min=5, max=20"
   → Scoped to agent: backend-system-architect
```

### Global Best Practice (New)

**Input:** `/remember --global --success Always validate user input at API boundaries`

**Output:**
```
✅ Remembered SUCCESS (api): "Always validate user input at API boundaries"
   → Added to GLOBAL Best Practice Library (available in all projects)
```

## Duplicate Detection

Before storing, search for similar patterns:
1. Query mem0 with the text content
2. If >80% similarity found with same category and outcome:
   - Increment "occurrences" counter on existing memory
   - Inform user: "✓ Updated existing pattern (now seen in X projects)"
3. If similar pattern found with opposite outcome:
   - Warn: "⚠️ This conflicts with an existing pattern. Store anyway?"


## Related Skills
- recall: Retrieve stored information

## Error Handling

- If mem0 unavailable, inform user to check MCP configuration
- If text is empty, ask user to provide something to remember
- If text >2000 chars, truncate with notice
- If both --success and --failed provided, ask user to clarify
- If --agent used without agent-id, prompt for agent selection