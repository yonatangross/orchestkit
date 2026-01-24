---
name: best-practices
description: View and manage your personal best practices library with success/failure patterns. Use when viewing best practices, checking patterns, reviewing success/failure history.
context: inherit
version: 1.0.0
author: OrchestKit
tags: [best-practices, patterns, anti-patterns, mem0, learning]
user-invocable: false
allowedTools: [Read, mcp__mem0__search_memories]
---

# Best Practices - View Your Pattern Library

Display your aggregated best practices library, showing successful patterns and anti-patterns across all projects.

## Usage

```
/best-practices                     # Show full library
/best-practices <category>          # Filter by category
/best-practices --warnings          # Show only anti-patterns
/best-practices --successes         # Show only successes
/best-practices --stats             # Show statistics only
```

## Options

- `<category>` - Filter by specific category (pagination, database, authentication, etc.)
- `--warnings` - Show only anti-patterns (failed patterns)
- `--successes` - Show only successful patterns
- `--stats` - Show statistics summary without individual patterns

## Workflow

### 1. Query mem0 for Best Practices

Use `mcp__mem0__search_memories` with:

```json
{
  "query": "patterns outcomes",
  "filters": {
    "OR": [
      { "metadata.outcome": "success" },
      { "metadata.outcome": "failed" }
    ]
  },
  "limit": 100
}
```

### 2. Aggregate Results

Group patterns by category, then by outcome:

```json
{
  "pagination": {
    "successes": [...],
    "failures": [...]
  },
  "authentication": {
    "successes": [...],
    "failures": [...]
  }
}
```

### 3. Calculate Statistics

For each pattern:
- Count occurrences across projects
- Calculate success rate: successes / (successes + failures)
- Note which projects contributed

### 4. Display Output

**Full Library View:**
```
📚 Your Best Practices Library
═══════════════════════════════════════════════════════════════

PAGINATION
─────────────────────────────────────────────────────────────
  ✅ Cursor-based pagination (3 projects, always worked)
     "Scales well for large datasets"

  ❌ Offset pagination (failed in 2 projects)
     "Caused timeouts on tables with 1M+ rows"
     💡 Lesson: Use cursor-based for large datasets

AUTHENTICATION
─────────────────────────────────────────────────────────────
  ✅ JWT + httpOnly refresh tokens (4 projects)
     "Secure and scalable for web apps"

  ⚠️ Session-based auth (mixed: 1 success, 1 failure)
     "Works but scaling issues in high-traffic scenarios"

───────────────────────────────────────────────────────────────
📊 Summary: 8 patterns | 5 ✅ successes | 3 ❌ anti-patterns
💡 Use `/remember --success` or `/remember --failed` to add more
```

**Stats Only View (`--stats`):**
```
📊 Best Practices Statistics
═══════════════════════════════════════════════════════════════

Total Patterns: 15
├── ✅ Successful: 10 (67%)
├── ❌ Anti-patterns: 5 (33%)
└── ⚠️ Mixed: 2

Categories:
├── pagination: 3 patterns (2 ✅, 1 ❌)
├── authentication: 4 patterns (3 ✅, 1 ⚠️)
├── database: 5 patterns (4 ✅, 1 ❌)
└── api: 3 patterns (1 ✅, 2 ❌)

Projects Contributing: 7
Last Updated: 2 days ago
```

**Filtered View (by category):**
```
📚 Best Practices: PAGINATION
═══════════════════════════════════════════════════════════════

  ✅ Cursor-based pagination (3 projects, always worked)
     "Scales well for large datasets"
     Projects: project-a, project-b, project-c

  ❌ Offset pagination (failed in 2 projects)
     "Caused timeouts on tables with 1M+ rows"
     💡 Lesson: Use cursor-based for large datasets
     Projects: project-a, project-d
```

## Pattern Confidence Indicators

| Icon | Meaning |
|------|---------|
| ✅ | Strong success (3+ projects, 100% success rate) |
| ✓ | Moderate success (1-2 projects or some failures) |
| ⚠️ | Mixed results (both successes and failures) |
| ❌ | Anti-pattern (only failures) |
| 🔴 | Strong anti-pattern (3+ projects, all failed) |

## Empty Library

```
📚 Your Best Practices Library is empty

Start building it with:
• /remember --success "Pattern that worked well"
• /remember --failed "Pattern that caused problems"

Your patterns will be tracked across all projects and help
Claude warn you before repeating past mistakes.
```

## Proactive Integration

See `references/proactive-warnings.md` for automatic anti-pattern detection.

## Related Skills
- code-review-playbook: Review best practices
- api-design-framework: API design best practices
- testing-strategy: Testing best practices
- security-hardening: Security best practices
## Related Commands

- `/remember --success <text>` - Add a successful pattern
- `/remember --failed <text>` - Add an anti-pattern
- `/recall <query>` - Search all memories (not just best practices)