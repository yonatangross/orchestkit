---
title: Required Frontmatter Fields
impact: HIGH
tags: [audit, frontmatter, skill-quality]
---

# Required Frontmatter Fields

## Required Fields

Every `SKILL.md` must have all of these YAML frontmatter fields:

| Field | Example | Notes |
|-------|---------|-------|
| `name` | `commit` | Must match directory name |
| `description` | `"Creates commits..."` | Used in skill picker UI |
| `tags` | `[git, commit]` | Array of lowercase strings |
| `user-invocable` | `true` or `false` | Controls `/skill-name` availability |
| `complexity` | `low`, `medium`, or `high` | Used for loading decisions |

## Recommended Fields

| Field | Notes |
|-------|-------|
| `version` | `2.0.0` for current standard |
| `author` | `OrchestKit` |
| `agent` | Named agent to invoke |

## Severity

Missing any required field → WARN (skill will still load but may behave incorrectly).

## Check Method

```bash
# Check for missing field in a SKILL.md
grep -c "^name:" src/skills/<name>/SKILL.md
grep -c "^user-invocable:" src/skills/<name>/SKILL.md
```
