---
title: Orchestration Skill Exceptions
tags: [audit, orchestration, exceptions]
---

# Orchestration Skill Exceptions

Some skills are orchestration-focused and intentionally have few or zero rules. They rely on `references/` for context and are driven by LLM judgment rather than prescriptive rules.

## Known Orchestration Skills

These should NOT be flagged for having 0 rules, as long as they have at least one reference:

- `implement` — high-level implementation orchestration
- `explore` — codebase exploration
- `verify` — verification and quality checking
- `brainstorming` — ideation and planning
- `plan-viz` — visualization and planning
- `assess` — assessment and evaluation

## Heuristic

If a skill name implies orchestration (multi-step coordination, planning, exploration) and has references/ content, treat 0 rules as acceptable.

If a skill has 0 rules AND 0 references, flag WARN regardless of skill type.
