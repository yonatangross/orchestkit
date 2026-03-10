---
name: help
license: MIT
compatibility: "Claude Code 2.1.72+."
description: "OrchestKit help directory with categorized skill listings. Use when discovering skills for a task, finding the right workflow, or browsing capabilities."
argument-hint: "[category]"
context: fork
version: 2.0.0
author: OrchestKit
tags: [help, documentation, skills, discovery, meta]
user-invocable: true
allowed-tools: [AskUserQuestion, Read, Grep, Glob]
complexity: low
model: haiku
metadata:
  category: document-asset-creation
---

# OrchestKit Skill Directory

Dynamic skill discovery — reads from source at runtime so listings are never stale.

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
    "options": [
      {"label": "BUILD", "description": "Implement features, brainstorm, verify", "markdown": "```\nBUILD — Feature Development\n───────────────────────────\n/ork:implement     Full-power implementation\n/ork:brainstorm    Design exploration\n/ork:verify        Test & grade changes\n```"},
      {"label": "GIT", "description": "Commits, PRs, issues, branches", "markdown": "```\nGIT — Version Control\n─────────────────────\n/ork:commit        Conventional commits\n/ork:create-pr     PR with validation\n/ork:review-pr     6-agent PR review\n/ork:fix-issue     Debug + fix + PR\n/ork:git-workflow   Branch patterns\n```"},
      {"label": "PLAN", "description": "PRDs, plan visualization, assessment", "markdown": "```\nPLAN — Design & Strategy\n────────────────────────\n/ork:visualize-plan  ASCII plan rendering\n/ork:write-prd       Product requirements\n/ork:assess          Rate 0-10 + report\n```"},
      {"label": "MEMORY", "description": "Store decisions, search, recall", "markdown": "```\nMEMORY — Knowledge Persistence\n──────────────────────────────\n/ork:remember  Store decisions/patterns\n/ork:memory    Search, recall, visualize\n```"},
      {"label": "QUALITY", "description": "Assess, review, diagnose", "markdown": "```\nQUALITY — Assessment & Health\n─────────────────────────────\n/ork:assess     Rate quality 0-10\n/ork:review-pr  6-agent PR review\n/ork:doctor     Plugin health check\n```"},
      {"label": "CONFIG", "description": "Setup, diagnostics, CI", "markdown": "```\nCONFIG — Setup & Operations\n───────────────────────────\n/ork:setup         Onboarding wizard\n/ork:doctor        Health diagnostics\n/ork:ci-automation CI/CD patterns\n```"},
      {"label": "EXPLORE", "description": "Codebase exploration and analysis", "markdown": "```\nEXPLORE — Codebase Analysis\n───────────────────────────\n/ork:explore  Multi-angle exploration\n              4 parallel agents\n              Architecture visualization\n```"},
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

| Category | Skills |
|----------|--------|
| BUILD | implement, brainstorm, verify |
| GIT | commit, create-pr, review-pr, fix-issue, git-workflow |
| PLAN | visualize-plan, write-prd, assess |
| MEMORY | remember, memory |
| QUALITY | assess, review-pr, doctor |
| CONFIG | setup, doctor, ci-automation |
| EXPLORE | explore |

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
| `/simplify` | Review changed code for quality, then fix | CC 2.1.63 |
| `/help` | Claude Code built-in help | CC 2.1.0+ |
| `/config` | Claude Code configuration | CC 2.1.0+ |
| `/clear` | Clear conversation (preserves background agents) | CC 2.1.72 |
| `/fast` | Toggle fast mode (same model, faster output) | CC 2.1.59+ |
| `/loop` | Recurring interval (e.g. `/loop 5m /foo`) | CC 2.1.71 |
| `/effort` | Reasoning effort: low/medium/high/auto | CC 2.1.72 |
| `/plan` | Enter plan mode | CC 2.1.72 |

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
