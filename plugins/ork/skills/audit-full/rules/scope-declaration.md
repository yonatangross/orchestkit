---
title: Declare audit scope upfront before loading files to avoid context window exhaustion
impact: HIGH
impactDescription: "Auditing everything without scope declaration wastes the 1M context window on irrelevant files, missing critical findings in files that matter"
tags: [audit, scope, context-window, planning]
---

# Declare Audit Scope Before Loading

## Why

The 1M context window is large but finite. Loading every file without a scope declaration means generated code, test fixtures, and vendor files consume tokens that should go to critical source files.

## Rule

Before loading any files, produce a scope declaration that includes:
1. Audit mode (security / architecture / dependency / full)
2. Directory inclusion list
3. File exclusion patterns
4. Estimated token budget vs available budget

## Incorrect — audit everything without scoping

```markdown
## Audit Plan
1. Load all files in the repository
2. Analyze everything
3. Generate report
```

```bash
# Loads everything including generated files
find . -name "*.ts" -o -name "*.js" | xargs cat
```

**Problems:**
- Generated files (`dist/`, `plugins/`) consume 40%+ of context
- Test fixtures and snapshots add noise
- No priority ordering means entry points may be truncated

## Correct — declare scope with budget allocation

```markdown
## Audit Scope Declaration

**Mode:** Security audit
**Target directories:** src/api/, src/auth/, src/middleware/
**Exclusions:** dist/, node_modules/, *.test.ts, *.spec.ts, __snapshots__/
**Token budget:** ~200K available, estimated usage: ~85K (42%)
**Priority order:**
  1. Entry points (src/index.ts, src/app.ts)
  2. Auth boundary (src/auth/*, src/middleware/auth*)
  3. Data access layer (src/db/*, src/repositories/*)
  4. API routes (src/api/*)
```

```bash
# Scoped file discovery with exclusions
find src/api src/auth src/middleware \
  -name "*.ts" \
  ! -name "*.test.ts" \
  ! -name "*.spec.ts" \
  ! -path "*/__snapshots__/*"
```

## Checklist

| Check | Required |
|-------|----------|
| Audit mode declared | Yes |
| Target directories listed | Yes |
| Exclusion patterns defined | Yes |
| Token budget estimated | Yes |
| Priority loading order set | Yes |
