# Skills Validation

## Overview

OrchestKit includes 195 skills validated against frontmatter requirements and content standards.

## Skill Types

| Type | Count | Frontmatter |
|------|-------|-------------|
| User-invocable | 23 | `user-invocable: true` |
| Reference | 163 | `user-invocable: false` |

## Validation Checks

### 1. Frontmatter Fields

Required fields:
- `name` - Skill identifier
- `description` - Brief description with triggers
- `user-invocable` - Boolean for command availability

Optional fields:
- `context` - fork (recommended), inherit
- `agent` - Associated agent name
- `tags` - Keywords for discovery
- `version` - Semver version
- `allowedTools` - Tool whitelist

### 2. Token Budget

Skills must stay within token limits:
- Minimum: 300 tokens
- Maximum: 5000 tokens

```bash
# Check skill size
wc -c src/skills/*/SKILL.md | sort -n
```

### 3. Reference Links

All internal links must resolve:

```bash
# Check for broken references
for skill in src/skills/*/SKILL.md; do
  grep -o 'references/[^)]*' "$skill" | while read ref; do
    dir=$(dirname "$skill")
    [ -f "$dir/$ref" ] || echo "Broken: $skill -> $ref"
  done
done
```

### 4. Related Skills

All skills in "Related Skills" section must exist:

```bash
# Validate related skill references
grep -h "^- " src/skills/*/SKILL.md | grep -v "http" | \
  sed 's/.*`\([^`]*\)`.*/\1/' | sort -u
```

## Quick Validation

```bash
# Run full skill validation
npm run test:skills

# Or directly
./tests/skills/structure/test-skill-md.sh
```

## Common Issues

### Missing frontmatter

```yaml
---
name: my-skill
description: Does something useful
user-invocable: false
---
```

### Token budget exceeded

Split into SKILL.md + references/ directory.

### Broken reference link

Ensure file exists at `references/filename.md`.
