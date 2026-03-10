# Presets

Quick-start configurations for different use cases.

## Preset Matrix

| Preset | Skills | Agents | Hooks | Use Case |
|--------|--------|--------|-------|----------|
| **complete** | 91 | 31 | 96 | Full power — recommended for most users |
| **standard** | 91 | 0 | 96 | No agent delegation — lower token cost |
| **lite** | 10 | 0 | 96 | Essential: commit, implement, verify, explore, fix-issue, create-pr, review-pr, remember, memory, help |
| **hooks-only** | 0 | 0 | 96 | Just safety hooks (git protection, secret redaction, file guards) |
| **monorepo** | 91 | 31 | 96 | Complete + monorepo workspace detection enabled |

## Lite Preset Skills

The 10 essential skills for any project:

1. `commit` — Conventional commits with safety hooks
2. `implement` — Feature implementation with parallel agents
3. `verify` — Test and grade implementations
4. `explore` — Codebase exploration
5. `fix-issue` — GitHub issue resolution
6. `create-pr` — PR creation with validation
7. `review-pr` — PR review with 6 agents
8. `remember` — Store decisions in knowledge graph
9. `memory` — Search and recall past decisions
10. `help` — Skill directory

## Applying a Preset

```bash
/ork:setup --preset complete
/ork:setup --preset lite
```

Presets set the base, then user can toggle individual categories on/off.
