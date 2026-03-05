---
paths:
  - "src/skills/**"
---

# Skill Authoring Rules

## SKILL.md Format
- **Max 500 lines** (< 400 preferred for prompt cache efficiency)
- Required frontmatter: `name`, `description`, `version`, `author`, `user-invocable`, `complexity`, `tags`
- Description must include **WHAT** (capabilities) + **WHEN** (trigger conditions) in third person
- At least 1 code example block required
- Token budget: 200-5000 tokens per skill

## Rules Subdirectory (rules/*.md)
- Individual rule files: 40-100 lines each (max 150)
- Filename format: `area-prefix-name.md` (kebab-case)
- Each needs frontmatter: `title`, `impact`, `impactDescription`, `tags`
- Include incorrect/correct code pairs in every rule
- Filter: "Would Claude make this mistake without this rule?" — if NO, skip it
- Max ~25 supporting files per skill

## After Changes
- Update `manifests/ork.json` if adding/removing skills
- Run: `npm run build && npm run test:skills`
- Check internal links to `references/`, `rules/`, `scripts/` before commit
- See `src/skills/CONTRIBUTING-SKILLS.md` for full authoring standards
