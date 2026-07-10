---
name: help
license: MIT
compatibility: "Claude Code 2.1.206+."
description: "OrchestKit help directory with categorized skill listings. Use when discovering skills for a task, finding the right workflow, or browsing capabilities."
argument-hint: "[category]"
context: inherit
version: 2.1.0
author: OrchestKit
tags: [help, documentation, skills, discovery, meta]
user-invocable: true
allowed-tools: [AskUserQuestion, Read, Grep, Glob]
complexity: low
persuasion-type: collaborative
effort: low
model: haiku
metadata:
  category: document-asset-creation
triggers:
  keywords: [help, "what skills", "skills can i", "available commands", "which skill", "show me skills", "ork commands", "what can", "whats ork", "skill for"]
  examples:
    - "what orchestkit skills can i use"
    - "show me the available ork commands"
    - "help me find the right skill for code review"
  anti-triggers: [fix, implement, doctor, setup, explore, assess]
---

# OrchestKit Skill Directory

Dynamic skill discovery — reads from source at runtime so listings are never stale.

> **CC 2.1.121+ tip:** if you just want to find one skill quickly, the native `/skills` command now has type-to-filter — open it and start typing the skill name. Use `/ork:help` when you want categorized browsing or rationale for *why* a skill applies.

## Quick Start

```bash
/ork:help           # Show all categories
/ork:help build     # Show BUILD skills only
/ork:help git       # Show GIT skills only
/ork:help all       # List every user-invocable skill
```

## Argument Resolution

```python
CATEGORY = "$ARGUMENTS[0]"  # Optional: build, git, memory, quality, config, explore, plan, media, all
# If provided, skip AskUserQuestion and show that category directly.
# $ARGUMENTS is the full string (CC 2.1.59 indexed access)
```

---

## STEP 0: Dynamic Skill Discovery

**ALWAYS run this first** to get accurate, up-to-date skill data:

```python
# Scan all user-invocable skills from source
Grep(pattern="user-invocable:\\s*true", path="src/skills", output_mode="files_with_matches")
```

For each matched file, extract name and description from frontmatter:

```python
# For each SKILL.md found, read first 15 lines to get name + description
Read(file_path="src/skills/{name}/SKILL.md", limit=15)
```

Build the skill list dynamically. **Never hardcode counts or skill names.**

---

## STEP 1: Category Selection

If CATEGORY argument provided, skip to STEP 2 with that category.

Otherwise, present categories interactively:

```python
AskUserQuestion(
  questions=[{
    "question": "What type of task are you working on?",
    "header": "Category",
    # 4-option cap (CC schema): the 7 categories are grouped into 3 buckets +
    # "Show all". STEP 2 renders the constituent categories for the picked bucket.
    "options": [
      {"label": "Build & ship", "description": "Implement, brainstorm, test, commit, PR, fix issues"},
      {"label": "Plan & assess", "description": "PRDs, plan visualization, quality assessment, PR review"},
      {"label": "Explore & operate", "description": "Codebase exploration, memory, setup, diagnostics"},
      {"label": "Show all", "description": "List every user-invocable skill"}
    ],
    "multiSelect": false
  }]
)
```

---

## STEP 2: Render Category

For the selected category, render the skill table from the data gathered in STEP 0.

### Category-to-Skill Mapping

Granular categories (used by the CLI args `build`, `git`, … from STEP 1):

| Category | Skills |
|----------|--------|
| BUILD | implement, brainstorm, cover, verify |
| GIT | commit, create-pr, review-pr, fix-issue |
| PLAN | visualize-plan, write-prd, assess |
| MEMORY | remember, memory |
| QUALITY | assess, review-pr, doctor |
| CONFIG | setup, doctor, configure |
| EXPLORE | explore |

The STEP 0 picker only offers **3 buckets** (the AskUserQuestion schema caps a
question at 4 options) — each bucket renders the union of its categories:

| Picker bucket | Renders categories |
|---------------|--------------------|
| Build & ship | BUILD + GIT |
| Plan & assess | PLAN + QUALITY |
| Explore & operate | MEMORY + CONFIG + EXPLORE |

For each skill in the category, render:

```
/ork:{name}  v{version}  {complexity}
  {description}
  Example: /ork:{name} {argument-hint example}
```

### "Show all" — Full Listing

If user picks "Show all", render ALL user-invocable skills grouped by category from STEP 0 data.

---

## CC Built-in Commands (2.1.72+)

Not OrchestKit skills — these are Claude Code built-ins:

| Command | Description | Since |
|---------|-------------|-------|
| `/code-review` | Review changed code for correctness bugs at a chosen effort level; `--comment` posts inline PR comments (renamed from `/simplify` in 2.1.146; the old cleanup-and-fix behavior was removed) | CC 2.1.146 |
| `/help` | Claude Code built-in help | CC 2.1.0+ |
| `/config` | Claude Code configuration | CC 2.1.0+ |
| `/clear` | Clear conversation (preserves background agents) | CC 2.1.72 |
| `/fast` | Toggle fast mode (same model, faster output) | CC 2.1.59+ |
| `/loop` | Recurring interval (e.g. `/loop 5m /foo`) | CC 2.1.71 |
| `/plan` | Enter plan mode | CC 2.1.72 |
| `/team-onboarding` | Generate teammate ramp-up guide | CC 2.1.101 |
| `/ultraplan` | Remote-session deep planning | CC 2.1.101 |
| `/recap` | Session context restoration after idle | CC 2.1.108 |
| `/undo` | Alias for `/rewind` | CC 2.1.108 |
| `/skills` | Native skill picker — type to filter | CC 2.1.121 |
| `/effort` | Reasoning effort — sets `${CLAUDE_EFFORT}` env for skills | CC 2.1.72 (env var since 2.1.120) |
| `/cd` | Move session to a new working directory without breaking the prompt cache | CC 2.1.169 |
| `--safe-mode` | Start with ALL customizations disabled (troubleshooting bisect) | CC 2.1.169 (flag/env, not a slash command) |

## Performance Tips

- **`ENABLE_PROMPT_CACHING_1H=1`** — Extends prompt cache TTL from 5 min to 1 hour. Set this for long sessions with multi-phase skills (brainstorm, implement, cover). Available on API key, Bedrock, Vertex, Foundry.
- **`/recap`** — Restores session context after stepping away. Complements OrchestKit's checkpoint-resume for chain recovery.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Find in session output |
| `Esc` | Cancel / dismiss |
| `Shift+Enter` | Newline in input |
| `Ctrl+C` | Cancel operation |

---

## Pro Tip

You don't need to memorize skills. Just describe your task naturally:

```
"I need to implement user login"     → /ork:implement
"Show me the payment architecture"   → /ork:explore
"Review PR 123"                      → /ork:review-pr
"Is this code good?"                 → /ork:assess
"Plan out the billing redesign"      → /ork:visualize-plan
```

## Related Skills

- `/help` — Claude Code built-in help
- `/ork:doctor` — OrchestKit health check
- `/ork:setup` — Full onboarding wizard
