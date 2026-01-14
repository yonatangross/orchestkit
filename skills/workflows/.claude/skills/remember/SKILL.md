---
name: remember
description: Store decisions and patterns in semantic memory with success/failure tracking
context: inherit
version: 1.0.0
author: SkillForge
tags: [memory, decisions, patterns, best-practices, mem0]
---

# Remember - Store Decisions and Patterns

Store important decisions, patterns, or context in mem0 for future sessions. Supports tracking success/failure outcomes for building a Best Practice Library.

## When to Use

- Recording architectural decisions
- Storing successful patterns
- Recording anti-patterns (things that failed)
- Saving project-specific context

## Usage

```
/remember <text>
/remember --category <category> <text>
/remember --success <text>     # Mark as successful pattern
/remember --failed <text>      # Mark as anti-pattern
/remember --success --category <category> <text>
```

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
  "user_id": "skillforge-{project-name}-best-practices",
  "text": "The user's text",
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

### 5. Confirm Storage

**For success:**
```
✅ Remembered SUCCESS (category): "summary of text"
   → Added to your Best Practice Library
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

## Duplicate Detection

Before storing, search for similar patterns:
1. Query mem0 with the text content
2. If >80% similarity found with same category and outcome:
   - Increment "occurrences" counter on existing memory
   - Inform user: "✓ Updated existing pattern (now seen in X projects)"
3. If similar pattern found with opposite outcome:
   - Warn: "⚠️ This conflicts with an existing pattern. Store anyway?"

## Error Handling

- If mem0 unavailable, inform user to check MCP configuration
- If text is empty, ask user to provide something to remember
- If text >2000 chars, truncate with notice
- If both --success and --failed provided, ask user to clarify