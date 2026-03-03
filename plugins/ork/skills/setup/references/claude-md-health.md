# CLAUDE.md Health Check

## When to Run

Phase 7b of the setup wizard — after the improvement plan, check if the user's CLAUDE.md could benefit from modular structure.

## Analysis Steps

```python
# Count CLAUDE.md lines
Bash(command="wc -l CLAUDE.md 2>/dev/null | awk '{print $1}'")

# Check for existing @imports
Grep(pattern="^@", path="CLAUDE.md", output_mode="count")

# Check for .claude/rules/ directory
Glob(pattern=".claude/rules/*.md")
```

## Thresholds

| Lines | Verdict | Recommendation |
|-------|---------|----------------|
| < 100 | Healthy | No action needed |
| 100-200 | Fine | Mention @imports exist, no pressure |
| 200-500 | Recommend split | Suggest @imports or .claude/rules/ |
| > 500 | Strongly recommend | Show concrete split example |

## @import Syntax (CC 2.1.59+)

CLAUDE.md can import other files with `@path/to/file` syntax:

```markdown
# Project Overview
Brief description here.

# Standards
@docs/coding-standards.md
@docs/api-conventions.md
@docs/testing-guide.md
```

- Relative paths resolve from the file containing the import
- Recursive imports supported (max depth 5)
- Not evaluated inside code blocks
- First use in a project triggers an approval dialog

## .claude/rules/ Directory (CC 2.1.59+)

Alternative to @imports — auto-loaded markdown files:

```
.claude/rules/
├── code-style.md      # Always loaded (no frontmatter)
├── testing.md         # Always loaded
└── hooks-dev.md       # Conditionally loaded (has paths:)
```

### Path-Scoped Rules

Add `paths:` YAML frontmatter to scope rules to specific directories:

```markdown
---
paths:
  - "src/api/**/*.ts"
---
# API Development Rules
- All endpoints must include input validation
- Use standard error response format
```

Rules without `paths:` load unconditionally. Glob patterns supported: `**/*.ts`, `src/**/*`, `*.{ts,tsx}`.

### User-Level Rules

Personal rules at `~/.claude/rules/` apply to all projects (lower priority than project rules).

## Output Template

### Healthy (< 200 lines)

```
CLAUDE.md Health: Good (87 lines)
  No changes needed.
```

### Recommend Split (200-500 lines)

```
CLAUDE.md Health: Consider splitting (312 lines)

  CC 2.1.59+ supports modular instructions. Two options:

  Option A — @imports in CLAUDE.md:
    @docs/coding-standards.md
    @docs/api-conventions.md

  Option B — .claude/rules/ directory:
    .claude/rules/code-style.md     (always loaded)
    .claude/rules/api-rules.md      (loaded only for src/api/**)

  Benefits: less context noise per task, team can own separate rule files.
```

### Strongly Recommend (> 500 lines)

```
CLAUDE.md Health: Too large (634 lines)

  Large CLAUDE.md files degrade Claude's performance — too much context
  loaded for every task regardless of relevance.

  Recommended structure:
    CLAUDE.md (< 100 lines) — project overview + @imports
    .claude/rules/code-style.md — coding conventions
    .claude/rules/testing.md — test patterns
    .claude/rules/api.md — API standards (paths: src/api/**)
    .claude/rules/frontend.md — UI rules (paths: src/components/**)
```
