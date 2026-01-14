---
name: recall
description: Search and retrieve decisions and patterns from semantic memory
context: inherit
version: 1.0.0
author: SkillForge
tags: [memory, search, decisions, patterns, mem0]
---

# Recall - Search Semantic Memory

Search past decisions and patterns stored in mem0.

## When to Use

- Finding past architectural decisions
- Searching for recorded patterns
- Looking up project context
- Retrieving stored knowledge

## Usage

```
/recall <search query>
/recall --category <category> <search query>
/recall --limit <number> <search query>
```

## Options

- `--category <category>` - Filter by category (decision, architecture, pattern, blocker, constraint, preference, pagination, database, authentication, api, frontend, performance)
- `--limit <number>` - Maximum results to return (default: 10)

## Workflow

### 1. Parse Input

```
Check for --category <category> flag
Check for --limit <number> flag
Extract the search query
```

### 2. Search mem0

Use `mcp__mem0__search_memories` with:

```json
{
  "query": "user's search query",
  "filters": {
    "AND": [
      { "user_id": "skillforge-{project-name}-decisions" }
    ]
  },
  "limit": 10
}
```

If category specified, include it in the search context.

### 3. Format Results

```
🔍 Found {count} memories matching "{query}":

1. [{time ago}] ({category}) {memory text}

2. [{time ago}] ({category}) {memory text}
```

### 4. Handle No Results

```
🔍 No memories found matching "{query}"

Try:
• Broader search terms
• /remember to store new decisions
• Check if mem0 is configured correctly
```

## Time Formatting

| Duration | Display |
|----------|---------|
| < 1 day | "today" |
| 1 day | "yesterday" |
| 2-7 days | "X days ago" |
| 1-4 weeks | "X weeks ago" |
| > 4 weeks | "X months ago" |

## Examples

### Basic Search

**Input:** `/recall database`

**Output:**
```
🔍 Found 3 memories matching "database":

1. [2 days ago] (decision) PostgreSQL chosen for ACID requirements and team familiarity

2. [1 week ago] (pattern) Database connection pooling with pool_size=10, max_overflow=20

3. [2 weeks ago] (architecture) Using pgvector extension for vector similarity search
```

### Category Filter

**Input:** `/recall --category architecture API`

**Output:**
```
🔍 Found 2 memories matching "API" (category: architecture):

1. [3 days ago] (architecture) Layered API architecture with controllers, services, repositories

2. [1 week ago] (architecture) API versioning using /api/v1 prefix in URL path
```

### Limited Results

**Input:** `/recall --limit 5 auth`

**Output:**
```
🔍 Found 5 memories matching "auth":

1. [1 day ago] (decision) JWT authentication with 24h expiry for access tokens

2. [3 days ago] (pattern) Refresh tokens stored in httpOnly cookies

3. [1 week ago] (architecture) Auth middleware in src/auth/middleware.py

4. [1 week ago] (constraint) Must support OAuth2 for enterprise customers

5. [2 weeks ago] (blocker) Auth tokens not refreshing properly - fixed by adding token rotation
```

## Error Handling

- If mem0 unavailable, inform user to check MCP configuration
- If search query empty, show recent memories instead
- If no results, suggest alternatives