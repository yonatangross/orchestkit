# Workflow Chain Architecture — Design Doc

**Date**: 2026-03-07
**Status**: Draft (from brainstorming session)
**Issues**: #985 (architecture), #986-#990 (concrete chains)
**Milestone**: M90 — PM Skills Decomposition & Workflow Chains

---

## Core Insight

**Skills are markdown prompts — there's no runtime.** A pipeline skill can't programmatically call `Skill()`. Instead, the SKILL.md body contains instructions that tell Claude what to do step by step. Claude is the runtime.

## Winning Architecture: Orchestrator Skill + Handoff Files + Checkpoint-Resume

```
┌──────────────────────────────────────────────────────────────────┐
│               Pipeline Skill (normal SKILL.md)                    │
│                                                                   │
│  context: fork                                                    │
│  skills: [brainstorming, assess, plan-viz, implement, verify]    │
│                                                                   │
│  ┌─────────┐  handoff  ┌─────────┐  handoff  ┌─────────┐       │
│  │ Phase 1  │─────────▶│ Phase 2  │─────────▶│ Phase 3  │       │
│  │brainstorm│  .json    │ assess   │  .json    │ plan-viz │       │
│  └─────────┘           └─────────┘           └─────────┘       │
│       │                      │                      │            │
│       ▼                      ▼                      ▼            │
│  .claude/chain/         .claude/chain/         USER GATE         │
│  01-brainstorm.json     02-assess.json         AskUser()         │
│                                                      │           │
│  ┌─────────┐  handoff  ┌─────────┐                  │           │
│  │ Phase 5  │◀─────────│ Phase 4  │◀─────────────────┘           │
│  │ verify   │  .json    │implement │                              │
│  └─────────┘           └─────────┘                              │
│       │                                                          │
│       ▼                                                          │
│  .claude/chain/state.json (checkpoint-resume compatible)         │
└──────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **No new skill type** — Pipeline skill = normal SKILL.md whose body contains orchestration steps
2. **Handoff via `.claude/chain/` directory** — Each phase writes a structured JSON. Next phase reads it
3. **Checkpoint-resume compatible** — State in `.claude/chain/state.json` follows existing schema
4. **User gates via AskUserQuestion** — Between phases, with skip/modify/stop options
5. **Agent delegation, not Skill() calls** — Each phase spawns Agent with skill knowledge loaded via `skills:` field
6. **`skills:` field loads sub-skill knowledge** — Subagents get access to referenced skill content

## Why NOT Skill-to-Skill Calls?

CC's Skill tool is for user-invoked skills, not programmatic chaining:
- Parent skill's context would be replaced by child skill's context
- No way to pass structured data between Skill() invocations
- No way to capture Skill() output for handoff
- Breaks the fork isolation model

## Handoff File Schema

```json
{
  "phase_id": "brainstorm",
  "skill": "brainstorming",
  "status": "completed",
  "outputs": {
    "summary": "Top 3 approaches identified...",
    "artifacts": ["files created/modified"],
    "decisions": ["key decisions with rationale"],
    "scores": {"approach_a": 8.2, "approach_b": 7.1},
    "next_phase_context": "Recommended approach X because Y..."
  }
}
```

## Pipeline State Schema

```json
{
  "chain": "discovery",
  "completed_phases": [],
  "current_phase": null,
  "remaining_phases": [...],
  "context": {
    "branch": "feat/...",
    "user_input": "...",
    "key_decisions": [],
    "artifacts": []
  },
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

## 5 Planned Chains

| Chain | Phases | Flow | Issue |
|-------|--------|------|-------|
| discovery | 5 | brainstorm → assess → plan-viz → **[GATE]** → implement → verify | #986 |
| ship | 3 | commit → **[GATE]** → create-pr → review-pr | #987 |
| debug | 3 | errors → fix-issue → verify | #988 |
| refactor | 4 | explore → assess → **[GATE]** → implement → verify | #989 |
| release | 4 | verify → **[GATE]** → release-checklist → commit → create-pr | #990 |

## Phase Execution Pattern

Each phase:
1. Read previous handoff from `.claude/chain/NN-prev.json`
2. Spawn Agent with skill knowledge + handoff context
3. Collect results via TaskOutput
4. Write handoff to `.claude/chain/NN-current.json`
5. Update `.claude/chain/state.json`
6. If `gate_after`: AskUserQuestion (continue/review/modify/stop)

## Approaches Evaluated (12 total, scored 0-10)

| Approach | Avg Score | Verdict |
|----------|-----------|---------|
| Orchestrator Skill (Pipeline-as-Prompt) | 7.8 | **Winner** (combined with #5, #3) |
| Handoff File Pattern | 7.8 | **Winner** (combined with #1) |
| Checkpoint-Resume Extension | 7.3 | **Winner** (combined with #1) |
| Task-Chain Pattern | 7.3 | Good, subsumed by winner |
| Dual-Mode | 7.3 | Good idea for simple vs complex |
| Build-Time Template | 7.2 | Future optimization |
| Meta-Skill + skills: | 7.0 | Partial — skills: field is part of winner |
| Pipeline Frontmatter Extension | 6.8 | Over-engineered for now |
| Recursive Skill Invocation | 5.7 | CC doesn't support reliably |
| Memory Graph as Bus | 5.2 | Too slow for ephemeral handoff |
| Hook-Injected Transitions | 4.7 | Hooks can't control flow |
| Agent Teams Pipeline | 4.3 | Expensive, no sequencing |

## Existing Patterns (already in OrchestKit)

Skills already implement implicit pipelines:
- **implement**: 10 phases with tier injection, blocking gates, parallel agents
- **fix-issue**: 11 phases with hypothesis ranking, prevention gates
- **verify**: 8 phases with dimension scoring, security blocking
- **review-pr**: 6 phases with domain-aware agent selection
- **explore**: 8 phases with memory enrichment, dual orchestration modes

The workflow chain architecture formalizes these implicit patterns into a reusable structure.

## Research Sources

- Agent 1: CC skill system constraints (context:fork, skills: field, hooks, checkpoint-resume)
- Agent 2: pm-skills competitive analysis + 5 orchestration pattern comparison
- Agent 3: Analysis of 7 existing multi-step skills (implement, review-pr, fix-issue, explore, verify, commit, create-pr)
- Agent 4: CC docs research on skill composition, Skill tool internals, `${CLAUDE_PLUGIN_ROOT}` substitutions
