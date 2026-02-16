---
title: Codebase Scan Patterns
impact: HIGH
impactDescription: "Grep patterns and severity classification for detecting upgrade-breaking changes"
tags: scan, grep, patterns, codebase
---

# Codebase Scan Patterns

Grep patterns and severity classification for Phase 3 of upgrade assessment.

## Scan Patterns

```bash
# 1. Model references (hardcoded model IDs)
grep -r "claude-opus-4\b\|claude-sonnet-4\b\|claude-haiku-3\b" src/ --include="*.md" --include="*.ts" --include="*.json"

# 2. Deprecated API patterns
grep -r "max_tokens_to_sample\|stop_sequences\|model.*claude-2" src/ --include="*.ts" --include="*.py"

# 3. CC version-gated features
grep -r "CC 2\.1\.\|claude-code.*2\.1\." src/ --include="*.md"

# 4. Hook compatibility (check for removed or renamed hook types)
grep -r "PreToolUse\|PostToolUse\|PermissionRequest\|Stop\|Notification" src/hooks/ --include="*.ts" --include="*.json"

# 5. Context window assumptions
grep -r "200000\|200_000\|128000\|128_000\|context.*window\|max_context" src/ --include="*.ts" --include="*.md" --include="*.py"

# 6. Output token assumptions
grep -r "max_tokens.*4096\|max_tokens.*8192\|max_output\|output.*limit" src/ --include="*.ts" --include="*.py"
```

## Severity Classification

Classify each finding by severity:

- **CRITICAL**: Hardcoded model IDs, removed API fields, breaking hook changes
- **WARNING**: Outdated context window assumptions, deprecated patterns
- **INFO**: Version references in documentation, optional feature flags

**Incorrect — Generic grep without severity classification creates unactionable scan reports:**
```bash
grep -r "claude" src/
# 2000 matches with no classification or context
```

**Correct — Targeted grep with severity classification produces actionable findings:**
```bash
# CRITICAL: Hardcoded model IDs
grep -r "claude-opus-4\b\|claude-sonnet-4\b" src/ --include="*.ts"
# WARNING: Context window assumptions
grep -r "200000\|200_000" src/ --include="*.ts" --include="*.md"
# Each finding gets severity label for prioritization
```
