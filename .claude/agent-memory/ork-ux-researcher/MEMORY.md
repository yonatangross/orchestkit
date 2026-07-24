# UX Researcher Agent Memory

## Project Context
- **Project**: OrchestKit — Claude Code plugin (single `ork` plugin, v7.0.0)
- **Users**: Developers who use Claude Code daily; technically sophisticated
- **Components**: 69 skills, 38 agents, 96 hooks
- **Docs site**: fumadocs/Next.js

## Stable Patterns

### User Persona Split (OrchestKit)
- Power users: automate everything, CLI-first, expect zero-friction rollback
- Casual users: run /ork: commands, rely on docs site, need guided recovery flows
- Always segment personas by behavior (frequency, autonomy) not demographics

### Research File Conventions
- Research output goes in `docs/research/` or `personas/` — never in `src/`
- Use product-frameworks skill references for journey-map and story templates
- PREFER Edit over Write when updating existing research docs

### JTBD Pattern for Developer Tools
- Trigger: broken workflow after upgrade
- Motivation: restore confidence and productivity fast
- Outcome: back to working state with minimal context-switch

## Key Research Findings (February 2026)
- Version rollback UX brainstorm completed — 5 ideas with full journey maps
- Primary friction: no CLI-native rollback, no pre-upgrade health baseline
- Top opportunity: conversational rollback via Claude agent (low effort, high impact)

## Onboarding Journey Analysis (February 2026)
- Full report at: `docs/research/onboarding-journey-analysis.md`
- Aha moment: "Claude did the right thing without being told" — a hook fires, or a skill applies a pattern
- Current time-to-aha: 8-25 minutes. Target: under 3 minutes
- Key story: `/ork:commit` is the highest-density aha moment
