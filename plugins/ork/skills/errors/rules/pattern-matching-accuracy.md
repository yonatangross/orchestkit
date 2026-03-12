---
title: Match error patterns precisely to avoid applying wrong fix templates to unrelated errors
impact: HIGH
impactDescription: "Applying a fix template for the wrong error pattern introduces new bugs while leaving the original error unresolved"
tags: [errors, patterns, matching, debugging, accuracy]
---

# Match Error Patterns Precisely

## Why

Error messages often share surface-level keywords. "connection refused" can mean a database is down, an API is unreachable, or a Docker network is misconfigured. Matching on keywords alone applies the wrong fix template, introducing new issues.

## Rule

When matching errors to known patterns:
1. Match the full error signature (tool + message + context), not just keywords
2. Verify the tool name matches the expected source
3. Check the input/command that triggered the error
4. Confirm the fix template applies to this specific scenario

## Incorrect — keyword-only matching

```json
{
  "rules": [
    {
      "pattern": "connection refused",
      "fix_suggestion": "Start the PostgreSQL container"
    }
  ]
}
```

```python
# Matches ANY "connection refused" error
def find_fix(error_message: str) -> str:
    if "connection refused" in error_message:
        return "Start the PostgreSQL container"
    return "Unknown error"

# This will incorrectly tell users to start Postgres when:
# - Redis is down (port 6379)
# - An external API is unreachable (port 443)
# - MCP server failed to start (port 3100)
```

## Correct — match full error signature

```json
{
  "rules": [
    {
      "id": "pg-conn-001",
      "pattern": "connection refused",
      "tool": "Bash",
      "input_pattern": "psql|pg_|postgres|5432",
      "signature": "PostgreSQL connection refused",
      "fix_suggestion": "Start PostgreSQL: docker compose up -d postgres"
    },
    {
      "id": "redis-conn-001",
      "pattern": "connection refused",
      "tool": "Bash",
      "input_pattern": "redis|6379",
      "signature": "Redis connection refused",
      "fix_suggestion": "Start Redis: docker compose up -d redis"
    }
  ]
}
```

```python
import re
from dataclasses import dataclass

@dataclass
class ErrorRule:
    id: str
    pattern: str
    tool: str
    input_pattern: str
    fix_suggestion: str

def find_fix(tool: str, error_message: str, tool_input: str, rules: list[ErrorRule]) -> ErrorRule | None:
    for rule in rules:
        if (rule.pattern in error_message
            and rule.tool == tool
            and re.search(rule.input_pattern, tool_input)):
            return rule
    return None  # No match — do not guess
```

## Matching Precision Checklist

| Field | Required | Purpose |
|-------|----------|---------|
| Error message pattern | Yes | What went wrong |
| Tool name | Yes | Where it happened |
| Input/command pattern | Yes | What triggered it |
| Occurrence count | Recommended | Confidence level |
| Last seen timestamp | Recommended | Staleness detection |

## Common Ambiguous Patterns

| Keyword | Could Mean | Disambiguate By |
|---------|-----------|-----------------|
| `connection refused` | DB, cache, API, MCP | Port number or tool |
| `not found` | File, command, module, route | Error code (404 vs ENOENT) |
| `permission denied` | File, network, auth | Path or HTTP status |
| `timeout` | DB query, HTTP, DNS | Timeout duration and target |
