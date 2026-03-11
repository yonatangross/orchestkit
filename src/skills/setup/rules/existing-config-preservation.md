---
title: Never overwrite existing CLAUDE.md without user confirmation
impact: HIGH
impactDescription: "Overwriting CLAUDE.md destroys project-specific instructions, coding standards, and team conventions that took significant effort to create"
tags: claude-md, preservation, safety, phase-3, phase-7b
---

## Existing Config Preservation

The setup wizard must treat existing `CLAUDE.md` and `.claude/rules/*.md` files as user-owned content that must never be overwritten or modified without explicit consent.

## Problem

A project has a carefully maintained `CLAUDE.md` with team coding standards, architecture decisions, and project-specific instructions. The setup wizard's Phase 7b (CLAUDE.md Health Check) decides the file is "too long" and rewrites it into a modular structure, destroying custom content that isn't recoverable from git if the user doesn't notice.

**Incorrect -- rewrite CLAUDE.md when it exceeds threshold:**
```python
# Phase 7b: Check CLAUDE.md health
line_count = Bash(command="wc -l CLAUDE.md | awk '{print $1}'")

if int(line_count) > 200:
    # Split into modular structure without asking
    sections = parse_sections("CLAUDE.md")
    for section in sections:
        Write(
            file_path=f".claude/rules/{section['name']}.md",
            content=section["content"]
        )
    # Rewrite CLAUDE.md with @imports
    Write(file_path="CLAUDE.md", content=generate_import_stub(sections))
    # Original CLAUDE.md content is now gone
```

**Correct -- analyze and recommend, never auto-modify:**
```python
# Phase 7b: Check CLAUDE.md health
line_count = Bash(command="wc -l CLAUDE.md 2>/dev/null | awk '{print $1}'")
existing_rules = Glob(pattern=".claude/rules/*.md")

if int(line_count) > 200 and not existing_rules:
    # Present analysis and recommendation only
    AskUserQuestion(questions=[{
        "question": "Your CLAUDE.md is " + line_count + " lines. "
            + "Modular structure (.claude/rules/) improves cache efficiency. "
            + "What would you like to do?",
        "options": [
            {"label": "Show split plan", "description": "Preview proposed sections without making changes"},
            {"label": "Skip", "description": "Keep current CLAUDE.md as-is"},
            {"label": "Add to plan", "description": "Add this to the P2 improvement plan for later"}
        ]
    }])
    # Never write to CLAUDE.md or .claude/rules/ without explicit "proceed" confirmation
```

**Key rules:**
- Never call `Write()` on `CLAUDE.md` or any `.claude/rules/*.md` without prior `AskUserQuestion` confirmation
- Phase 7b must only analyze and recommend -- never auto-modify
- If the user confirms a split, create new `.claude/rules/` files but keep the original `CLAUDE.md` intact until the user verifies the split is correct
- Preserve all existing `.claude/rules/*.md` files -- never delete or rename them
- When adding OrchestKit-specific rules, use a distinct prefix (e.g., `ork-`) to avoid collision with user rules
- On `--rescan`, re-read existing config files fresh rather than relying on cached state from a previous run
