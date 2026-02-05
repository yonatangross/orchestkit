# Frontmatter Parsing

## YAML Frontmatter Format

```yaml
---
name: skill-name
description: Brief description of the skill
context: fork | inherit | none
version: 1.0.0
author: OrchestKit
tags: [tag1, tag2, tag3]
user-invocable: true | false
---
```

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Skill identifier (kebab-case) |
| `description` | string | One-line description |
| `tags` | string[] | Semantic tags for discovery |

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `context` | string | `fork` | Context sharing mode |
| `version` | string | `1.0.0` | Semantic version |
| `author` | string | - | Creator attribution |
| `user-invocable` | bool | `false` | Can be called via `/skill-name` |

## Parsing Example

```python
import yaml
import re

def parse_frontmatter(content: str) -> dict:
    match = re.match(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
    if match:
        return yaml.safe_load(match.group(1))
    return {}
```

## Validation Rules

1. `name` must match directory name
2. `tags` should be 3-7 items
3. `description` should be < 200 chars
4. `context` must be one of: fork, inherit, none
