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
disable-model-invocation: true   # Manual-only (/slash-command) — DEFAULT
disable-model-invocation: false  # CC auto-selects via description matching
allowed-tools: Read, Grep, Glob  # Restrict tools when active
model: opus              # Model override
```

**Model invocation guide:**
- `disable-model-invocation: true` (default) — Skill only loads via `/ork:name` slash command. Use for workflow skills that orchestrate subagents (implement, verify, review-pr).
- `disable-model-invocation: false` — CC auto-selects the skill when the user's prompt matches the `description`. Use for knowledge/reference skills (api-design, security-patterns, testing-unit) that should activate contextually without requiring a slash command.

### Skill-Scoped Hooks

Skills can declare hooks in frontmatter. These run only while the skill is active:

```yaml
hooks:
  PreToolUse:
    - matcher: "Read"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/my-handler"
      once: true   # CC 2.1.69: runs once then auto-removes (context loaders)
```

Use `once: true` for one-shot setup (context loading, env detection, precondition checks). Omit `once` for guards that must run on every tool call (security, pattern enforcement).

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

Orchestration/workflow skills (implement, explore, verify, review-pr, assess, brainstorm, etc.) describe workflow phases, not code patterns. Their references are correct as-is — don't force them into `rules/` format.

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

## Prompt Cache-Friendly Patterns

Claude Code's performance depends on prompt caching — prefix-matching that reuses computation across turns. Skills that break caching patterns increase cost and latency for users.

### Why This Matters

Prompt caching works by prefix matching: static system prompt, then tools, then CLAUDE.md, then session context, then messages. Any change to the prefix invalidates the cache for everything after it.

### Rules

1. **Use `context: fork` for complex skills.** Forked skills reuse the parent conversation's cached prefix (system prompt + tools + CLAUDE.md). The fork only adds the skill content as new tokens. This is the most cache-efficient pattern for skills that spawn subagents or do heavy work.

2. **Never suggest model changes in skill instructions.** Switching models mid-conversation rebuilds the entire cache. Use subagents (`Task` tool) for different models — each subagent is a separate conversation with its own cache.

3. **Never add or remove tools dynamically.** Tools are part of the cached prefix. Skills should use state transitions via messages (like `EnterPlanMode`), not tool-set changes.

4. **Keep subagent prompts prefix-similar.** When spawning multiple subagents of the same type, put shared context first and dimension-specific instructions last. This maximizes cache reuse across subagents hitting the same model.

5. **Don't add MCP servers mid-session.** MCP tools are part of the cached prefix. Adding a server invalidates the cache for the entire conversation.

6. **Prefer `additionalContext` in messages over system prompt changes.** Hooks and skills should inject dynamic information via `<system-reminder>` tags in user messages, never by modifying the system prompt.

### Reference

Based on [Prompt Caching Lessons from Building Claude Code](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — the Claude Code team monitors cache hit rate like uptime and declares incidents when it drops.

## CC 2.1.49 Skill Patterns

Features available since CC 2.1.49 that skills should leverage:

### Worktree Isolation

Skills that spawn teams or modify many files should offer `EnterWorktree` for isolated work:

```python
AskUserQuestion(questions=[{
  "question": "Work in isolated worktree?",
  "options": [
    {"label": "Yes (Recommended)", "description": "Isolated branch, merge back when done"},
    {"label": "No", "description": "Work directly on current branch"}
  ]
}])
# If yes: EnterWorktree(name="feature-name")
```

### Agent Cleanup

Skills that spawn background agents or teams **must** include cleanup guidance:

- After `TeamDelete()`, add: "Press **Ctrl+F** twice to force-kill any orphaned background agents"
- Skills using `run_in_background=True` should document the cleanup path

### Background Agents

Agent definitions can include `background: true` in frontmatter for agents that never need interactive results. When referencing these agents from skills, note they always run in background.

### Plugin Settings

OrchestKit ships `settings.json` per plugin (`src/settings/<plugin>.settings.json`). Skills can reference default permissions and keybindings defined there. The `chat:newline` keybinding (Shift+Enter) is available via settings.

## Writing Effective Instructions

### Explain the Why, Not Just the What

If you find yourself writing ALWAYS or NEVER in all caps, that's a yellow flag. Today's LLMs are smart — they have good theory of mind and when given a clear explanation of *why* something matters, they go beyond rote instructions. Reframe heavy-handed rules into reasoning:

**Weak:**
```
ALWAYS use conventional commit format. NEVER skip the scope.
```

**Strong:**
```
Use conventional commit format (feat/fix/chore) because our changelog
generator parses these prefixes to categorize releases. Without a scope,
the changelog groups changes under "other" which is unhelpful for users
scanning release notes.
```

The reasoning approach is more humane, powerful, and effective than shouting in caps.

### Description Quality

The `description` field is the primary trigger mechanism — Claude decides whether to load a skill based on this text. Write descriptions that:

1. **Include positive triggers**: what the skill does and when to use it
2. **Include negative boundaries**: "Do NOT use for..." to prevent false positives
3. **Cover casual phrasing**: users say "save my progress" not "create a conventional commit"

**Good description:**
```
Creates commits with conventional format and validation. Use when
committing changes, generating commit messages, or saving progress.
Do NOT use for pushing, rebasing, squashing, or branch operations.
```

**Bad description:**
```
Helps with git commits.
```

### Eval Coverage (User-Invocable Skills)

User-invocable skills (`user-invocable: true`) should include eval entries in `tests/evals/skills/<name>.eval.yaml`. This file tests trigger accuracy (does the skill fire on the right prompts?) and quality (does the skill add value vs base Claude?).

```yaml
# tests/evals/skills/my-skill.eval.yaml
id: my-skill
name: "My skill evaluation"
skill_path: src/skills/my-skill/SKILL.md
plugin_dir: plugins/ork

trigger_evals:
  - prompt: "realistic user prompt that should trigger"
    should_trigger: true
  - prompt: "adjacent task that should NOT trigger"
    should_trigger: false

quality_evals:
  - prompt: "task to compare with-skill vs baseline"
    assertions:
      - name: "specific outcome"
        check: "what to look for in output"
```

Guidelines for eval entries:
- At least 5 trigger entries (3+ should-trigger, 2+ should-not)
- At least 1 quality entry with graded assertions
- Include **near-miss negatives** — prompts that share keywords but need a different skill
- Include **casual phrasing** — typos, abbreviations, informal requests
- Include **cross-skill confusion** — "assess this PR" vs "review this PR"

Run locally with CC Max: `npm run eval:trigger -- <skill-name>`

## Checklist

Before submitting a skill change:

- [ ] SKILL.md under 500 lines
- [ ] Description includes WHAT + WHEN (third person)
- [ ] Description includes negative boundaries ("Do NOT use for...")
- [ ] Instructions explain *why*, not just *what* (avoid ALWAYS/NEVER in caps)
- [ ] Rules have YAML frontmatter with impact tag
- [ ] Rules have incorrect/correct examples
- [ ] `_sections.md` lists all rule files
- [ ] No content Claude already knows (the "Claude filter")
- [ ] Area-prefixed filenames in `rules/`
- [ ] Supporting files referenced from SKILL.md
- [ ] Team-spawning skills include `Ctrl+F` cleanup note
- [ ] User-invocable skills have eval YAML in `tests/evals/skills/`
- [ ] `npm run build` passes
- [ ] `npm run test:skills` passes
- [ ] Run `/reload-plugins` to activate changes without restarting (CC 2.1.69+)
