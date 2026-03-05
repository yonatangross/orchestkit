---
paths:
  - ".claude/rules/**"
---

# Rules About Rules

## Format
- Keep each rule file under 50 lines — concise guidance, not documentation
- Use `paths:` frontmatter with quoted glob patterns (YAML requires quotes for `*` and `{`)
- Global rules (no paths:) load every session — use sparingly

## Content Principles
- Actionable instructions, not explanations
- "Would Claude make a mistake without this rule?" — if NO, don't write it
- Prefer specific commands (run X, check Y) over general advice
- Rules compose: a file matching 3 rules gets all 3 injected
