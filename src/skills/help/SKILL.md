---
name: help
description: "OrchestKit skill directory. Use when you want to see available skills or need help."
context: fork
version: 1.0.0
author: OrchestKit
tags: [help, documentation, skills, discovery, meta]
user-invocable: true
allowedTools: [AskUserQuestion]
complexity: low
---

# OrchestKit Skill Directory

Interactive guide to all user-invocable skills organized by category.

## Quick Start

```bash
/ork:help           # Show all categories
/ork:help build     # Show BUILD skills only
/ork:help git       # Show GIT skills only
```

---

## CRITICAL: Use AskUserQuestion for Category Selection

When invoked without arguments, present categories interactively:

```python
AskUserQuestion(
  questions=[{
    "question": "What type of task are you working on?",
    "header": "Category",
    "options": [
      {"label": "BUILD", "description": "Implement features, brainstorm, verify"},
      {"label": "GIT", "description": "Commits, PRs, issues, recovery"},
      {"label": "MEMORY", "description": "Store decisions, search, sync context"},
      {"label": "QUALITY", "description": "Assess code, health checks, golden datasets"},
      {"label": "CONFIG", "description": "Configure OrchestKit, feedback, skill evolution"},
      {"label": "EXPLORE", "description": "Explore codebase, coordinate worktrees"},
      {"label": "MEDIA", "description": "Create demo videos"},
      {"label": "Show all", "description": "List all 21 skills"}
    ],
    "multiSelect": false
  }]
)
```

---

## Skill Categories

### BUILD (3 skills)
*Implement features and verify changes*

| Skill | Description | Example |
|-------|-------------|---------|
| `/ork:implement` | Full-power feature implementation with parallel subagents | `/ork:implement user authentication` |
| `/ork:brainstorming` | Design exploration with parallel agents | `/ork:brainstorming API design for payments` |
| `/ork:verify` | Comprehensive verification with parallel test agents | `/ork:verify authentication flow` |

---

### GIT (5 skills)
*Version control and GitHub operations*

| Skill | Description | Example |
|-------|-------------|---------|
| `/ork:commit` | Creates commits with conventional format | `/ork:commit` |
| `/ork:create-pr` | Create GitHub pull requests with validation | `/ork:create-pr` |
| `/ork:review-pr` | PR review with parallel specialized agents | `/ork:review-pr 123` |
| `/ork:fix-issue` | Fix GitHub issues with parallel analysis | `/ork:fix-issue 456` |
| `/ork:git-recovery` | Recovery from git mistakes | `/ork:git-recovery` |

---

### MEMORY (2 skills)
*Knowledge persistence and retrieval*

| Skill | Description | Example |
|-------|-------------|---------|
| `/ork:remember` | Store decisions and patterns | `/ork:remember We use cursor pagination` |
| `/ork:memory` | Search, load, sync, history, viz | `/ork:memory search pagination` |

**Subcommands for `/ork:memory`:**
- `search` - Search decisions and patterns
- `load` - Load session context
- `sync` - Sync to mem0 cloud
- `history` - View decision timeline
- `viz` - Visualize knowledge graph

---

### QUALITY (4 skills)
*Assessment and diagnostics*

| Skill | Description | Example |
|-------|-------------|---------|
| `/ork:assess` | Rate quality 0-10 with pros/cons | `/ork:assess src/api/` |
| `/ork:assess-complexity` | Assess task complexity with metrics | `/ork:assess-complexity src/auth/` |
| `/ork:doctor` | OrchestKit health diagnostics | `/ork:doctor` |
| `/ork:add-golden` | Add documents to golden dataset | `/ork:add-golden` |

---

### CONFIG (3 skills)
*Plugin configuration and management*

| Skill | Description | Example |
|-------|-------------|---------|
| `/ork:configure` | OrchestKit configuration wizard | `/ork:configure` |
| `/ork:feedback` | Manage feedback system | `/ork:feedback` |
| `/ork:skill-evolution` | Evolve skills based on usage | `/ork:skill-evolution` |

---

### EXPLORE (2 skills)
*Codebase exploration and coordination*

| Skill | Description | Example |
|-------|-------------|---------|
| `/ork:explore` | Deep codebase exploration with agents | `/ork:explore authentication` |
| `/ork:worktree-coordination` | Coordinate multiple Claude instances | `/ork:worktree-coordination status` |

---

### MEDIA (1 skill)
*Content creation*

| Skill | Description | Example |
|-------|-------------|---------|
| `/ork:demo-producer` | Create polished demo videos | `/ork:demo-producer commit skill` |

---

## Pro Tip: Just Describe What You Want

You don't need to memorize skills! OrchestKit auto-suggests the right skill based on your prompt:

```
User: "I need to implement user login"
→ OrchestKit suggests: /ork:implement

User: "Show me how the payment system works"
→ OrchestKit suggests: /ork:explore

User: "Review PR 123"
→ OrchestKit suggests: /ork:review-pr
```

Just describe your task naturally and OrchestKit will recommend the appropriate skill or agent.

---

## Skill Count by Category

| Category | Count | Purpose |
|----------|-------|---------|
| BUILD | 3 | Feature development |
| GIT | 5 | Version control |
| MEMORY | 2 | Knowledge persistence |
| QUALITY | 4 | Assessment & diagnostics |
| CONFIG | 3 | Plugin management |
| EXPLORE | 2 | Code exploration |
| MEDIA | 1 | Content creation |
| META | 1 | This help skill |
| UPGRADE | 1 | Platform upgrade assessment |
| **Total** | **23** | |

---

## Related Skills

- `/help` - Claude Code built-in help
- `/config` - Claude Code configuration
- `/doctor` - OrchestKit health check
