# Contributing Skills

Standards for authoring OrchestKit skills. Read this before creating or modifying skills.

Based on [Anthropic Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [Vercel agent-skills](https://github.com/vercel-labs/agent-skills) (129K installs), and the [Agent Skills Open Standard](https://agentskills.io).

## Skill Directory Structure

```
src/skills/my-skill/
├── SKILL.md              # Main instructions (required, < 500 lines)
├── rules/                # Prescriptive patterns (optional)
│   ├── _sections.md      # TOC — categories, impact levels, rule list
│   ├── _template.md      # Copy this to create new rules
│   └── area-name.md      # Individual rule files (area-prefixed)
├── references/           # Explanatory content (optional)
│   └── topic.md          # Concept overviews, migration guides, decision trees
├── scripts/              # Executable helpers (optional)
│   └── helper.sh         # Run via bash, output-only in context
└── test-cases.json       # Evaluation scenarios (optional)
```

## SKILL.md

The entrypoint. Claude loads this when the skill is triggered. Keep it focused as an **index/overview** — detailed content goes in supporting files.

### Constraints

- **Under 500 lines** (Anthropic recommendation)
- **Under 400 lines** preferred — leave room for inline examples
- Target: ~100-200 lines for index-style skills, ~300-400 for workflow skills

### Required Frontmatter

```yaml
---
name: my-skill
description: What it does AND when to use it. Write in third person.
tags: [tag1, tag2, tag3]
version: 2.0.0
author: OrchestKit
user-invocable: false    # true for /slash-command skills
complexity: low | medium | high
---
```

The `description` is critical — Claude uses it to decide whether to load the skill. Include both **what** (capabilities) and **when** (trigger conditions). Max 1024 chars.

**Good**: "API design patterns for REST/GraphQL framework design, versioning strategies, and RFC 9457 error handling. Use when designing API endpoints, choosing versioning schemes, implementing Problem Details errors, or building OpenAPI specifications."

**Bad**: "Helps with APIs."

### Optional Frontmatter

```yaml
context: fork            # Run in isolated subagent
agent: backend-system-architect  # Which subagent type (requires context: fork)
disable-model-invocation: true   # Manual-only (/slash-command)
allowed-tools: Read, Grep, Glob  # Restrict tools when active
model: opus              # Model override
```

### Structure Pattern

For skills with rules, use this index layout:

```markdown
# Skill Name

Brief description. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Category A](#category-a) | 3 | HIGH | Brief trigger description |
| [Category B](#category-b) | 4 | CRITICAL | Brief trigger description |

**Total: N rules across M categories**

## Category A

One-line description of this category.

| Rule | File | Key Pattern |
|------|------|-------------|
| Rule Name | `rules/area-name.md` | Brief pattern description |

## Quick Start Example

(Short, runnable code block)

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Choice A | Option X because Y |

## Common Mistakes

1. Mistake (consequence)
2. Mistake (consequence)
```

## Rules

Prescriptive patterns: "do this, not that" with code examples. The core content of tech/pattern skills.

### When to Use `rules/`

- Implementation patterns the agent should follow when writing code
- Incorrect/correct code pairs showing common mistakes
- Framework-specific conventions and gotchas
- Opinionated decisions ("use X, not Y")

### Rule File Format

```yaml
---
title: Rule Name
impact: CRITICAL | HIGH | MEDIUM | LOW
impactDescription: "One sentence — what goes wrong without this rule"
tags: tag1, tag2, tag3
---

## Rule Name

Brief description — 1-2 sentences.

**Incorrect:**
\`\`\`python
# Bad pattern with inline comments explaining why
\`\`\`

**Correct:**
\`\`\`python
# Good pattern with inline comments explaining why
\`\`\`

**Key rules:**
- Actionable bullet 1
- Actionable bullet 2
- Actionable bullet 3

Reference: [Link to official docs](url)
```

### Impact Levels

| Level | Meaning | Example |
|-------|---------|---------|
| CRITICAL | Silent data loss, security holes, crashes | Wrong state schema loses data across nodes |
| HIGH | Broken functionality, poor reliability | Missing worker→supervisor edges cause hangs |
| MEDIUM | Suboptimal but functional | Default stream mode returns full state |
| LOW | Minor efficiency or style | Micro-optimization patterns |

### Content Principles

**"Claude already knows this"** — only add content Claude doesn't have.

| Add | Skip |
|-----|------|
| LangGraph `Annotated[list, add]` gotcha | HTTP status code tables |
| "Use Command API, not deprecated set_entry_point()" | "Use plural nouns for REST collections" |
| Organization-specific conventions | Standard language features |
| Non-obvious framework behavior | Basic design patterns |

Ask: "Would Claude make a mistake without this rule?" If no, don't write it.

### Naming Conventions

- **Filenames**: `area-name.md` using kebab-case with area prefix
- **Area prefix** = category from `_sections.md` (e.g., `state-`, `routing-`, `streaming-`)
- **Examples**: `state-typeddict.md`, `routing-conditional.md`, `streaming-modes.md`

### Size Guidelines

- Individual rule: **40-100 lines** (including code blocks)
- Max: **150 lines** — split if larger
- Merge rules when: same area prefix, both < 80 lines, always needed together
- **Max ~25 supporting files** per skill — consolidate if exceeding

## `_sections.md`

Table of contents for the `rules/` directory. Helps Claude navigate without reading every file.

### Format

```yaml
---
title: Skill Name Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Category Name (area-prefix) — IMPACT — N rules

One-line description of what this category covers.

- `area-name.md` — Brief description of this specific rule
- `area-other.md` — Brief description of this specific rule

## 2. Next Category (prefix) — IMPACT — N rules

...
```

### Rules for `_sections.md`

- Number categories sequentially
- Format: `## N. Category (prefix) — IMPACT — N rules`
- List every rule file with a one-line description
- Keep descriptions short (< 15 words)

## `_template.md`

Copy-paste template for creating new rules. Place in every `rules/` directory.

```yaml
---
title: [Rule Name]
impact: [CRITICAL | HIGH | MEDIUM | LOW]
impactDescription: "[What goes wrong without this rule]"
tags: [tag1, tag2, tag3]
---

## [Rule Name]

[Brief description — 1-2 sentences.]

**Incorrect:**
\`\`\`[language]
// Bad pattern
\`\`\`

**Correct:**
\`\`\`[language]
// Good pattern
\`\`\`

**Key rules:**
- [Rule 1]
- [Rule 2]
- [Rule 3]

Reference: [link]
```

## References

Explanatory content that helps Claude understand concepts to make decisions. NOT implementation instructions.

### When to Use `references/`

- Concept overviews ("what is X and how does it work")
- Migration guides (step-by-step transitions)
- Decision trees ("when to choose A vs B")
- Example sessions, case studies
- Rubrics and scoring templates
- API documentation summaries

### When NOT to Use `references/`

If the content says "do this" or "don't do that" with code examples, it's a **rule**, not a reference.

### Which Skills Use References Only

Orchestration/workflow skills (implement, explore, verify, review-pr, assess, brainstorming, etc.) describe workflow phases, not code patterns. Their references are correct as-is — don't force them into `rules/` format.

## Scripts

Executable helpers that Claude runs without loading source into context. Only the output consumes tokens.

### When to Use `scripts/`

- Validation/linting wrappers
- Scaffold generators
- Data extraction utilities
- Any operation that's more reliable as code than as instructions

### Script Guidelines

- Use `#!/usr/bin/env bash` for portability
- Include `--help` flag
- Handle errors explicitly — don't punt to Claude
- Reference from SKILL.md: "Run `scripts/name.sh` to..."

## `test-cases.json`

Evaluation scenarios to verify skill effectiveness.

### Format

```json
[
  {
    "skills": ["skill-name"],
    "query": "User prompt that should trigger this skill",
    "expected_behavior": [
      "Claude does X",
      "Claude applies Y pattern from rules/area-name.md",
      "Output includes Z"
    ]
  }
]
```

Include at least 3 scenarios per skill: a basic case, an edge case, and a case where the skill should NOT activate.

## Checklist

Before submitting a skill change:

- [ ] SKILL.md under 500 lines
- [ ] Description includes WHAT + WHEN (third person)
- [ ] Rules have YAML frontmatter with impact tag
- [ ] Rules have incorrect/correct examples
- [ ] `_sections.md` lists all rule files
- [ ] No content Claude already knows (the "Claude filter")
- [ ] Area-prefixed filenames in `rules/`
- [ ] Supporting files referenced from SKILL.md
- [ ] `npm run build` passes
- [ ] `npm run test:skills` passes
